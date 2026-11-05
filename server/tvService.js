import EventEmitter from 'events';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { execTvShell, pushTvWallpaper, pushTvCarouselImages, launchTvCarouselPreview } from './tvBridge.js';
import { logAction, saveSetting, readSetting } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class TvService extends EventEmitter {
  constructor() {
    super();
    this.targetIp = readSetting('tv_target_ip', '192.168.29.29');
    this.isConnected = false;
    this.isPolling = false;
    this.pollIntervalMs = 20000; // Efficient, low-overhead sync interval
    this.io = null;
    this.deviceInfo = {
      model: 'BRAVIA 4K GB ATV3',
      brand: 'Sony',
      androidVersion: '9 (Pie)',
      ip: this.targetIp,
      mac: '',
      resolution: '1920x1080 (4K display)',
      refreshRate: '60 Hz',
      density: '320',
      uptime: '0h',
    };
    this.state = {
      power: 'AWAKE',
      volume: 40,
      muted: false,
      currentApp: 'com.gathin.tvhome',
      currentAppLabel: 'Home',
      currentInput: 'HDMI 1',
      activeInputs: ['HDMI 1', 'HDMI 2', 'HDMI 3', 'HDMI 4', 'AV'],
      brightness: 255,
      pictureMode: 'Standard',
      soundMode: 'Cinema',
      wifiSsid: 'GOSNEER 5G',
      wifiRssi: -54,
      ramUsage: { used: '1.3 GB', total: '2.0 GB', percent: 65 },
      storageUsage: { free: '5.1 GB', total: '8.2 GB', percent: 38 },
      dnsMode: 'hostname (AdGuard DNS)',
      lastSync: new Date().toISOString(),
    };
  }

  setTargetIp(ip) {
    if (ip && ip !== this.targetIp) {
      this.targetIp = ip;
      saveSetting('tv_target_ip', ip);
      this.deviceInfo.ip = ip;
      this.pollState();
    }
  }

  setIo(io) {
    this.io = io;
  }

  start() {
    console.log(`Starting TV sync monitor for ${this.targetIp}...`);
    this.pollState();
    this.pollTimer = setInterval(() => this.pollState(), this.pollIntervalMs);
  }

  stop() {
    if (this.pollTimer) clearInterval(this.pollTimer);
  }

  async pollState() {
    if (this.isPolling) return;
    // When no web clients are watching the dashboard, skip continuous polling to keep TV CPU at 0%
    if (this.io && this.io.engine && this.io.engine.clientsCount === 0) {
      return;
    }
    this.isPolling = true;

    try {
      // 1. Lightweight probe: power, audio & active activity (no dumpsys window locks!)
      const res = await execTvShell(
        this.targetIp,
        "dumpsys power | grep -E 'mWakefulness='; dumpsys audio | grep -A 5 -i 'STREAM_MUSIC:'; dumpsys activity activities | grep -E 'mResumedActivity'",
        3000
      );

      const wasConnected = this.isConnected;
      this.isConnected = true;

      if (!wasConnected) {
        logAction('System', 'TV Connected', `Target ${this.targetIp} is online and responsive`);
        this.emit('connection_changed', { connected: true, ip: this.targetIp });
        this.fetchFullDeviceInfo();
      }

      // Parse power
      if (res.includes('mWakefulness=Awake')) {
        this.state.power = 'AWAKE';
      } else if (res.includes('mWakefulness=Asleep') || res.includes('mWakefulness=Dozing')) {
        this.state.power = 'STANDBY';
      }

      // Parse Volume
      const volMatch = res.match(/STREAM_MUSIC:[\s\S]*?Current:.*?speaker\):\s*(\d+)/i) ||
                       res.match(/STREAM_MUSIC:[\s\S]*?Current:.*?: (\d+)/i);
      if (volMatch) {
        this.state.volume = parseInt(volMatch[1], 10);
      }
      this.state.muted = /STREAM_MUSIC:[\s\S]*?Muted:\s*true/i.test(res);

      // Parse Current App (lightweight from ActivityManager without WindowManager global lock)
      const actMatch = res.match(/mResumedActivity:\s*ActivityRecord\{[0-9a-f]+\s+u0\s+([^\/]+)\/([^\s\}]+)/i);
      if (actMatch) {
        const pkg = actMatch[1];
        this.state.currentApp = pkg;
        this.state.currentAppLabel = this.friendlyAppLabel(pkg);
      }

      this.state.lastSync = new Date().toISOString();
      this.emit('state_updated', this.state);

    } catch (err) {
      if (this.isConnected) {
        this.isConnected = false;
        logAction('System', 'TV Disconnected', `Communication lost with ${this.targetIp}`, 'warning');
        this.emit('connection_changed', { connected: false, ip: this.targetIp });
      }
    } finally {
      this.isPolling = false;
    }
  }

  async fetchFullDeviceInfo() {
    try {
      const probe = await execTvShell(
        this.targetIp,
        "getprop ro.product.model; getprop ro.product.manufacturer; getprop ro.build.version.release; wm size; dumpsys display | grep -E 'real|mBaseDisplayInfo'; ip addr show wlan0 | grep 'inet '",
        4000
      );
      const lines = probe.split('\n').map(l => l.trim()).filter(Boolean);
      if (lines.length > 0) this.deviceInfo.model = lines[0];
      if (lines.length > 1) this.deviceInfo.brand = lines[1];
      if (lines.length > 2) this.deviceInfo.androidVersion = lines[2];
      
      const resMatch = probe.match(/(\d{3,4})x(\d{3,4})/);
      if (resMatch) {
        this.deviceInfo.resolution = `${resMatch[1]}x${resMatch[2]} (Native 4K Panel)`;
      }

      this.emit('device_info', this.deviceInfo);
    } catch (e) {
      console.warn('Failed to fetch full device info:', e.message);
    }
  }

  friendlyAppLabel(pkg) {
    const map = {
      'com.gathin.tvhome': 'Apple TV Clean Launcher',
      'com.google.android.youtube.tv': 'YouTube',
      'com.netflix.ninja': 'Netflix',
      'com.amazon.amazonvideo.livingroom': 'Prime Video',
      'in.startv.hotstar': 'Disney+ Hotstar',
      'com.jio.media.stb.ondemand': 'JioCinema',
      'com.mxtech.videoplayer.television': 'MX Player TV',
      'com.android.tv.settings': 'TV Settings',
      'com.sony.dtv.tvx': 'Live TV & Inputs',
    };
    return map[pkg] || pkg;
  }

  // Remote keypress execution (ultra-reliable, normalized key mapping)
  async sendKeyEvent(keyCode, keyName = '') {
    logAction('Remote', `Key: ${keyName || keyCode}`, `Injected keyevent ${keyCode}`);

    // Standardized key map: handles numbers, strings, and named keys
    const KEY_MAP = {
      'KEYCODE_DPAD_UP': 19, 'Up': 19, 'UP': 19, 19: 19,
      'KEYCODE_DPAD_DOWN': 20, 'Down': 20, 'DOWN': 20, 20: 20,
      'KEYCODE_DPAD_LEFT': 21, 'Left': 21, 'LEFT': 21, 21: 21,
      'KEYCODE_DPAD_RIGHT': 22, 'Right': 22, 'RIGHT': 22, 22: 22,
      'KEYCODE_DPAD_CENTER': 23, 'OK': 23, 'Center': 23, 23: 23,
      'KEYCODE_BACK': 4, 'Back': 4, 'BACK': 4, 4: 4,
      'KEYCODE_HOME': 3, 'Home': 3, 'HOME': 3, 3: 3,
      'KEYCODE_SETTINGS': 176, 'Settings': 176, 176: 176,
      'KEYCODE_MENU': 82, 'Menu': 82, 82: 82,
      'KEYCODE_POWER': 26, 'Power': 26, 26: 26,
      'KEYCODE_VOLUME_UP': 24, 24: 24,
      'KEYCODE_VOLUME_DOWN': 25, 25: 25,
      'KEYCODE_VOLUME_MUTE': 164, 164: 164,
      'KEYCODE_MEDIA_PLAY_PAUSE': 85, 85: 85,
      'KEYCODE_MEDIA_STOP': 86, 86: 86,
      'KEYCODE_MEDIA_REWIND': 89, 89: 89,
      'KEYCODE_MEDIA_FAST_FORWARD': 90, 90: 90,
      'KEYCODE_TV_INPUT': 178, 'Input': 178, 178: 178,
      'KEYCODE_VOICE_ASSIST': 231, 'Voice': 231, 'Mic': 231, 'Assistant': 231, 231: 231,
      'KEYCODE_SEARCH': 84, 'Search': 84, 84: 84,
    };

    const code = KEY_MAP[keyCode] || KEY_MAP[keyName] || keyCode;

    let cmd;
    if (code === 3 || keyName === 'Home' || keyCode === 'KEYCODE_HOME') {
      // Force return to Home launcher across any app or modal dialog
      cmd = 'am start -a android.intent.action.MAIN -c android.intent.category.HOME; input keyevent 3';
    } else if (code === 176 || keyName === 'Settings' || keyCode === 'KEYCODE_SETTINGS') {
      cmd = 'am start -a android.settings.SETTINGS';
    } else {
      cmd = `input keyevent ${code}`;
    }

    return await execTvShell(this.targetIp, cmd, 3000);
  }

  // Type text directly
  async sendText(text) {
    logAction('Remote', 'Type Text', text);
    // Escape spaces as %s for Android input text
    const escaped = text.replace(/ /g, '%s').replace(/['"]/g, '');
    return await execTvShell(this.targetIp, `input text "${escaped}" &`, 2500);
  }

  // Wallpaper Management
  getWallpaperPresets() {
    const presets = [
      { id: 'fuji', name: 'Mount Fuji Sunset', description: 'Scenic dusk twilight with Mount Fuji and cherry blossom veranda', url: '/wallpapers/fuji.jpg' },
      { id: 'aurora', name: 'Northern Lights Aurora', description: 'Vibrant celestial emerald aurora over tranquil Nordic night', url: '/wallpapers/aurora.jpg' },
      { id: 'dusk-peaks', name: 'Dusk Mountain Peaks', description: 'Minimalist mountain silhouette bathed in warm sunset hues', url: '/wallpapers/dusk-peaks.jpg' },
      { id: 'golden-coast', name: 'Golden Coast Horizon', description: 'Sun setting over gentle ocean waves and evening dunes', url: '/wallpapers/golden-coast.jpg' },
      { id: 'moon-lake', name: 'Moonlit Serene Lake', description: 'Still lake waters reflecting a luminous crescent moon', url: '/wallpapers/moon-lake.jpg' },
      { id: 'above-clouds', name: 'Above The Clouds', description: 'Dreamy pastel clouds above high altitude sunset vistas', url: '/wallpapers/above-clouds.jpg' },
      { id: 'city-lights', name: 'Cyberpunk Metropolis', description: 'Neon skyline glow of futuristic city streets and towers', url: '/wallpapers/city-lights.jpg' },
      { id: 'autumn-valley', name: 'Golden Autumn Valley', description: 'Warm amber and gold fall foliage nestled in serene valleys', url: '/wallpapers/autumn-valley.jpg' },
      { id: 'nature-calm', name: 'Forest Foliage & Mist', description: 'Lush tropical greenery with atmospheric morning mist', url: '/wallpapers/nature-calm.jpg' },
      { id: 'glass', name: 'Minimal Crystal Glass', description: 'Clean geometric horizon with subtle frosted glass refraction', url: '/wallpapers/glass.jpg' },
    ];

    // Scan for user uploaded custom wallpapers
    const presetsDir = path.join(__dirname, 'public', 'wallpapers');
    if (fs.existsSync(presetsDir)) {
      try {
        const files = fs.readdirSync(presetsDir);
        const customFiles = files
          .filter(f => f.startsWith('custom_') && (f.endsWith('.jpg') || f.endsWith('.jpeg') || f.endsWith('.png') || f.endsWith('.webp')))
          .sort((a, b) => {
            const statA = fs.statSync(path.join(presetsDir, a));
            const statB = fs.statSync(path.join(presetsDir, b));
            return statB.mtimeMs - statA.mtimeMs;
          });

        customFiles.forEach((file, index) => {
          const id = path.parse(file).name;
          presets.push({
            id,
            name: `Custom Wallpaper #${customFiles.length - index}`,
            description: `User uploaded image file (${file})`,
            url: `/wallpapers/${file}`,
            isCustom: true,
            filename: file,
          });
        });
      } catch (e) {
        console.warn('Failed to scan custom wallpapers:', e.message);
      }
    }

    return presets;
  }

  async applyWallpaper(presetIdOrPath) {
    const presetsDir = path.join(__dirname, 'public', 'wallpapers');
    let localPath = presetIdOrPath;

    // Check if preset ID or custom filename in presetsDir
    const presetFileJpg = path.join(presetsDir, `${presetIdOrPath}.jpg`);
    const presetFilePng = path.join(presetsDir, `${presetIdOrPath}.png`);
    const directFile = path.join(presetsDir, presetIdOrPath);

    if (fs.existsSync(presetFileJpg)) {
      localPath = presetFileJpg;
    } else if (fs.existsSync(presetFilePng)) {
      localPath = presetFilePng;
    } else if (fs.existsSync(directFile)) {
      localPath = directFile;
    }

    if (!fs.existsSync(localPath)) {
      throw new Error(`Wallpaper file not found: ${localPath}`);
    }

    logAction('Wallpaper', 'Apply Wallpaper', `Applied Home wallpaper: ${path.basename(localPath)}`);
    const res = await pushTvWallpaper(this.targetIp, localPath);
    this.state.currentWallpaper = path.basename(localPath);
    saveSetting('current_home_wallpaper', path.basename(localPath));
    this.emit('state_updated', this.state);
    return res;
  }

  // Auto Screen Carousel (5-Min Inactivity Screensaver)
  getCarouselConfig() {
    const raw = readSetting('carousel_selected_ids', '["fuji","aurora","golden-coast","autumn-valley","nature-calm"]');
    let selectedIds = [];
    try {
      selectedIds = JSON.parse(raw);
    } catch (e) {
      selectedIds = ['fuji', 'aurora', 'golden-coast', 'autumn-valley', 'nature-calm'];
    }
    return {
      selectedIds,
      idleMinutes: 5,
      maxAllowed: 5,
      intervalSeconds: 18,
    };
  }

  async applyCarousel(selectedIds) {
    if (!Array.isArray(selectedIds) || selectedIds.length === 0) {
      throw new Error('Please select at least 1 image for the carousel.');
    }
    if (selectedIds.length > 5) {
      throw new Error('Strict limit: Only 5 images are allowed for the carousel.');
    }

    const presets = this.getWallpaperPresets();
    const presetsDir = path.join(__dirname, 'public', 'wallpapers');
    const imageEntries = [];

    for (const id of selectedIds) {
      const preset = presets.find(p => p.id === id);
      if (preset) {
        const localPath = path.join(presetsDir, `${preset.id}.jpg`);
        if (fs.existsSync(localPath)) {
          imageEntries.push({
            id: preset.id,
            name: preset.name,
            localPath,
          });
        }
      } else {
        // Custom uploaded image file check
        const cleanName = path.basename(id);
        const customPath = path.join(presetsDir, cleanName);
        if (fs.existsSync(customPath)) {
          imageEntries.push({
            id: path.parse(cleanName).name,
            name: cleanName,
            localPath: customPath,
          });
        }
      }
    }

    if (imageEntries.length === 0) {
      throw new Error('None of the selected images were found on the server.');
    }

    logAction('Carousel', 'Apply 5-Min Carousel', `Configured ${imageEntries.length} images for 5m idle screensaver`);
    const res = await pushTvCarouselImages(this.targetIp, imageEntries);
    saveSetting('carousel_selected_ids', JSON.stringify(selectedIds));
    this.emit('carousel_updated', { selectedIds, idleMinutes: 5 });
    return res;
  }

  async previewCarousel() {
    logAction('Carousel', 'Preview Carousel', 'Triggered instant carousel preview on Sony TV');
    return await launchTvCarouselPreview(this.targetIp);
  }

  // Volume controls
  async setVolume(vol) {
    const clamped = Math.max(0, Math.min(100, parseInt(vol, 10)));
    logAction('Audio', 'Set Volume', `${clamped}/100`);
    this.state.volume = clamped;
    this.emit('state_updated', this.state);
    await execTvShell(this.targetIp, `media volume --stream 3 --set ${clamped} &`, 2000);
    return clamped;
  }

  async toggleMute() {
    this.state.muted = !this.state.muted;
    this.emit('state_updated', this.state);
    logAction('Audio', 'Toggle Mute', `Muted: ${this.state.muted}`);
    await execTvShell(this.targetIp, `input keyevent KEYCODE_VOLUME_MUTE &`, 2000);
  }

  // Power actions
  async powerToggle() {
    logAction('Power', 'Power Toggle', '');
    await execTvShell(this.targetIp, `input keyevent KEYCODE_POWER`);
    setTimeout(() => this.pollState(), 500);
  }

  async powerStandby() {
    logAction('Power', 'Sleep / Standby', '');
    await execTvShell(this.targetIp, `input keyevent KEYCODE_SLEEP`);
    setTimeout(() => this.pollState(), 500);
  }

  async powerWake() {
    logAction('Power', 'Wake TV', '');
    await execTvShell(this.targetIp, `input keyevent KEYCODE_WAKEUP`);
    setTimeout(() => this.pollState(), 500);
  }

  async rebootTv() {
    logAction('System', 'Reboot TV', 'Reboot initiated from web console', 'warning');
    return await execTvShell(this.targetIp, `reboot`);
  }

  // App launcher
  async launchApp(pkg) {
    logAction('App', 'Launch App', pkg);
    let cmd = `monkey -p ${pkg} -c android.intent.category.LEANBACK_LAUNCHER 1`;
    if (pkg === 'com.gathin.tvhome') {
      cmd = `am start -a android.intent.action.MAIN -c android.intent.category.HOME`;
    }
    const res = await execTvShell(this.targetIp, cmd);
    setTimeout(() => this.pollState(), 500);
    return res;
  }

  async closeApp(pkg) {
    logAction('App', 'Force Stop App', pkg);
    const res = await execTvShell(this.targetIp, `am force-stop ${pkg}`);
    setTimeout(() => this.pollState(), 300);
    return res;
  }

  // Input switching (Sony BRAVIA TV input manager)
  async switchInput(inputName) {
    logAction('Input', 'Switch Input', inputName);
    const inputMapping = {
      'HDMI 1': 'input keyevent 243', // KEYCODE_TV_INPUT_HDMI_1
      'HDMI 2': 'input keyevent 244', // KEYCODE_TV_INPUT_HDMI_2
      'HDMI 3': 'input keyevent 245', // KEYCODE_TV_INPUT_HDMI_3
      'HDMI 4': 'input keyevent 246', // KEYCODE_TV_INPUT_HDMI_4
      'AV': 'input keyevent 247',     // KEYCODE_TV_INPUT_COMPOSITE_1
      'Inputs Menu': 'input keyevent KEYCODE_TV_INPUT',
    };

    const cmd = inputMapping[inputName] || 'input keyevent KEYCODE_TV_INPUT';
    await execTvShell(this.targetIp, cmd);
    this.state.currentInput = inputName;
    this.emit('state_updated', this.state);
  }

  // Picture & Display adjustments
  async setBrightness(val) {
    const clamped = Math.max(0, Math.min(255, parseInt(val, 10)));
    logAction('Display', 'Set Screen Brightness', `${clamped}/255`);
    await execTvShell(this.targetIp, `settings put system screen_brightness ${clamped}`);
    this.state.brightness = clamped;
    this.emit('state_updated', this.state);
    return clamped;
  }

  // Auto clean cache action
  async runAutoCacheClean() {
    logAction('Maintenance', 'Run Auto Cache Cleaner', 'Invoked from web dashboard');
    // Start CleanerActivity on TV
    await execTvShell(this.targetIp, `am start -n com.gathin.tvhome/.CleanerActivity`);
    setTimeout(() => this.pollState(), 800);
    return { success: true, message: 'Auto Cache Cleaner launched on Sony TV' };
  }
}

export const tvService = new TvService();
export default tvService;
