const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

function initDatabase(dbPath) {
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  db.exec(schema);

  console.log('Database initialized at', dbPath);
  return db;
}

if (require.main === module) {
  const dbPath = process.env.DB_PATH || path.join(__dirname, 'airbnb.db');
  initDatabase(dbPath);
  console.log('Done.');
}

module.exports = { initDatabase };
