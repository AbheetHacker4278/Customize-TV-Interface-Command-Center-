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

  CREATE TABLE IF NOT EXISTS clock_faces (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    style TEXT NOT NULL,
    config TEXT NOT NULL,
    is_default INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// 7 Curated Default Clock Face Presets
const DEFAULT_CLOCK_PRESETS = [
  {
    id: 'zen-minimalist',
    name: 'Zen Minimalist',
    style: 'minimal-digital',
    is_default: 1,
    config: {
      fontFamily: 'Inter',
      fontWeight: '300',
      fontSize: 105,
      letterSpacing: -0.04,
      textColor: '#ffffff',
      useGradient: false,
      gradientColors: ['#ffffff', '#94a3b8'],
      gradientAngle: 135,
      showSeconds: false,
      showAmPm: false,
      is24Hour: false,
      showDate: true,
      showDay: true,
      showMonth: true,
      showYear: true,
      dateFormat: 'EEEE, d MMMM',
      datePosition: 'below',
      dateColor: '#94a3b8',
      dateOpacity: 0.85,
      dateFontSize: 24,
      backgroundMode: 'gradient',
      backgroundColor: '#030712',
      backgroundGradient: 'linear-gradient(135deg, #090d16 0%, #020408 100%)',
      wallpaperUrl: '/wallpapers/glass.jpg',
      overlayOpacity: 0.35,
      backdropBlur: 0,
      vignette: true,
      glow: false,
      glowColor: '#38bdf8',
      glowBlur: 16,
      textShadow: true,
      alignmentH: 'center',
      alignmentV: 'center',
      xOffset: 0,
      yOffset: 0,
      antiBurnIn: true,
    }
  },
  {
    id: 'swiss-luxury-chrono',
    name: 'Swiss Luxury Chrono',
    style: 'analog',
    is_default: 0,
    config: {
      fontFamily: 'Outfit',
      fontWeight: '500',
      fontSize: 90,
      dialSize: 420,
      dialShape: 'circle',
      dialPlateColor: '#0a101f',
      dialPlateGradient: 'radial-gradient(circle, #131e3a 0%, #060a14 100%)',
      showBorder: true,
      dialBorderColor: '#38bdf8',
      dialBorderWidth: 4,
      markerStyle: 'ticks', // 'ticks', 'dots', 'numbers', 'roman', 'minimal'
      markerColor: '#94a3b8',
      markerSize: 14,
      hourColor: '#f8fafc',
      hourWidth: 8,
      hourLength: 60,
      minuteColor: '#38bdf8',
      minuteWidth: 5,
      minuteLength: 82,
      secondColor: '#f97316',
      secondWidth: 2,
      secondLength: 92,
      showSeconds: true,
      sweepMode: 'smooth', // 'smooth' or 'tick'
      pinColor: '#f97316',
      pinSize: 10,
      showDate: true,
      showDay: true,
      showMonth: true,
      showYear: false,
      dateFormat: 'EEE, d MMM',
      datePosition: 'below',
      dateColor: '#94a3b8',
      dateOpacity: 0.9,
      dateFontSize: 20,
      backgroundMode: 'gradient',
      backgroundColor: '#020617',
      backgroundGradient: 'radial-gradient(circle at center, #0b1528 0%, #020617 100%)',
      wallpaperUrl: '/wallpapers/moon-lake.jpg',
      overlayOpacity: 0.45,
      backdropBlur: 0,
      vignette: true,
      glow: false,
      glowColor: '#38bdf8',
      glowBlur: 10,
      textShadow: true,
      alignmentH: 'center',
      alignmentV: 'center',
      xOffset: 0,
      yOffset: 0,
      antiBurnIn: true,
    }
  },
  {
    id: 'retro-split-flap',
    name: 'Retro Split-Flap',
    style: 'flip',
    is_default: 0,
    config: {
      fontFamily: 'Bebas Neue',
      fontWeight: '700',
      fontSize: 115,
      letterSpacing: 0.04,
      cardBg: '#18181b',
      cardTextColor: '#fafafa',
      dividerColor: '#09090b',
      cardRadius: 12,
      cardGap: 16,
      showSeconds: true,
      showAmPm: true,
      is24Hour: false,
      showDate: true,
      showDay: true,
      showMonth: true,
      showYear: true,
      dateFormat: 'EEEE, MMMM d, yyyy',
      datePosition: 'below',
      dateColor: '#e4e4e7',
      dateOpacity: 0.9,
      dateFontSize: 24,
      backgroundMode: 'wallpaper',
      wallpaperUrl: '/wallpapers/golden-coast.jpg',
      backgroundColor: '#09090b',
      backgroundGradient: 'linear-gradient(180deg, #18181b 0%, #09090b 100%)',
      overlayOpacity: 0.7,
      backdropBlur: 4,
      vignette: true,
      glow: false,
      glowColor: '#ffffff',
      glowBlur: 0,
      textShadow: true,
      alignmentH: 'center',
      alignmentV: 'center',
      xOffset: 0,
      yOffset: 0,
      antiBurnIn: true,
    }
  },
  {
    id: 'tokyo-dusk-digital',
    name: 'Tokyo Dusk Modern',
    style: 'modern-digital',
    is_default: 0,
    config: {
      fontFamily: 'Outfit',
      fontWeight: '700',
      fontSize: 125,
      letterSpacing: -0.03,
      textColor: '#ffffff',
      useGradient: true,
      gradientColors: ['#38bdf8', '#c084fc'],
      gradientAngle: 60,
      showSeconds: true,
      showAmPm: true,
      is24Hour: false,
      showDate: true,
      showDay: true,
      showMonth: true,
      showYear: false,
      dateFormat: 'Tuesday 27 October',
      datePosition: 'below',
      dateColor: '#e0f2fe',
      dateOpacity: 0.95,
      dateFontSize: 26,
      pillBadge: true,
      pillBg: 'rgba(15, 23, 42, 0.75)',
      pillBorder: 'rgba(56, 189, 248, 0.35)',
      backgroundMode: 'wallpaper',
      wallpaperUrl: '/wallpapers/fuji.jpg',
      backgroundColor: '#0f172a',
      backgroundGradient: 'linear-gradient(135deg, #1e1b4b 0%, #0f172a 100%)',
      overlayOpacity: 0.45,
      backdropBlur: 0,
      vignette: true,
      glow: true,
      glowColor: '#38bdf8',
      glowBlur: 14,
      textShadow: true,
      alignmentH: 'left',
      alignmentV: 'top',
      xOffset: 90,
      yOffset: 70,
      antiBurnIn: true,
    }
  },
  {
    id: 'cyberpunk-neon-2077',
    name: 'Cyberpunk Neon 2077',
    style: 'futuristic-neon',
    is_default: 0,
    config: {
      fontFamily: 'Orbitron',
      fontWeight: '800',
      fontSize: 120,
      letterSpacing: 0.08,
      textColor: '#00f0ff',
      useGradient: false,
      gradientColors: ['#00f0ff', '#ff0055'],
      gradientAngle: 90,
      showSeconds: true,
      showAmPm: false,
      is24Hour: true,
      showDate: true,
      showDay: true,
      showMonth: true,
      showYear: true,
      dateFormat: 'YYYY.MM.DD // PROTOCOL-7',
      datePosition: 'below',
      dateColor: '#ff0055',
      dateOpacity: 1,
      dateFontSize: 22,
      glow: true,
      glowColor: '#00f0ff',
      glowBlur: 28,
      accentColor: '#ff0055',
      scanlines: true,
      vignette: true,
      backgroundMode: 'gradient',
      backgroundColor: '#030712',
      backgroundGradient: 'radial-gradient(circle at center, #071324 0%, #02040a 100%)',
      wallpaperUrl: '/wallpapers/glass.jpg',
      overlayOpacity: 0.4,
      backdropBlur: 0,
      textShadow: true,
      alignmentH: 'center',
      alignmentV: 'center',
      xOffset: 0,
      yOffset: 0,
      antiBurnIn: true,
    }
  },
  {
    id: 'vogue-editorial',
    name: 'Vogue Haute Horlogerie',
    style: 'minimal-typography',
    is_default: 0,
    config: {
      fontFamily: 'Cinzel',
      fontWeight: '500',
      fontSize: 135,
      letterSpacing: 0.12,
      textColor: '#fef3c7',
      useGradient: true,
      gradientColors: ['#fef3c7', '#d97706'],
      gradientAngle: 90,
      showSeconds: false,
      showAmPm: true,
      is24Hour: false,
      showDate: true,
      showDay: true,
      showMonth: true,
      showYear: true,
      dateFormat: 'MMMM d, yyyy',
      datePosition: 'below',
      dateColor: '#fef3c7',
      dateOpacity: 0.85,
      dateFontSize: 24,
      backgroundMode: 'gradient',
      backgroundColor: '#09090b',
      backgroundGradient: 'linear-gradient(180deg, #18181b 0%, #09090b 100%)',
      wallpaperUrl: '/wallpapers/nature-calm.jpg',
      overlayOpacity: 0.5,
      backdropBlur: 2,
      vignette: true,
      glow: false,
      glowColor: '#d97706',
      glowBlur: 10,
      textShadow: true,
      alignmentH: 'center',
      alignmentV: 'center',
      xOffset: 0,
      yOffset: 0,
      antiBurnIn: true,
    }
  },
  {
    id: 'command-studio-dashboard',
    name: 'Command Studio Dashboard',
    style: 'date-time-dashboard',
    is_default: 0,
    config: {
      fontFamily: 'Space Grotesk',
      fontWeight: '700',
      fontSize: 110,
      letterSpacing: -0.02,
      textColor: '#f8fafc',
      accentColor: '#06b6d4',
      useGradient: false,
      gradientColors: ['#f8fafc', '#94a3b8'],
      gradientAngle: 90,
      showSeconds: true,
      showAmPm: true,
      is24Hour: false,
      showDate: true,
      showDay: true,
      showMonth: true,
      showYear: true,
      dateFormat: 'EEEE, MMMM d, yyyy',
      datePosition: 'below',
      dateColor: '#38bdf8',
      dateOpacity: 0.95,
      dateFontSize: 22,
      cards: {
        showClockCard: true,
        showDateCard: true,
        showSystemPill: true,
        glassBacking: true,
      },
      backgroundMode: 'wallpaper',
      wallpaperUrl: '/wallpapers/dusk-peaks.jpg',
      backgroundColor: '#0a0f1d',
      backgroundGradient: 'linear-gradient(135deg, #0f172a 0%, #020617 100%)',
      overlayOpacity: 0.55,
      backdropBlur: 6,
      vignette: true,
      glow: false,
      glowColor: '#06b6d4',
      glowBlur: 10,
      textShadow: true,
      alignmentH: 'center',
      alignmentV: 'center',
      xOffset: 0,
      yOffset: 0,
      antiBurnIn: true,
    }
  }
];

// Seed presets if empty
const countStmt = db.prepare('SELECT COUNT(*) as count FROM clock_faces');
if (countStmt.get().count === 0) {
  const insertPreset = db.prepare(`
    INSERT INTO clock_faces (id, name, style, config, is_default, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `);
  DEFAULT_CLOCK_PRESETS.forEach(p => {
    insertPreset.run(p.id, p.name, p.style, JSON.stringify(p.config), p.is_default);
  });
}

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

// ---------------- Clock Face Database Helpers ----------------

export function getClockFaces() {
  const rows = db.prepare('SELECT * FROM clock_faces ORDER BY is_default DESC, updated_at DESC').all();
  const activeId = readSetting('active_clock_face_id', 'zen-minimalist');
  return rows.map(r => {
    let parsedConfig = {};
    try {
      parsedConfig = JSON.parse(r.config);
    } catch (e) {
      parsedConfig = {};
    }
    return {
      id: r.id,
      name: r.name,
      style: r.style,
      is_default: Boolean(r.is_default),
      is_active: r.id === activeId,
      config: parsedConfig,
      created_at: r.created_at,
      updated_at: r.updated_at,
    };
  });
}

export function getClockFaceById(id) {
  const row = db.prepare('SELECT * FROM clock_faces WHERE id = ?').get(id);
  if (!row) return null;
  const activeId = readSetting('active_clock_face_id', 'zen-minimalist');
  let parsedConfig = {};
  try {
    parsedConfig = JSON.parse(row.config);
  } catch (e) {
    parsedConfig = {};
  }
  return {
    id: row.id,
    name: row.name,
    style: row.style,
    is_default: Boolean(row.is_default),
    is_active: row.id === activeId,
    config: parsedConfig,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function saveClockFace(id, name, style, config, isDefault = 0) {
  const stmt = db.prepare(`
    INSERT INTO clock_faces (id, name, style, config, is_default, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `);
  stmt.run(id, name, style, JSON.stringify(config), isDefault ? 1 : 0);
  return getClockFaceById(id);
}

export function updateClockFace(id, name, style, config, isDefault = null) {
  if (isDefault !== null) {
    const stmt = db.prepare(`
      UPDATE clock_faces
      SET name = ?, style = ?, config = ?, is_default = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    stmt.run(name, style, JSON.stringify(config), isDefault ? 1 : 0, id);
  } else {
    const stmt = db.prepare(`
      UPDATE clock_faces
      SET name = ?, style = ?, config = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    stmt.run(name, style, JSON.stringify(config), id);
  }
  return getClockFaceById(id);
}

export function deleteClockFace(id) {
  const item = getClockFaceById(id);
  if (item) {
    db.prepare('DELETE FROM clock_faces WHERE id = ?').run(id);
    const activeId = readSetting('active_clock_face_id');
    if (activeId === id) {
      saveSetting('active_clock_face_id', 'zen-minimalist');
    }
  }
  return item;
}

export function getActiveClockFace() {
  let activeId = readSetting('active_clock_face_id', 'zen-minimalist');
  let face = getClockFaceById(activeId);
  if (!face) {
    const all = getClockFaces();
    face = all.length > 0 ? all[0] : null;
    if (face) saveSetting('active_clock_face_id', face.id);
  }
  return face;
}

export function setActiveClockFace(id) {
  const face = getClockFaceById(id);
  if (!face) throw new Error(`Clock face '${id}' does not exist.`);
  saveSetting('active_clock_face_id', id);
  return getClockFaceById(id);
}

export default db;
