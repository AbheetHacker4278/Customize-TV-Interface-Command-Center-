import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import os from 'os';

import { tvService } from './tvService.js';
import { 
  logAction, 
  getRecentLogs, 
  saveSetting, 
  readSetting, 
  saveRecordingRecord, 
  getRecordings, 
  deleteRecordingRecord
} from './db.js';
import { captureTvScreenshot, execTvShell } from './tvBridge.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

const PORT = process.env.PORT || 5050;

app.use(cors());
app.use(express.json({ limit: '25mb' }));

// Public static shots directory for live TV screen streaming/preview
const shotsDir = path.join(__dirname, 'shots');
if (!fs.existsSync(shotsDir)) fs.mkdirSync(shotsDir, { recursive: true });
app.use('/shots', express.static(shotsDir));

// Public static wallpapers directory for live preset and custom wallpapers
const wallpapersDir = path.join(__dirname, 'public', 'wallpapers');
if (!fs.existsSync(wallpapersDir)) fs.mkdirSync(wallpapersDir, { recursive: true });
app.use('/wallpapers', express.static(wallpapersDir));


// Helper to determine Host IP on the local network (for TV intent access)
export function getHostIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        if (iface.address.startsWith('192.168.')) {
          return iface.address;
        }
      }
    }
  }
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '192.168.29.159';
}

// Saved audio recordings directory on user PC
const recordingsDir = path.join(__dirname, '..', 'recordings');
if (!fs.existsSync(recordingsDir)) fs.mkdirSync(recordingsDir, { recursive: true });
app.use('/recordings', express.static(recordingsDir));

// Serve production client build if exists
const clientDist = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
}

// ---------------- Authentication Middleware ----------------
function authMiddleware(req, res, next) {
  const token = req.headers['x-admin-key'] || req.query.key;
  const adminPassword = readSetting('admin_password', 'bravia2026');
  if (token && token === adminPassword) {
    return next();
  }
  // Allow health checks, initial health/status endpoints
  if (req.path === '/health' || req.path === '/api/auth/verify' || req.path === '/api/status/public') {
    return next();
  }
  res.status(401).json({ error: 'Unauthorized. Please provide valid Dashboard Key.' });
}

// ---------------- REST API Routes ----------------

// Health check for cloud deployment (Render, Fly.io, Railway)
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy', uptime: process.uptime(), timestamp: new Date().toISOString() });
});

// Verify Password
app.post('/api/auth/verify', (req, res) => {
  const { password } = req.body;
  const adminPassword = readSetting('admin_password', 'bravia2026');
  if (password === adminPassword) {
    res.json({ success: true, token: adminPassword });
  } else {
    res.status(401).json({ success: false, error: 'Incorrect dashboard password' });
  }
});

// Update Password
app.post('/api/auth/change-password', authMiddleware, (req, res) => {
  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 4) {
    return res.status(400).json({ error: 'Password must be at least 4 characters' });
  }
  saveSetting('admin_password', newPassword);
  logAction('Security', 'Password Changed', 'Administrator updated dashboard key');
  res.json({ success: true, message: 'Password updated successfully' });
});

// Public connection status (for login screen indicator)
app.get('/api/status/public', (req, res) => {
  res.json({
    connected: tvService.isConnected,
    targetIp: tvService.targetIp,
    model: tvService.deviceInfo.model,
    brand: tvService.deviceInfo.brand,
  });
});

// Full Status & Device Info
app.get('/api/status', authMiddleware, (req, res) => {
  res.json({
    connected: tvService.isConnected,
    deviceInfo: tvService.deviceInfo,
    state: tvService.state,
  });
});

// Target IP configuration
app.post('/api/config/ip', authMiddleware, (req, res) => {
  const { ip } = req.body;
  if (!ip || !/^(\d{1,3}\.){3}\d{1,3}$/.test(ip)) {
    return res.status(400).json({ error: 'Invalid IPv4 address format' });
  }
  tvService.setTargetIp(ip);
  res.json({ success: true, ip });
});

// Remote Key Injection
app.post('/api/remote/key', authMiddleware, async (req, res) => {
  const { key, keyName } = req.body;
  if (!key) return res.status(400).json({ error: 'Keycode is required' });

  try {
    const result = await tvService.sendKeyEvent(key, keyName);
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Text Typing on TV
app.post('/api/remote/text', authMiddleware, async (req, res) => {
  const { text } = req.body;
  if (text === undefined) return res.status(400).json({ error: 'Text required' });

  try {
    await tvService.sendText(text);
    res.json({ success: true, text });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Power Controls
app.post('/api/power', authMiddleware, async (req, res) => {
  const { action } = req.body; // 'toggle', 'sleep', 'wake', 'reboot'
  try {
    if (action === 'sleep') await tvService.powerStandby();
    else if (action === 'wake') await tvService.powerWake();
    else if (action === 'reboot') await tvService.rebootTv();
    else await tvService.powerToggle();

    res.json({ success: true, action });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Volume Controls
app.post('/api/audio/volume', authMiddleware, async (req, res) => {
  const { volume } = req.body;
  try {
    const vol = await tvService.setVolume(volume);
    res.json({ success: true, volume: vol });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/audio/mute', authMiddleware, async (req, res) => {
  try {
    await tvService.toggleMute();
    res.json({ success: true, muted: !tvService.state.muted });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Input Switching
app.post('/api/input/switch', authMiddleware, async (req, res) => {
  const { input } = req.body; // 'HDMI 1', 'HDMI 2', etc.
  try {
    await tvService.switchInput(input);
    res.json({ success: true, input });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// App Management
app.get('/api/apps', authMiddleware, async (req, res) => {
  const defaultCatalog = [
    { pkg: 'com.gathin.tvhome', name: 'Clean Apple TV Launcher', icon: 'Sparkles', category: 'System' },
    { pkg: 'com.google.android.youtube.tv', name: 'YouTube', icon: 'Play', category: 'Streaming' },
    { pkg: 'com.netflix.ninja', name: 'Netflix', icon: 'Film', category: 'Streaming' },
    { pkg: 'com.amazon.amazonvideo.livingroom', name: 'Prime Video', icon: 'Tv', category: 'Streaming' },
    { pkg: 'in.startv.hotstar', name: 'Disney+ Hotstar', icon: 'Star', category: 'Streaming' },
    { pkg: 'com.jio.media.stb.ondemand', name: 'JioCinema', icon: 'Clapperboard', category: 'Streaming' },
    { pkg: 'com.mxtech.videoplayer.television', name: 'MX Player TV', icon: 'Video', category: 'Media Player' },
    { pkg: 'com.jio.media.jiotvplus', name: 'JioTV+', icon: 'Tv', category: 'Live TV' },
    { pkg: 'com.gathin.tvhome.cleaner', name: 'TV Cache Optimizer', icon: 'Trash2', category: 'Utility' },
    { pkg: 'com.android.tv.settings', name: 'Android TV Settings', icon: 'Settings', category: 'System' },
    { pkg: 'com.sony.dtv.tvx', name: 'Live TV & Inputs', icon: 'Radio', category: 'Live TV' },
  ];

  try {
    const raw = await execTvShell(tvService.targetIp, 'pm list packages -3; pm list packages -s | grep -E "youtube|netflix|amazon|hotstar|jio|browser|gallery"', 3500);
    const packages = raw
      .split('\n')
      .map(l => l.replace('package:', '').trim())
      .filter(Boolean);

    if (!packages || packages.length === 0) {
      return res.json({ apps: defaultCatalog, currentApp: tvService.state.currentApp, isOffline: !tvService.isConnected });
    }

    const installed = defaultCatalog.filter(a => packages.includes(a.pkg));
    packages.forEach(pkg => {
      if (!installed.find(a => a.pkg === pkg)) {
        installed.push({ pkg, name: pkg, icon: 'AppWindow', category: 'App' });
      }
    });

    res.json({ apps: installed, currentApp: tvService.state.currentApp });
  } catch (err) {
    console.warn('[Server] Could not query live packages (TV offline or bridge fallback):', err.message);
    res.json({
      apps: defaultCatalog,
      currentApp: tvService.state.currentApp,
      isOffline: true,
      notice: 'TV is offline or unreachable from cloud host. Displaying standard installed catalog.'
    });
  }
});

app.post('/api/apps/launch', authMiddleware, async (req, res) => {
  const { pkg } = req.body;
  try {
    await tvService.launchApp(pkg);
    res.json({ success: true, pkg });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/apps/close', authMiddleware, async (req, res) => {
  const { pkg } = req.body;
  try {
    await tvService.closeApp(pkg);
    res.json({ success: true, pkg });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Display / Brightness
app.post('/api/display/brightness', authMiddleware, async (req, res) => {
  const { brightness } = req.body;
  try {
    const val = await tvService.setBrightness(brightness);
    res.json({ success: true, brightness: val });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Wallpaper Management Routes
app.get('/api/wallpapers/presets', authMiddleware, (req, res) => {
  res.json({ presets: tvService.getWallpaperPresets() });
});

app.post('/api/wallpapers/apply', authMiddleware, async (req, res) => {
  const { presetId, localPath } = req.body;
  try {
    const result = await tvService.applyWallpaper(presetId || localPath);
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/wallpapers/upload', authMiddleware, async (req, res) => {
  const { dataBase64, filename } = req.body;
  if (!dataBase64) return res.status(400).json({ error: 'No image data provided' });
  try {
    const raw = dataBase64.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(raw, 'base64');
    const match = dataBase64.match(/^data:image\/(\w+);base64,/);
    const ext = match && (match[1] === 'png' || match[1] === 'webp') ? match[1] : 'jpg';
    const safeName = `custom_${Date.now()}.${ext}`;
    const dest = path.join(wallpapersDir, safeName);
    fs.writeFileSync(dest, buffer);

    const result = await tvService.applyWallpaper(dest);
    res.json({ success: true, url: `/wallpapers/${safeName}`, id: path.parse(safeName).name, filename: safeName, result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Auto Screen Carousel Routes (5-Min Inactivity Screensaver)
app.get('/api/carousel', authMiddleware, (req, res) => {
  try {
    const config = tvService.getCarouselConfig();
    const presets = tvService.getWallpaperPresets();
    res.json({ success: true, config, presets });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/carousel/apply', authMiddleware, async (req, res) => {
  const { selectedIds } = req.body;
  if (!selectedIds || !Array.isArray(selectedIds)) {
    return res.status(400).json({ error: 'selectedIds array is required' });
  }
  if (selectedIds.length === 0) {
    return res.status(400).json({ error: 'Please select at least 1 image for the carousel' });
  }
  if (selectedIds.length > 5) {
    return res.status(400).json({ error: 'Strict limit: Maximum 5 images are allowed for the carousel' });
  }

  try {
    const result = await tvService.applyCarousel(selectedIds);
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/carousel/preview', authMiddleware, async (req, res) => {
  try {
    const result = await tvService.previewCarousel();
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Audio & Call Recordings Management (Saved Locally on User PC)
app.get('/api/recordings', authMiddleware, (req, res) => {
  try {
    const list = getRecordings().map(r => ({
      ...r,
      url: `/recordings/${r.filename}`,
    }));
    res.json({ success: true, recordings: list });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/recordings/upload', authMiddleware, async (req, res) => {
  const { dataBase64, title, duration = 0, format = 'webm' } = req.body;
  if (!dataBase64) return res.status(400).json({ error: 'No audio data provided' });

  try {
    const raw = dataBase64.replace(/^data:audio\/\w+;base64,/, '');
    const buffer = Buffer.from(raw, 'base64');
    const ext = format === 'mp3' ? 'mp3' : (format === 'wav' ? 'wav' : 'webm');
    const safeName = `rec_${Date.now()}.${ext}`;
    const dest = path.join(recordingsDir, safeName);
    fs.writeFileSync(dest, buffer);

    const recTitle = title || `Audio Recording ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    const id = saveRecordingRecord(recTitle, safeName, dest, Math.round(duration), buffer.length, ext);

    logAction('Audio', 'Saved Audio Recording', `${recTitle} (${Math.round(buffer.length / 1024)} KB)`);
    res.json({
      success: true,
      recording: {
        id,
        title: recTitle,
        filename: safeName,
        url: `/recordings/${safeName}`,
        duration,
        size: buffer.length,
        created_at: new Date().toISOString(),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/recordings/:id', authMiddleware, (req, res) => {
  const { id } = req.params;
  try {
    const rec = deleteRecordingRecord(id);
    if (rec && rec.filepath && fs.existsSync(rec.filepath)) {
      try { fs.unlinkSync(rec.filepath); } catch (e) {}
    }
    logAction('Audio', 'Deleted Audio Recording', rec ? rec.title : `ID ${id}`);
    res.json({ success: true, message: 'Recording removed' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Auto Cache Cleaner Action
app.post('/api/maintenance/clean-cache', authMiddleware, async (req, res) => {
  try {
    const result = await tvService.runAutoCacheClean();
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Live Screen Mirror Snapshot
app.get('/api/screen/snapshot', authMiddleware, async (req, res) => {
  const fileName = `tv_preview_${Date.now()}.png`;
  const destPath = path.join(shotsDir, fileName);

  try {
    await captureTvScreenshot(tvService.targetIp, destPath);
    // Cleanup old files in shots
    fs.readdir(shotsDir, (err, files) => {
      if (files) {
        files.forEach(f => {
          if (f !== fileName && f.endsWith('.png')) {
            try { fs.unlinkSync(path.join(shotsDir, f)); } catch (e) {}
          }
        });
      }
    });

    res.json({ success: true, url: `/shots/${fileName}?t=${Date.now()}` });
  } catch (err) {
    console.warn('[Server] Screen snapshot failed (TV offline or bridge error):', err.message);
    const defaultShot = path.join(__dirname, '..', 'docs', 'images', 'tv-home-clean-dock.png');
    const fallbackFile = 'current_tv_screen.png';
    const fallbackPath = path.join(shotsDir, fallbackFile);
    if (fs.existsSync(defaultShot) && !fs.existsSync(fallbackPath)) {
      try { fs.copyFileSync(defaultShot, fallbackPath); } catch (e) {}
    }
    if (fs.existsSync(fallbackPath)) {
      return res.json({ success: true, url: `/shots/${fallbackFile}?t=${Date.now()}`, isOffline: true });
    }
    res.json({ success: false, isOffline: true, error: 'TV is currently offline or unreachable from cloud host.' });
  }
});

// Action Logs
app.get('/api/logs', authMiddleware, (req, res) => {
  res.json({ logs: getRecentLogs(60) });
});

// Raw ADB terminal runner (for power users)
app.post('/api/terminal/exec', authMiddleware, async (req, res) => {
  const { command } = req.body;
  if (!command) return res.status(400).json({ error: 'Command required' });
  try {
    logAction('Terminal', 'Custom ADB Shell', command);
    const output = await execTvShell(tvService.targetIp, command, 8000);
    res.json({ success: true, output });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Fallback for React SPA router
app.get('{*path}', (req, res) => {
  const indexPath = path.join(clientDist, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.send(`<h1>Smart TV Control Center API Server</h1><p>Running on port ${PORT}. Client is running on Vite dev server (port 5173).</p>`);
  }
});

// ---------------- Real-Time Socket.IO Synchronization ----------------
io.on('connection', (socket) => {
  // Send immediate state snapshot
  socket.emit('state_snapshot', {
    connected: tvService.isConnected,
    deviceInfo: tvService.deviceInfo,
    state: tvService.state,
  });

  // Client requests remote key
  socket.on('send_key', async (data) => {
    try {
      await tvService.sendKeyEvent(data.keyCode, data.name);
      socket.emit('key_ack', { success: true, keyCode: data.keyCode });
    } catch (e) {
      socket.emit('key_ack', { success: false, error: e.message });
    }
  });

  // Client requests text input
  socket.on('send_text', async (data) => {
    try {
      await tvService.sendText(data.text);
      socket.emit('text_ack', { success: true });
    } catch (e) {
      socket.emit('text_ack', { success: false, error: e.message });
    }
  });

});

// Broadcast TV service events to all connected web clients
tvService.on('state_updated', (state) => {
  io.emit('state_updated', state);
});

tvService.on('connection_changed', (info) => {
  io.emit('connection_changed', info);
});

tvService.on('device_info', (info) => {
  io.emit('device_info', info);
});

// Link socket.io instance for connection-aware polling
tvService.setIo(io);

// Start TV polling service and HTTP server
tvService.start();

server.listen(PORT, '0.0.0.0', () => {
  console.log(`=======================================================`);
  console.log(`Smart TV Control Center backend running at:`);
  console.log(`  Local:   http://localhost:${PORT}`);
  console.log(`  Network: http://192.168.29.159:${PORT}`);
  console.log(`Target TV: ${tvService.targetIp} (Sony BRAVIA 4K)`);
  console.log(`=======================================================`);
});
