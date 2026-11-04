import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, 'control_center.db');
const db = new Database(dbPath);

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS action_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source TEXT,
    action TEXT,
    details TEXT,
    status TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS tv_devices (
    ip TEXT PRIMARY KEY,
    name TEXT,
    model TEXT,
    brand TEXT,
    android_version TEXT,
    mac TEXT,
    last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_connected INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS recordings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    filename TEXT,
    filepath TEXT,
    duration INTEGER DEFAULT 0,
    size INTEGER DEFAULT 0,
    format TEXT DEFAULT 'webm',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

`);


// Insert default credentials & configuration if not present
const getSetting = db.prepare('SELECT value FROM settings WHERE key = ?');
const setSetting = db.prepare('INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)');

if (!getSetting.get('admin_password')) {
  setSetting.run('admin_password', 'bravia2026'); // Default dashboard password
}

if (!getSetting.get('tv_target_ip')) {
  setSetting.run('tv_target_ip', '192.168.29.29');
}

export function logAction(source, action, details, status = 'success') {
  try {
    const insert = db.prepare('INSERT INTO action_logs (source, action, details, status) VALUES (?, ?, ?, ?)');
    insert.run(source, action, typeof details === 'object' ? JSON.stringify(details) : String(details), status);
  } catch (e) {
    console.error('Error logging action:', e);
  }
}

export function getRecentLogs(limit = 50) {
  return db.prepare('SELECT * FROM action_logs ORDER BY id DESC LIMIT ?').all(limit);
}

export function saveSetting(key, val) {
  setSetting.run(key, typeof val === 'object' ? JSON.stringify(val) : String(val));
}

export function readSetting(key, defaultVal = null) {
  const row = getSetting.get(key);
  return row ? row.value : defaultVal;
}

export function saveRecordingRecord(title, filename, filepath, duration = 0, size = 0, format = 'webm') {
  const stmt = db.prepare('INSERT INTO recordings (title, filename, filepath, duration, size, format) VALUES (?, ?, ?, ?, ?, ?)');
  const res = stmt.run(title, filename, filepath, duration, size, format);
  return res.lastInsertRowid;
}

export function getRecordings() {
  return db.prepare('SELECT * FROM recordings ORDER BY id DESC').all();
}

export function deleteRecordingRecord(id) {
  const row = db.prepare('SELECT * FROM recordings WHERE id = ?').get(id);
  if (row) {
    db.prepare('DELETE FROM recordings WHERE id = ?').run(id);
  }
  return row;
}

export default db;
