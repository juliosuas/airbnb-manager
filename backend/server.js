require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const cron = require('node-cron');
const Database = require('better-sqlite3');
const { initDatabase } = require('./db/init');
const { generateResponse, getSuggestedResponses } = require('./services/ai-responder');
const { calculatePrice, calculateRangePrice } = require('./services/pricing-engine');
const { notify } = require('./services/notification');

const app = express();
const PORT = process.env.PORT || 3001;
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'db', 'airbnb.db');

// Initialize database
const db = initDatabase(DB_PATH);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// --- Health ---
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// --- Property ---
app.get('/api/property', (req, res) => {
  const property = db.prepare('SELECT * FROM property LIMIT 1').get();
  if (property && property.amenities) {
    property.amenities = JSON.parse(property.amenities);
  }
  res.json(property || {});
});

// --- Reservations ---
app.get('/api/reservations', (req, res) => {
  const { status, upcoming } = req.query;
  let query = 'SELECT * FROM reservations';
  const conditions = [];
  const params = [];

  if (status) {
    conditions.push('status = ?');
    params.push(status);
  }
  if (upcoming === 'true') {
    conditions.push('check_in >= date("now")');
  }

  if (conditions.length) {
    query += ' WHERE ' + conditions.join(' AND ');
  }
  query += ' ORDER BY check_in ASC';

  const reservations = db.prepare(query).all(...params);
  res.json(reservations);
});

app.get('/api/reservations/:id', (req, res) => {
  const reservation = db.prepare('SELECT * FROM reservations WHERE id = ?').get(req.params.id);
  if (!reservation) return res.status(404).json({ error: 'Reservation not found' });
  res.json(reservation);
});

// --- Calendar ---
app.get('/api/calendar', (req, res) => {
  const { month, year } = req.query;
  let query = 'SELECT * FROM calendar';
  const params = [];

  if (month && year) {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endMonth = parseInt(month) === 12 ? 1 : parseInt(month) + 1;
    const endYear = parseInt(month) === 12 ? parseInt(year) + 1 : parseInt(year);
    const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-01`;
    query += ' WHERE date >= ? AND date < ?';
    params.push(startDate, endDate);
  }

  query += ' ORDER BY date ASC';
  const calendar = db.prepare(query).all(...params);
  res.json(calendar);
});

// --- Messages ---
app.get('/api/messages', (req, res) => {
  const { reservation_id, unread } = req.query;
  let query = `
    SELECT m.*, r.guest_name, r.check_in, r.check_out
    FROM messages m
    LEFT JOIN reservations r ON m.reservation_id = r.id
  `;
  const conditions = [];
  const params = [];

  if (reservation_id) {
    conditions.push('m.reservation_id = ?');
    params.push(reservation_id);
  }
  if (unread === 'true') {
    conditions.push('m.is_read = 0');
  }

  if (conditions.length) {
    query += ' WHERE ' + conditions.join(' AND ');
  }
  query += ' ORDER BY m.timestamp DESC';

  const messages = db.prepare(query).all(...params);
  res.json(messages);
});

app.post('/api/messages/send', (req, res) => {
  const { reservation_id, content, use_ai } = req.body;

  if (!reservation_id || !content) {
    return res.status(400).json({ error: 'reservation_id and content are required' });
  }

  const reservation = db.prepare('SELECT * FROM reservations WHERE id = ?').get(reservation_id);
  if (!reservation) {
    return res.status(404).json({ error: 'Reservation not found' });
  }

  let responseContent = content;
  let isAiResponse = 0;

  if (use_ai) {
    const aiResult = generateResponse(content, reservation.guest_name, reservation);
    responseContent = aiResult.response;
    isAiResponse = 1;
  }

  const result = db.prepare(`
    INSERT INTO messages (reservation_id, sender, content, is_ai_response)
    VALUES (?, 'host', ?, ?)
  `).run(reservation_id, responseContent, isAiResponse);

  // Mark guest messages as read
  db.prepare('UPDATE messages SET is_read = 1 WHERE reservation_id = ? AND sender = ?')
    .run(reservation_id, 'guest');

  res.json({
    id: result.lastInsertRowid,
    content: responseContent,
    is_ai_response: isAiResponse,
  });
});

// AI suggestion endpoint
app.post('/api/messages/suggest', (req, res) => {
  const { reservation_id, message_content } = req.body;

  const reservation = db.prepare('SELECT * FROM reservations WHERE id = ?').get(reservation_id);
  const guestName = reservation ? reservation.guest_name : 'Guest';

  const suggestions = getSuggestedResponses(message_content, guestName, reservation);
  res.json({ suggestions });
});

// --- Analytics ---
app.get('/api/analytics', (req, res) => {
  const totalDays = db.prepare('SELECT COUNT(*) as count FROM calendar').get().count;
  const bookedDays = db.prepare('SELECT COUNT(*) as count FROM calendar WHERE available = 0').get().count;
  const occupancyRate = totalDays > 0 ? Math.round((bookedDays / totalDays) * 100) : 0;

  const revenueResult = db.prepare(`
    SELECT COALESCE(SUM(total_price), 0) as total
    FROM reservations
    WHERE status IN ('confirmed', 'completed')
  `).get();

  const monthlyRevenue = db.prepare(`
    SELECT COALESCE(SUM(total_price), 0) as total
    FROM reservations
    WHERE status IN ('confirmed', 'completed')
    AND check_in >= date('now', 'start of month')
    AND check_in < date('now', 'start of month', '+1 month')
  `).get();

  const avgRating = db.prepare('SELECT COALESCE(AVG(rating), 0) as avg FROM reviews').get();
  const reviewCount = db.prepare('SELECT COUNT(*) as count FROM reviews').get().count;

  const upcomingCheckins = db.prepare(`
    SELECT COUNT(*) as count FROM reservations
    WHERE check_in >= date('now') AND check_in <= date('now', '+7 days')
    AND status = 'confirmed'
  `).get().count;

  const pendingMessages = db.prepare(`
    SELECT COUNT(*) as count FROM messages
    WHERE is_read = 0 AND sender = 'guest'
  `).get().count;

  const pendingCleaning = db.prepare(`
    SELECT COUNT(*) as count FROM cleaning_tasks
    WHERE status = 'pending'
  `).get().count;

  res.json({
    occupancy_rate: occupancyRate,
    total_revenue: revenueResult.total,
    monthly_revenue: monthlyRevenue.total,
    average_rating: Math.round(avgRating.avg * 10) / 10,
    review_count: reviewCount,
    upcoming_checkins: upcomingCheckins,
    pending_messages: pendingMessages,
    pending_cleaning: pendingCleaning,
  });
});

// --- Pricing ---
app.post('/api/pricing', (req, res) => {
  const { start_date, end_date, price, min_nights } = req.body;

  if (!start_date || !end_date) {
    return res.status(400).json({ error: 'start_date and end_date are required' });
  }

  const update = db.prepare(`
    UPDATE calendar SET price = COALESCE(?, price), min_nights = COALESCE(?, min_nights)
    WHERE date >= ? AND date <= ?
  `);

  const result = update.run(price, min_nights, start_date, end_date);
  res.json({ updated: result.changes });
});

app.get('/api/pricing/calculate', (req, res) => {
  const { start_date, end_date } = req.query;
  if (!start_date || !end_date) {
    return res.status(400).json({ error: 'start_date and end_date are required' });
  }
  const result = calculateRangePrice(start_date, end_date);
  res.json(result);
});

// --- Reviews ---
app.get('/api/reviews', (req, res) => {
  const reviews = db.prepare(`
    SELECT rv.*, r.guest_name
    FROM reviews rv
    LEFT JOIN reservations r ON rv.reservation_id = r.id
    ORDER BY rv.created_at DESC
  `).all();
  res.json(reviews);
});

// --- Cleaning ---
app.get('/api/cleaning', (req, res) => {
  const tasks = db.prepare(`
    SELECT ct.*, r.guest_name, r.check_out
    FROM cleaning_tasks ct
    LEFT JOIN reservations r ON ct.reservation_id = r.id
    ORDER BY ct.scheduled_date ASC
  `).all();
  res.json(tasks);
});

app.patch('/api/cleaning/:id', (req, res) => {
  const { status, cleaner_notes } = req.body;
  const result = db.prepare(`
    UPDATE cleaning_tasks SET status = COALESCE(?, status), cleaner_notes = COALESCE(?, cleaner_notes)
    WHERE id = ?
  `).run(status, cleaner_notes, req.params.id);
  res.json({ updated: result.changes });
});

// --- Cron Jobs ---
// Daily check-in/check-out reminders at 8am
cron.schedule('0 8 * * *', () => {
  const today = new Date().toISOString().split('T')[0];

  const checkIns = db.prepare("SELECT * FROM reservations WHERE check_in = ? AND status = 'confirmed'").all(today);
  checkIns.forEach((r) => notify.checkInReminder(r));

  const checkOuts = db.prepare("SELECT * FROM reservations WHERE check_out = ? AND status = 'confirmed'").all(today);
  checkOuts.forEach((r) => notify.checkOutReminder(r));

  const cleaning = db.prepare("SELECT * FROM cleaning_tasks WHERE scheduled_date = ? AND status = 'pending'").all(today);
  cleaning.forEach((t) => notify.cleaningDue(t));
});

// Serve frontend for non-API routes
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
  }
});

app.listen(PORT, () => {
  console.log(`\n  🏠 Airbnb Manager API running at http://localhost:${PORT}`);
  console.log(`  📊 Dashboard at http://localhost:${PORT}`);
  console.log(`  💾 Database: ${DB_PATH}\n`);
});
