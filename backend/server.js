require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const cron = require('node-cron');
const bcrypt = require('bcryptjs');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const pino = require('pino');
const pinoHttp = require('pino-http');
const Database = require('better-sqlite3');
const { initDatabase } = require('./db/init');
const { generateToken, requireAuth, optionalAuth } = require('./middleware/auth');
const { errorHandler, asyncHandler } = require('./middleware/error-handler');
const { validateIdParams, sanitizeBody, isValidEmail, isValidDate } = require('./middleware/validate');
const { generateResponse, getSuggestedResponses } = require('./services/ai-responder');
const { calculatePrice, calculateRangePrice } = require('./services/pricing-engine');
const { notify } = require('./services/notification');
const { fetchAndParseICal, syncICalToDatabase, generateICalExport } = require('./services/ical');

// Logger
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV !== 'production'
    ? { target: 'pino/file', options: { destination: 1 } }
    : undefined,
});

const app = express();
const PORT = process.env.PORT || 3001;
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'db', 'airbnb.db');

// Initialize database
const db = initDatabase(DB_PATH);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://unpkg.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'"],
    },
  },
}));
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === '/api/health' } }));
app.use(sanitizeBody);
app.use(validateIdParams);
const FRONTEND_DIR = process.env.FRONTEND_DIR || path.join(__dirname, '..', 'frontend');
app.use(express.static(FRONTEND_DIR));

// Rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 attempts per window
  message: { error: 'Too many attempts. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ============================================
// AUTH ROUTES (public)
// ============================================

app.post('/api/auth/register', authLimiter, (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'name, email, and password are required' });
  }
  if (!isValidEmail(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }
  if (name.length > 100) {
    return res.status(400).json({ error: 'Name must be 100 characters or less' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
  if (existing) {
    return res.status(409).json({ error: 'Email already registered' });
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  const result = db.prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)')
    .run(name, email.toLowerCase(), passwordHash);

  const user = { id: result.lastInsertRowid, name, email: email.toLowerCase() };
  const token = generateToken(user);
  res.status(201).json({ user: { id: user.id, name: user.name, email: user.email }, token });
});

app.post('/api/auth/login', authLimiter, (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }
  if (!isValidEmail(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const token = generateToken(user);
  res.json({ user: { id: user.id, name: user.name, email: user.email }, token });
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  const user = db.prepare('SELECT id, name, email, created_at FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

// ============================================
// HEALTH (public)
// ============================================

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', version: '2.0.0', timestamp: new Date().toISOString() });
});

// ============================================
// PROPERTIES (authenticated)
// ============================================

app.get('/api/properties', requireAuth, (req, res) => {
  const properties = db.prepare('SELECT * FROM properties WHERE user_id = ? ORDER BY created_at DESC').all(req.user.id);
  properties.forEach(p => { if (p.amenities) p.amenities = JSON.parse(p.amenities); });
  res.json(properties);
});

app.post('/api/properties', requireAuth, (req, res) => {
  const { name, address, description, amenities, house_rules, max_guests, bedrooms, bathrooms, base_price, currency, timezone, ical_url } = req.body;
  if (!name) return res.status(400).json({ error: 'Property name is required' });

  const result = db.prepare(`
    INSERT INTO properties (user_id, name, address, description, amenities, house_rules, max_guests, bedrooms, bathrooms, base_price, currency, timezone, ical_url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    req.user.id, name, address || '', description || '',
    JSON.stringify(amenities || []), house_rules || '',
    max_guests || 4, bedrooms || 1, bathrooms || 1,
    base_price || 1500, currency || 'MXN', timezone || 'America/Mexico_City',
    ical_url || null
  );

  const property = db.prepare('SELECT * FROM properties WHERE id = ?').get(result.lastInsertRowid);
  if (property.amenities) property.amenities = JSON.parse(property.amenities);
  res.status(201).json(property);
});

app.get('/api/properties/:id', requireAuth, (req, res) => {
  const property = db.prepare('SELECT * FROM properties WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!property) return res.status(404).json({ error: 'Property not found' });
  if (property.amenities) property.amenities = JSON.parse(property.amenities);
  res.json(property);
});

app.put('/api/properties/:id', requireAuth, (req, res) => {
  const existing = db.prepare('SELECT id FROM properties WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!existing) return res.status(404).json({ error: 'Property not found' });

  const { name, address, description, amenities, house_rules, max_guests, bedrooms, bathrooms, base_price, currency, timezone, ical_url } = req.body;

  db.prepare(`
    UPDATE properties SET
      name = COALESCE(?, name), address = COALESCE(?, address), description = COALESCE(?, description),
      amenities = COALESCE(?, amenities), house_rules = COALESCE(?, house_rules),
      max_guests = COALESCE(?, max_guests), bedrooms = COALESCE(?, bedrooms), bathrooms = COALESCE(?, bathrooms),
      base_price = COALESCE(?, base_price), currency = COALESCE(?, currency), timezone = COALESCE(?, timezone),
      ical_url = COALESCE(?, ical_url), updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    name, address, description,
    amenities ? JSON.stringify(amenities) : null, house_rules,
    max_guests, bedrooms, bathrooms,
    base_price, currency, timezone, ical_url,
    req.params.id
  );

  const property = db.prepare('SELECT * FROM properties WHERE id = ?').get(req.params.id);
  if (property.amenities) property.amenities = JSON.parse(property.amenities);
  res.json(property);
});

app.delete('/api/properties/:id', requireAuth, (req, res) => {
  const result = db.prepare('DELETE FROM properties WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Property not found' });
  res.json({ deleted: true });
});

// ============================================
// HELPER: verify property ownership
// ============================================

function getPropertyForUser(propertyId, userId) {
  return db.prepare('SELECT * FROM properties WHERE id = ? AND user_id = ?').get(propertyId, userId);
}

// ============================================
// LEGACY ROUTES (backward compat — no auth, uses first property)
// ============================================

app.get('/api/property', optionalAuth, (req, res) => {
  let property;
  if (req.user) {
    property = db.prepare('SELECT * FROM properties WHERE user_id = ? LIMIT 1').get(req.user.id);
  }
  if (!property) {
    // Legacy fallback
    property = db.prepare('SELECT * FROM property LIMIT 1').get();
  }
  if (property && property.amenities) {
    try { property.amenities = JSON.parse(property.amenities); } catch(e) {}
  }
  res.json(property || {});
});

// ============================================
// RESERVATIONS (scoped to property)
// ============================================

app.get('/api/properties/:propertyId/reservations', requireAuth, (req, res) => {
  const property = getPropertyForUser(req.params.propertyId, req.user.id);
  if (!property) return res.status(404).json({ error: 'Property not found' });

  const { status, upcoming } = req.query;
  let query = 'SELECT * FROM reservations WHERE property_id = ?';
  const params = [property.id];

  if (status) { query += ' AND status = ?'; params.push(status); }
  if (upcoming === 'true') { query += ' AND check_in >= date("now")'; }
  query += ' ORDER BY check_in ASC';

  res.json(db.prepare(query).all(...params));
});

// Legacy route (no auth)
app.get('/api/reservations', optionalAuth, (req, res) => {
  const { status, upcoming } = req.query;
  let query = 'SELECT * FROM reservations';
  const conditions = [];
  const params = [];

  if (req.user) {
    const prop = db.prepare('SELECT id FROM properties WHERE user_id = ? LIMIT 1').get(req.user.id);
    if (prop) { conditions.push('property_id = ?'); params.push(prop.id); }
  }
  if (status) { conditions.push('status = ?'); params.push(status); }
  if (upcoming === 'true') { conditions.push('check_in >= date("now")'); }
  if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');
  query += ' ORDER BY check_in ASC';

  res.json(db.prepare(query).all(...params));
});

app.get('/api/reservations/:id', optionalAuth, (req, res) => {
  const reservation = db.prepare('SELECT * FROM reservations WHERE id = ?').get(req.params.id);
  if (!reservation) return res.status(404).json({ error: 'Reservation not found' });
  res.json(reservation);
});

// ============================================
// CALENDAR (scoped to property)
// ============================================

app.get('/api/properties/:propertyId/calendar', requireAuth, (req, res) => {
  const property = getPropertyForUser(req.params.propertyId, req.user.id);
  if (!property) return res.status(404).json({ error: 'Property not found' });

  const { month, year } = req.query;
  let query = 'SELECT * FROM calendar WHERE property_id = ?';
  const params = [property.id];

  if (month && year) {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endMonth = parseInt(month) === 12 ? 1 : parseInt(month) + 1;
    const endYear = parseInt(month) === 12 ? parseInt(year) + 1 : parseInt(year);
    const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-01`;
    query += ' AND date >= ? AND date < ?';
    params.push(startDate, endDate);
  }
  query += ' ORDER BY date ASC';
  res.json(db.prepare(query).all(...params));
});

// Legacy route
app.get('/api/calendar', optionalAuth, (req, res) => {
  const { month, year } = req.query;
  let query = 'SELECT * FROM calendar';
  const conditions = [];
  const params = [];

  if (req.user) {
    const prop = db.prepare('SELECT id FROM properties WHERE user_id = ? LIMIT 1').get(req.user.id);
    if (prop) { conditions.push('property_id = ?'); params.push(prop.id); }
  }
  if (month && year) {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endMonth = parseInt(month) === 12 ? 1 : parseInt(month) + 1;
    const endYear = parseInt(month) === 12 ? parseInt(year) + 1 : parseInt(year);
    const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-01`;
    conditions.push('date >= ?', 'date < ?');
    params.push(startDate, endDate);
  }
  if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');
  query += ' ORDER BY date ASC';
  res.json(db.prepare(query).all(...params));
});

// ============================================
// MESSAGES (scoped to property)
// ============================================

app.get('/api/properties/:propertyId/messages', requireAuth, (req, res) => {
  const property = getPropertyForUser(req.params.propertyId, req.user.id);
  if (!property) return res.status(404).json({ error: 'Property not found' });

  const { reservation_id, unread } = req.query;
  let query = `
    SELECT m.*, r.guest_name, r.check_in, r.check_out
    FROM messages m LEFT JOIN reservations r ON m.reservation_id = r.id
    WHERE m.property_id = ?
  `;
  const params = [property.id];

  if (reservation_id) { query += ' AND m.reservation_id = ?'; params.push(reservation_id); }
  if (unread === 'true') { query += ' AND m.is_read = 0'; }
  query += ' ORDER BY m.timestamp DESC';
  res.json(db.prepare(query).all(...params));
});

// Legacy route
app.get('/api/messages', optionalAuth, (req, res) => {
  const { reservation_id, unread } = req.query;
  let query = `
    SELECT m.*, r.guest_name, r.check_in, r.check_out
    FROM messages m LEFT JOIN reservations r ON m.reservation_id = r.id
  `;
  const conditions = [];
  const params = [];

  if (req.user) {
    const prop = db.prepare('SELECT id FROM properties WHERE user_id = ? LIMIT 1').get(req.user.id);
    if (prop) { conditions.push('m.property_id = ?'); params.push(prop.id); }
  }
  if (reservation_id) { conditions.push('m.reservation_id = ?'); params.push(reservation_id); }
  if (unread === 'true') { conditions.push('m.is_read = 0'); }
  if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');
  query += ' ORDER BY m.timestamp DESC';
  res.json(db.prepare(query).all(...params));
});

app.post('/api/messages/send', optionalAuth, (req, res) => {
  const { reservation_id, content, use_ai } = req.body;
  if (!reservation_id || !content) return res.status(400).json({ error: 'reservation_id and content are required' });

  const reservation = db.prepare('SELECT * FROM reservations WHERE id = ?').get(reservation_id);
  if (!reservation) return res.status(404).json({ error: 'Reservation not found' });

  let responseContent = content;
  let isAiResponse = 0;

  if (use_ai) {
    const property = db.prepare('SELECT * FROM properties WHERE id = ?').get(reservation.property_id);
    const aiResult = generateResponse(content, reservation.guest_name, reservation, property);
    responseContent = aiResult.response;
    isAiResponse = 1;
  }

  const result = db.prepare(`
    INSERT INTO messages (property_id, reservation_id, sender, content, is_ai_response)
    VALUES (?, ?, 'host', ?, ?)
  `).run(reservation.property_id, reservation_id, responseContent, isAiResponse);

  db.prepare('UPDATE messages SET is_read = 1 WHERE reservation_id = ? AND sender = ?')
    .run(reservation_id, 'guest');

  res.json({ id: result.lastInsertRowid, content: responseContent, is_ai_response: isAiResponse });
});

app.post('/api/messages/suggest', optionalAuth, (req, res) => {
  const { reservation_id, message_content } = req.body;
  const reservation = db.prepare('SELECT * FROM reservations WHERE id = ?').get(reservation_id);
  const guestName = reservation ? reservation.guest_name : 'Guest';
  const property = reservation
    ? db.prepare('SELECT * FROM properties WHERE id = ?').get(reservation.property_id)
    : null;
  const suggestions = getSuggestedResponses(message_content, guestName, reservation, property);
  res.json({ suggestions });
});

// ============================================
// ANALYTICS (scoped to property)
// ============================================

app.get('/api/properties/:propertyId/analytics', requireAuth, (req, res) => {
  const property = getPropertyForUser(req.params.propertyId, req.user.id);
  if (!property) return res.status(404).json({ error: 'Property not found' });
  res.json(buildAnalytics(property.id));
});

// Legacy route
app.get('/api/analytics', optionalAuth, (req, res) => {
  let propertyId = null;
  if (req.user) {
    const prop = db.prepare('SELECT id FROM properties WHERE user_id = ? LIMIT 1').get(req.user.id);
    if (prop) propertyId = prop.id;
  }
  res.json(buildAnalytics(propertyId));
});

function buildAnalytics(propertyId) {
  const pFilter = propertyId ? ' WHERE property_id = ?' : '';
  const pFilterAnd = propertyId ? ' AND property_id = ?' : '';
  const pParams = propertyId ? [propertyId] : [];

  const totalDays = db.prepare(`SELECT COUNT(*) as count FROM calendar${pFilter}`).get(...pParams).count;
  const bookedDays = db.prepare(`SELECT COUNT(*) as count FROM calendar${pFilter ? pFilter + ' AND' : ' WHERE'} available = 0`).get(...pParams).count;
  const occupancyRate = totalDays > 0 ? Math.round((bookedDays / totalDays) * 100) : 0;

  const revenueResult = db.prepare(`
    SELECT COALESCE(SUM(total_price), 0) as total FROM reservations
    WHERE status IN ('confirmed', 'completed')${pFilterAnd}
  `).get(...pParams);

  const monthlyRevenue = db.prepare(`
    SELECT COALESCE(SUM(total_price), 0) as total FROM reservations
    WHERE status IN ('confirmed', 'completed')
    AND check_in >= date('now', 'start of month') AND check_in < date('now', 'start of month', '+1 month')${pFilterAnd}
  `).get(...pParams);

  const avgRating = db.prepare(`SELECT COALESCE(AVG(rating), 0) as avg FROM reviews${pFilter}`).get(...pParams);
  const reviewCount = db.prepare(`SELECT COUNT(*) as count FROM reviews${pFilter}`).get(...pParams).count;

  const upcomingCheckins = db.prepare(`
    SELECT COUNT(*) as count FROM reservations
    WHERE check_in >= date('now') AND check_in <= date('now', '+7 days') AND status = 'confirmed'${pFilterAnd}
  `).get(...pParams).count;

  const pendingMessages = db.prepare(`
    SELECT COUNT(*) as count FROM messages WHERE is_read = 0 AND sender = 'guest'${pFilterAnd}
  `).get(...pParams).count;

  const pendingCleaning = db.prepare(`
    SELECT COUNT(*) as count FROM cleaning_tasks WHERE status = 'pending'${pFilterAnd}
  `).get(...pParams).count;

  return {
    occupancy_rate: occupancyRate,
    total_revenue: revenueResult.total,
    monthly_revenue: monthlyRevenue.total,
    average_rating: Math.round(avgRating.avg * 10) / 10,
    review_count: reviewCount,
    upcoming_checkins: upcomingCheckins,
    pending_messages: pendingMessages,
    pending_cleaning: pendingCleaning,
  };
}

// ============================================
// PRICING
// ============================================

app.post('/api/pricing', optionalAuth, (req, res) => {
  const { start_date, end_date, price, min_nights, property_id } = req.body;
  if (!start_date || !end_date) return res.status(400).json({ error: 'start_date and end_date are required' });
  if (!isValidDate(start_date) || !isValidDate(end_date)) return res.status(400).json({ error: 'Invalid date format (use YYYY-MM-DD)' });
  if (start_date > end_date) return res.status(400).json({ error: 'start_date must be before end_date' });

  let query = 'UPDATE calendar SET price = COALESCE(?, price), min_nights = COALESCE(?, min_nights) WHERE date >= ? AND date <= ?';
  const params = [price, min_nights, start_date, end_date];

  if (property_id) { query += ' AND property_id = ?'; params.push(property_id); }

  const result = db.prepare(query).run(...params);
  res.json({ updated: result.changes });
});

app.get('/api/pricing/calculate', (req, res) => {
  const { start_date, end_date } = req.query;
  if (!start_date || !end_date) return res.status(400).json({ error: 'start_date and end_date are required' });
  if (!isValidDate(start_date) || !isValidDate(end_date)) return res.status(400).json({ error: 'Invalid date format (use YYYY-MM-DD)' });
  res.json(calculateRangePrice(start_date, end_date));
});

// ============================================
// REVIEWS (scoped to property)
// ============================================

app.get('/api/properties/:propertyId/reviews', requireAuth, (req, res) => {
  const property = getPropertyForUser(req.params.propertyId, req.user.id);
  if (!property) return res.status(404).json({ error: 'Property not found' });

  const reviews = db.prepare(`
    SELECT rv.*, r.guest_name FROM reviews rv
    LEFT JOIN reservations r ON rv.reservation_id = r.id
    WHERE rv.property_id = ? ORDER BY rv.created_at DESC
  `).all(property.id);
  res.json(reviews);
});

// Legacy route
app.get('/api/reviews', (req, res) => {
  const reviews = db.prepare(`
    SELECT rv.*, r.guest_name FROM reviews rv
    LEFT JOIN reservations r ON rv.reservation_id = r.id ORDER BY rv.created_at DESC
  `).all();
  res.json(reviews);
});

// ============================================
// CLEANING (scoped to property)
// ============================================

app.get('/api/properties/:propertyId/cleaning', requireAuth, (req, res) => {
  const property = getPropertyForUser(req.params.propertyId, req.user.id);
  if (!property) return res.status(404).json({ error: 'Property not found' });

  const tasks = db.prepare(`
    SELECT ct.*, r.guest_name, r.check_out FROM cleaning_tasks ct
    LEFT JOIN reservations r ON ct.reservation_id = r.id
    WHERE ct.property_id = ? ORDER BY ct.scheduled_date ASC
  `).all(property.id);
  res.json(tasks);
});

// Legacy route
app.get('/api/cleaning', (req, res) => {
  const tasks = db.prepare(`
    SELECT ct.*, r.guest_name, r.check_out FROM cleaning_tasks ct
    LEFT JOIN reservations r ON ct.reservation_id = r.id ORDER BY ct.scheduled_date ASC
  `).all();
  res.json(tasks);
});

app.patch('/api/cleaning/:id', optionalAuth, (req, res) => {
  const { status, cleaner_notes } = req.body;
  const validStatuses = ['pending', 'in_progress', 'completed'];
  if (status && !validStatuses.includes(status)) {
    return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
  }
  const result = db.prepare(`
    UPDATE cleaning_tasks SET status = COALESCE(?, status), cleaner_notes = COALESCE(?, cleaner_notes) WHERE id = ?
  `).run(status, cleaner_notes, req.params.id);
  res.json({ updated: result.changes });
});

// ============================================
// iCAL INTEGRATION
// ============================================

// Import: Sync from Airbnb iCal URL
app.post('/api/properties/:propertyId/ical/sync', requireAuth, async (req, res) => {
  const property = getPropertyForUser(req.params.propertyId, req.user.id);
  if (!property) return res.status(404).json({ error: 'Property not found' });

  const icalUrl = req.body.ical_url || property.ical_url;
  if (!icalUrl) return res.status(400).json({ error: 'No iCal URL configured. Set it in property settings or pass ical_url in body.' });

  try {
    const icalReservations = await fetchAndParseICal(icalUrl);
    const result = syncICalToDatabase(db, property.id, icalReservations);

    // Update the stored iCal URL if provided
    if (req.body.ical_url && req.body.ical_url !== property.ical_url) {
      db.prepare('UPDATE properties SET ical_url = ? WHERE id = ?').run(req.body.ical_url, property.id);
    }

    res.json({ success: true, ...result, total_events: icalReservations.length });
  } catch (err) {
    res.status(500).json({ error: `iCal sync failed: ${err.message}` });
  }
});

// Export: Generate iCal for the property
app.get('/api/properties/:propertyId/ical/export', requireAuth, (req, res) => {
  const property = getPropertyForUser(req.params.propertyId, req.user.id);
  if (!property) return res.status(404).json({ error: 'Property not found' });

  const ics = generateICalExport(db, property.id, property.name);
  res.set('Content-Type', 'text/calendar; charset=utf-8');
  res.set('Content-Disposition', `attachment; filename="${property.name.replace(/[^a-zA-Z0-9]/g, '_')}.ics"`);
  res.send(ics);
});

// Public iCal export (with a token for sharing — no auth required)
app.get('/api/ical/:propertyId.ics', (req, res) => {
  const property = db.prepare('SELECT * FROM properties WHERE id = ?').get(req.params.propertyId);
  if (!property) return res.status(404).send('Not found');

  const ics = generateICalExport(db, property.id, property.name);
  res.set('Content-Type', 'text/calendar; charset=utf-8');
  res.send(ics);
});

// ============================================
// CRON JOBS
// ============================================

cron.schedule('0 8 * * *', () => {
  const today = new Date().toISOString().split('T')[0];
  const checkIns = db.prepare("SELECT * FROM reservations WHERE check_in = ? AND status = 'confirmed'").all(today);
  checkIns.forEach(r => notify.checkInReminder(r));
  const checkOuts = db.prepare("SELECT * FROM reservations WHERE check_out = ? AND status = 'confirmed'").all(today);
  checkOuts.forEach(r => notify.checkOutReminder(r));
  const cleaning = db.prepare("SELECT * FROM cleaning_tasks WHERE scheduled_date = ? AND status = 'pending'").all(today);
  cleaning.forEach(t => notify.cleaningDue(t));
});

// ============================================
// FRONTEND ROUTES
// ============================================

// Serve specific HTML pages
app.get('/login', (req, res) => res.sendFile(path.join(FRONTEND_DIR, 'login.html')));
app.get('/landing', (req, res) => res.sendFile(path.join(FRONTEND_DIR, 'landing.html')));
app.get('/onboarding', (req, res) => res.sendFile(path.join(FRONTEND_DIR, 'onboarding.html')));

// Serve frontend for non-API routes
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(FRONTEND_DIR, 'index.html'));
  }
});

// Global error handler (must be registered last)
app.use(errorHandler);

app.listen(PORT, () => {
  logger.info({ port: PORT, db: DB_PATH }, 'Airbnb Manager v2.0 started');
  console.log(`\n  Airbnb Manager v2.0 running at http://localhost:${PORT}`);
  console.log(`  Dashboard:  http://localhost:${PORT}`);
  console.log(`  Landing:    http://localhost:${PORT}/landing`);
  console.log(`  Onboarding: http://localhost:${PORT}/onboarding`);
  console.log(`  Database:   ${DB_PATH}\n`);
});
