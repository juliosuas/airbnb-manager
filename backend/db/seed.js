require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcryptjs');
const { initDatabase } = require('./init');

const dbPath = process.env.DB_PATH || path.join(__dirname, 'airbnb.db');
const db = initDatabase(dbPath);

// Helper: format date as YYYY-MM-DD
function fmt(date) {
  return date.toISOString().split('T')[0];
}

// Helper: create a date relative to today
function daysFromNow(offset) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d;
}

// Clear existing data
db.exec(`
  DELETE FROM cleaning_tasks;
  DELETE FROM reviews;
  DELETE FROM messages;
  DELETE FROM calendar;
  DELETE FROM reservations;
  DELETE FROM properties;
  DELETE FROM users;
  DELETE FROM property;
`);

// Demo user
const passwordHash = bcrypt.hashSync('demo1234', 10);
const userResult = db.prepare(`
  INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)
`).run('Demo Host', 'demo@airbnbmanager.com', passwordHash);
const userId = userResult.lastInsertRowid;

// Property (new multi-tenant table)
const propResult = db.prepare(`
  INSERT INTO properties (user_id, name, address, description, amenities, house_rules, max_guests, bedrooms, bathrooms, base_price, currency, timezone)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`).run(
  userId,
  'Casa Sol — Playa del Carmen',
  'Calle 38 Norte, Playa del Carmen, Quintana Roo, Mexico',
  'Beautiful modern apartment in the heart of Playa del Carmen. 2 blocks from the beach, walking distance to 5th Avenue. Fully equipped kitchen, fast WiFi, rooftop pool.',
  JSON.stringify(['WiFi 200Mbps', 'Rooftop Pool', 'A/C', 'Full Kitchen', 'Smart TV', 'Washer', 'Beach Towels', 'Parking', 'Self Check-in', 'Coffee Maker']),
  'No smoking indoors. No parties or events. Quiet hours 10pm-8am. Max 4 guests. No pets. Check-in after 3pm, check-out before 11am.',
  4, 2, 1, 1500, 'MXN', 'America/Mexico_City'
);
const propertyId = propResult.lastInsertRowid;

// Legacy property table (backward compat)
db.prepare(`
  INSERT INTO property (name, address, description, amenities, house_rules, max_guests, bedrooms, bathrooms)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`).run(
  'Casa Sol — Playa del Carmen',
  'Calle 38 Norte, Playa del Carmen, Quintana Roo, Mexico',
  'Beautiful modern apartment in the heart of Playa del Carmen. 2 blocks from the beach, walking distance to 5th Avenue. Fully equipped kitchen, fast WiFi, rooftop pool.',
  JSON.stringify(['WiFi 200Mbps', 'Rooftop Pool', 'A/C', 'Full Kitchen', 'Smart TV', 'Washer', 'Beach Towels', 'Parking', 'Self Check-in', 'Coffee Maker']),
  'No smoking indoors. No parties or events. Quiet hours 10pm-8am. Max 4 guests. No pets. Check-in after 3pm, check-out before 11am.',
  4, 2, 1
);

// Reservations — dynamic dates relative to today
// Past guests (completed), current/upcoming (confirmed), future (pending)
const reservations = [
  ['María García',      'maria.garcia@gmail.com',   fmt(daysFromNow(-40)), fmt(daysFromNow(-35)), 'completed',  7500, 2],
  ['John Smith',        'john.smith@outlook.com',    fmt(daysFromNow(-33)), fmt(daysFromNow(-28)), 'completed',  8200, 3],
  ['Sophie Müller',     'sophie.m@gmail.com',        fmt(daysFromNow(-25)), fmt(daysFromNow(-21)), 'completed',  6800, 2],
  ['Carlos Rodríguez',  'carlos.rod@yahoo.com',      fmt(daysFromNow(-18)), fmt(daysFromNow(-14)), 'completed',  6000, 1],
  ['Emma Johnson',      'emma.j@gmail.com',          fmt(daysFromNow(-10)), fmt(daysFromNow(-6)),  'completed',  7200, 2],
  ['Pierre Dubois',     'pierre.d@gmail.com',        fmt(daysFromNow(-3)),  fmt(daysFromNow(2)),   'confirmed',  9500, 4],
  ['Ana Martínez',      'ana.mtz@hotmail.com',       fmt(daysFromNow(5)),   fmt(daysFromNow(10)),  'confirmed',  8800, 2],
  ['David Chen',        'david.chen@gmail.com',      fmt(daysFromNow(14)),  fmt(daysFromNow(19)),  'confirmed',  7500, 3],
  ['Lisa Brown',        'lisa.b@gmail.com',           fmt(daysFromNow(24)),  fmt(daysFromNow(29)),  'pending',    8000, 2],
  ['Roberto Sánchez',   'roberto.s@gmail.com',       fmt(daysFromNow(34)),  fmt(daysFromNow(39)),  'confirmed',  9200, 4],
];

const insertRes = db.prepare(`
  INSERT INTO reservations (property_id, guest_name, guest_email, check_in, check_out, status, total_price, guests_count)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

for (const r of reservations) {
  insertRes.run(propertyId, ...r);
}

// Messages
const messages = [
  [6, 'guest', 'Hi! We just arrived in Playa del Carmen. What time can we check in?', 0],
  [6, 'host', 'Welcome Pierre! Check-in is at 3pm. I\'ll send you the door code 30 minutes before. Let me know if you need anything!', 1],
  [6, 'guest', 'Perfect, thanks! What\'s the WiFi password?', 0],
  [6, 'host', 'WiFi network: CasaSol_5G, Password: PlayaBeach2026. Enjoy your stay!', 1],
  [7, 'guest', 'Hola! I\'m looking forward to our stay. Is there parking available?', 0],
  [7, 'host', 'Hola Ana! Yes, there\'s one parking spot included. I\'ll send you the details closer to your check-in date.', 0],
  [8, 'guest', 'Hi, can we bring a small dog? She\'s very well behaved.', 0],
  [9, 'guest', 'Hello! Is early check-in possible?', 0],
  [10, 'guest', 'Hi there! Can you recommend good restaurants nearby?', 0],
  [10, 'host', 'Absolutely Roberto! For Mexican food try La Perla on 5th Ave. For seafood, El Fogón is amazing. Both walking distance!', 0],
];

const insertMsg = db.prepare(`
  INSERT INTO messages (property_id, reservation_id, sender, content, is_ai_response)
  VALUES (?, ?, ?, ?, ?)
`);

for (const m of messages) {
  insertMsg.run(propertyId, ...m);
}

// Calendar — generate 90 days from today
const insertCal = db.prepare(`
  INSERT OR REPLACE INTO calendar (property_id, date, price, available, min_nights, notes)
  VALUES (?, ?, ?, ?, ?, ?)
`);

const basePrice = 1500;
const today = new Date();

for (let i = 0; i < 90; i++) {
  const d = new Date(today);
  d.setDate(d.getDate() + i);
  const dateStr = d.toISOString().split('T')[0];
  const dayOfWeek = d.getDay();
  const isWeekend = dayOfWeek === 5 || dayOfWeek === 6;
  const isHoliday = (d.getMonth() === 2 && d.getDate() === 21) ||
                    (d.getMonth() === 3 && d.getDate() >= 6 && d.getDate() <= 12);

  let price = basePrice;
  if (isWeekend) price *= 1.3;
  if (isHoliday) price *= 1.5;
  price = Math.round(price / 50) * 50;

  let available = 1;
  for (const r of reservations) {
    if (r[4] !== 'cancelled' && dateStr >= r[2] && dateStr < r[3]) {
      available = 0;
      break;
    }
  }

  insertCal.run(propertyId, dateStr, price, available, isHoliday ? 3 : isWeekend ? 2 : 1, null);
}

// Reviews (tied to completed reservations)
const reviews = [
  [1, 5, 'Amazing place! Super clean, great location. The host was very responsive.', 'Thank you María! So glad you enjoyed your stay. You\'re welcome back anytime!'],
  [2, 4, 'Nice apartment, good location. AC worked great. Minor issue: hot water was slow in morning.', 'Thanks John! We\'ve since fixed the hot water heater. Hope to see you again!'],
  [3, 5, 'Perfekt! Alles war sauber und modern. Der Rooftop-Pool ist fantastisch.', 'Vielen Dank Sophie! We\'re happy you loved the rooftop pool!'],
  [4, 5, 'Excelente ubicación y muy limpio. El WiFi rápido fue perfecto para trabajar.', '¡Gracias Carlos! Nos encanta recibir nómadas digitales.'],
  [5, 4, 'Lovely stay. The self check-in was smooth. Would have liked more kitchen utensils.', 'Thank you Emma! We\'ve added more kitchen supplies based on your feedback.'],
];

const insertReview = db.prepare(`
  INSERT INTO reviews (property_id, reservation_id, rating, comment, response)
  VALUES (?, ?, ?, ?, ?)
`);

for (const r of reviews) {
  insertReview.run(propertyId, ...r);
}

// Cleaning tasks — dynamic dates matching reservation check-outs
const cleaningTasks = [
  [5, fmt(daysFromNow(-6)),  'completed', 'Deep clean done. Replaced towels and bed linens.'],
  [6, fmt(daysFromNow(2)),   'pending', null],
  [7, fmt(daysFromNow(10)),  'pending', null],
  [8, fmt(daysFromNow(19)),  'pending', null],
  [9, fmt(daysFromNow(29)),  'pending', null],
  [10, fmt(daysFromNow(39)), 'pending', null],
];

const insertClean = db.prepare(`
  INSERT INTO cleaning_tasks (property_id, reservation_id, scheduled_date, status, cleaner_notes)
  VALUES (?, ?, ?, ?, ?)
`);

for (const c of cleaningTasks) {
  insertClean.run(propertyId, ...c);
}

console.log('Database seeded successfully!');
console.log(`  - 1 user (demo@airbnbmanager.com / demo1234)`);
console.log(`  - 1 property (id: ${propertyId})`);
console.log('  - 10 reservations (dynamic dates relative to today)');
console.log('  - 10 messages');
console.log('  - 90 calendar days');
console.log('  - 5 reviews');
console.log('  - 6 cleaning tasks');

db.close();
