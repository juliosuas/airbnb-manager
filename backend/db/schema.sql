CREATE TABLE IF NOT EXISTS property (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  address TEXT,
  description TEXT,
  amenities TEXT, -- JSON array
  house_rules TEXT,
  max_guests INTEGER DEFAULT 4,
  bedrooms INTEGER DEFAULT 1,
  bathrooms INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS reservations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guest_name TEXT NOT NULL,
  guest_email TEXT,
  check_in DATE NOT NULL,
  check_out DATE NOT NULL,
  status TEXT DEFAULT 'confirmed', -- confirmed, pending, cancelled, completed
  total_price REAL,
  guests_count INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reservation_id INTEGER,
  sender TEXT NOT NULL, -- 'guest' or 'host'
  content TEXT NOT NULL,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  is_read INTEGER DEFAULT 0,
  is_ai_response INTEGER DEFAULT 0,
  FOREIGN KEY (reservation_id) REFERENCES reservations(id)
);

CREATE TABLE IF NOT EXISTS calendar (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date DATE NOT NULL UNIQUE,
  price REAL,
  available INTEGER DEFAULT 1,
  min_nights INTEGER DEFAULT 1,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reservation_id INTEGER,
  rating INTEGER CHECK(rating >= 1 AND rating <= 5),
  comment TEXT,
  response TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (reservation_id) REFERENCES reservations(id)
);

CREATE TABLE IF NOT EXISTS cleaning_tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reservation_id INTEGER,
  scheduled_date DATE NOT NULL,
  status TEXT DEFAULT 'pending', -- pending, in_progress, completed
  cleaner_notes TEXT,
  FOREIGN KEY (reservation_id) REFERENCES reservations(id)
);
