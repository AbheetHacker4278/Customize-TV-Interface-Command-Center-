import { spawn } from 'child_process';
import net from 'net';
import path from 'path';
import { fileURLToPath } from 'url';

// CleanYourTV python virtual environment & bridge
const PYTHON_PATH = 'C:\\Users\\Admin\\.gemini\\antigravity\\scratch\\cleanyourtv\\tools\\venv\\Scripts\\python.exe';
const TV_PY_PATH = 'C:\\Users\\Admin\\.gemini\\antigravity\\scratch\\cleanyourtv\\tools\\tv.py';
const ADB_DAEMON_PATH = 'C:\\Users\\Admin\\.gemini\\antigravity\\scratch\\tv-control-center\\server\\adbDaemon.py';

const DAEMON_PORT = 5055;
const DAEMON_HOST = '127.0.0.1';

let daemonSocket = null;
let isConnecting = false;
let daemonProcess = null;
let reqCounter = 0;
const pendingRequests = new Map(); // id -> { resolve, reject, timer }

/**
 * Ensures adbDaemon.py is running
 */
function ensureDaemonRunning() {
  if (daemonProcess) return;

  try {
    daemonProcess = spawn(PYTHON_PATH, [ADB_DAEMON_PATH], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    });
    daemonProcess.unref();

    daemonProcess.on('exit', () => {
      daemonProcess = null;
    });
  } catch (err) {
    console.warn('[tvBridge] Could not auto-spawn adbDaemon:', err.message);
  }
}

/**
 * Get or establish a persistent connection to the ADB daemon
 */
function getDaemonSocket() {
  return new Promise((resolve) => {
    if (daemonSocket && !daemonSocket.destroyed) {
      return resolve(daemonSocket);
    }

    if (isConnecting) {
      const waitTimer = setInterval(() => {
        if (daemonSocket && !daemonSocket.destroyed) {
          clearInterval(waitTimer);
          resolve(daemonSocket);
        }
      }, 30);
      setTimeout(() => {
        clearInterval(waitTimer);
        resolve(null);
      }, 1500);
      return;
    }

    isConnecting = true;
    ensureDaemonRunning();

    let client = null;
    let connectAttempts = 0;

    const tryConnect = () => {
      connectAttempts++;
      client = net.createConnection({ port: DAEMON_PORT, host: DAEMON_HOST }, () => {
        isConnecting = false;
        daemonSocket = client;
        console.log('[tvBridge] Connected to persistent ADB daemon on port', DAEMON_PORT);
        resolve(daemonSocket);
      });

      let buffer = '';
      client.on('data', (chunk) => {
        buffer += chunk.toString('utf-8');
        while (buffer.includes('\n')) {
          const idx = buffer.indexOf('\n');
          const line = buffer.slice(0, idx).trim();
          buffer = buffer.slice(idx + 1);
          if (!line) continue;

          try {
            const res = JSON.parse(line);
            const req = pendingRequests.get(String(res.id));
            if (req) {
              clearTimeout(req.timer);
              pendingRequests.delete(String(res.id));
              if (res.success) {
                req.resolve(res.output || '');
              } else {
                req.reject(new Error(res.error || 'ADB command failed'));
              }
            }
          } catch (e) {
            console.error('[tvBridge] JSON parse error from daemon:', e);
          }
        }
      });

      client.on('error', (err) => {
        daemonSocket = null;
        if (isConnecting && connectAttempts < 3) {
          setTimeout(tryConnect, 200);
        } else {
          isConnecting = false;
          resolve(null);
        }
      });

      client.on('close', () => {
        daemonSocket = null;
        isConnecting = false;
        // Reject all pending requests
        for (const [id, req] of pendingRequests.entries()) {
          clearTimeout(req.timer);
          req.reject(new Error('Persistent ADB daemon connection closed'));
        }
        pendingRequests.clear();
      });
    };

    tryConnect();
  });
}

/**
 * Execute command on the TV via the high-speed persistent Python adb-shell bridge
 * Falls back to subprocess spawn if persistent daemon is unreachable.
 * @param {string} tvIp 
 * @param {string} command 
 * @param {number} timeoutMs 
 * @returns {Promise<string>}
 */
export async function execTvShell(tvIp, command, timeoutMs = 6000) {
  // Check if persistent daemon is available
  try {
    const socket = await getDaemonSocket();
    if (socket && !socket.destroyed) {
      return new Promise((resolve, reject) => {
        reqCounter = (reqCounter + 1) % 1000000;
        const id = String(reqCounter);

        const timer = setTimeout(() => {
          pendingRequests.delete(id);
          reject(new Error(`Timeout executing TV command after ${timeoutMs}ms: ${command}`));
        }, timeoutMs);

        pendingRequests.set(id, { resolve, reject, timer });

        const payload = JSON.stringify({ id, cmd: command }) + '\n';
        socket.write(payload);
      });
    }
  } catch (err) {
    console.warn('[tvBridge] Daemon execution failed, falling back to spawn:', err.message);
  }

  // Fallback to direct process spawn if daemon socket not ready
  return new Promise((resolve, reject) => {
    const env = { ...process.env, TV_HOST: tvIp };
    
    const proc = spawn(PYTHON_PATH, [TV_PY_PATH, command], {
      env,
      windowsHide: true,
    });

    let stdout = '';
    let stderr = '';
    let finished = false;

    const timer = setTimeout(() => {
      if (!finished) {
        finished = true;
        try { proc.kill('SIGKILL'); } catch (e) {}
        reject(new Error(`Timeout executing TV command fallback after ${timeoutMs}ms: ${command}`));
      }
    }, timeoutMs);

    proc.stdout.on('data', (d) => { stdout += d.toString(); });
    proc.stderr.on('data', (d) => { stderr += d.toString(); });

    proc.on('close', (code) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);

      if (code === 0) {
        resolve(stdout.trim());
      } else {
        const errMsg = stderr.trim() || stdout.trim() || `Process exited with code ${code}`;
        reject(new Error(errMsg));
      }
    });

    proc.on('error', (err) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      reject(err);
    });
  });
}

/**
 * Capture full-res PNG screenshot directly from TV
 * @param {string} tvIp 
 * @param {string} destPath 
 * @returns {Promise<boolean>}
 */
export function captureTvScreenshot(tvIp, destPath) {
  return new Promise((resolve, reject) => {
    const env = { ...process.env, TV_HOST: tvIp };
    const proc = spawn(PYTHON_PATH, [TV_PY_PATH, '--screenshot', destPath], {
      env,
      windowsHide: true,
    });

    let stderr = '';
    proc.stderr.on('data', (d) => { stderr += d.toString(); });

    proc.on('close', (code) => {
      if (code === 0) resolve(true);
      else reject(new Error(stderr.trim() || `Screenshot failed with code ${code}`));
    });

    proc.on('error', reject);
  });
}

const REMOTE_WALLPAPER_PATH = '/sdcard/Android/data/com.gathin.tvhome/files/wallpaper.jpg';

/**
 * Push wallpaper to TV using native ADB sync protocol over persistent daemon
 * and trigger instant launcher display reload
 * @param {string} tvIp 
 * @param {string} localPath 
 * @returns {Promise<{success: boolean, message: string}>}
 */
export async function pushTvWallpaper(tvIp, localPath) {
  const socket = await getDaemonSocket();
  if (socket && !socket.destroyed) {
    reqCounter = (reqCounter + 1) % 1000000;
    const id = String(reqCounter);

    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pendingRequests.delete(id);
        reject(new Error('Timeout pushing wallpaper to TV'));
      }, 12000);

      pendingRequests.set(id, { resolve, reject, timer });

      const payload = JSON.stringify({
        id,
        type: 'push',
        local: localPath,
        remote: REMOTE_WALLPAPER_PATH,
      }) + '\n';
      socket.write(payload);
    });

    // Refresh TV launcher: update theme_revision to clear any stale on-TV wallpaper overrides,
    // then force-stop and start Home so MainActivity re-reads Config and renders the new wallpaper.
    const rev = String(Date.now());
    await execTvShell(tvIp, `echo ${rev} > /sdcard/Android/data/com.gathin.tvhome/files/theme_revision; am force-stop com.gathin.tvhome; am start -a android.intent.action.MAIN -c android.intent.category.HOME`);
    return { success: true, message: 'Wallpaper updated and displayed on TV!' };
  } else {
    throw new Error('ADB persistent connection unavailable for wallpaper transfer');
  }
}

/**
 * Push up to 5 carousel images to TV wallpapers directory and configure 5-min idle screensaver
 * @param {string} tvIp 
 * @param {Array<{id: string, localPath: string, name: string}>} imageEntries 
 * @returns {Promise<{success: boolean, count: number, message: string}>}
 */
export async function pushTvCarouselImages(tvIp, imageEntries) {
  if (!Array.isArray(imageEntries) || imageEntries.length === 0) {
    throw new Error('Please select at least 1 image for the carousel.');
  }
  if (imageEntries.length > 5) {
    throw new Error('Carousel allows a maximum of 5 images strictly.');
  }

  const socket = await getDaemonSocket();
  if (!socket || socket.destroyed) {
    throw new Error('ADB persistent connection unavailable for carousel transfer');
  }

  // 1. Clean wallpapers directory on TV
  await execTvShell(tvIp, 'mkdir -p /sdcard/Android/data/com.gathin.tvhome/files/wallpapers; rm -f /sdcard/Android/data/com.gathin.tvhome/files/wallpapers/*');

  // 2. Push each selected image (up to 5)
  for (let i = 0; i < imageEntries.length; i++) {
    const entry = imageEntries[i];
    const seq = String(i + 1).padStart(2, '0');
    const safeName = (entry.id || `img_${i + 1}`).replace(/[^a-zA-Z0-9_-]/g, '_');
    const remoteDest = `/sdcard/Android/data/com.gathin.tvhome/files/wallpapers/${seq}_${safeName}.jpg`;

    reqCounter = (reqCounter + 1) % 1000000;
    const id = String(reqCounter);

    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pendingRequests.delete(id);
        reject(new Error(`Timeout pushing carousel image ${entry.name || entry.id}`));
      }, 15000);

      pendingRequests.set(id, { resolve, reject, timer });

      const payload = JSON.stringify({
        id,
        type: 'push',
        local: entry.localPath,
        remote: remoteDest,
      }) + '\n';
      socket.write(payload);
    });
  }

  // 3. Ensure config.json has 5-min idle and clock wallpaper enabled
  const configContent = JSON.stringify({
    wallpaper: true,
    wallpaper_dim: 15,
    dock_glass: true,
    dock_even_padding: true,
    date_below_clock: true,
    dock_apps: [
      "com.google.android.youtube.tv",
      "com.netflix.ninja",
      "com.amazon.amazonvideo.livingroom",
      "in.startv.hotstar",
      "com.jio.media.stb.ondemand",
      "com.mxtech.videoplayer.television",
      "com.gathin.tvhome.cleaner"
    ],
    columns: 7,
    ambient_glow: false,
    module_cards: false,
    wallpaper_rotation_minutes: 0,
    home_idle_clock_minutes: 5,
    clock_wallpaper: true,
    clock_wallpaper_dim: 15
  }, null, 2);

  // Push config.json safely
  const tempConfig = path.join(path.dirname(entryPath()), 'temp_config.json');
  try {
    const fs = await import('fs');
    fs.writeFileSync(tempConfig, configContent, 'utf-8');

    reqCounter = (reqCounter + 1) % 1000000;
    const confId = String(reqCounter);
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pendingRequests.delete(confId);
        reject(new Error('Timeout updating TV config.json'));
      }, 8000);
      pendingRequests.set(confId, { resolve, reject, timer });
      socket.write(JSON.stringify({
        id: confId,
        type: 'push',
        local: tempConfig,
        remote: '/sdcard/Android/data/com.gathin.tvhome/files/config.json',
      }) + '\n');
    });
    try { fs.unlinkSync(tempConfig); } catch (e) {}
  } catch (err) {
    console.warn('[tvBridge] Config push notice:', err.message);
  }

  // 4. Update system dream timeout to 5 minutes (300,000 ms) & bump theme revision
  const rev = String(Date.now());
  await execTvShell(tvIp, `settings put secure screensaver_timeout 300000; settings put secure screensaver_enabled 1; echo ${rev} > /sdcard/Android/data/com.gathin.tvhome/files/theme_revision; am force-stop com.gathin.tvhome; am start -a android.intent.action.MAIN -c android.intent.category.HOME`);

  return {
    success: true,
    count: imageEntries.length,
    message: `Applied ${imageEntries.length} carousel image(s) with 5-minute inactivity auto-start and faded transitions!`,
  };
}

/**
 * Launch carousel preview immediately on TV
 * @param {string} tvIp 
 */
export async function launchTvCarouselPreview(tvIp) {
  await execTvShell(tvIp, 'am force-stop com.gathin.tvhome; am start -n com.gathin.tvhome/.ClockActivity');
  return { success: true, message: 'Carousel preview launched on TV' };
}

/**
 * Updates the native Home Screen Clock (Top-Left of TV Home Screen)
 * and refreshes the launcher instantly without opening any browser.
 */
export async function updateTvHomeClock(tvIp, homeClockConfig) {
  const socket = await getDaemonSocket();
  if (!socket) throw new Error('Persistent ADB daemon is not available');

  // 1. Read existing config.json on the TV
  let existing = {};
  try {
    const raw = await execTvShell(tvIp, 'cat /sdcard/Android/data/com.gathin.tvhome/files/config.json');
    existing = JSON.parse(raw);
  } catch (e) {
    existing = {
      wallpaper: true,
      wallpaper_dim: 15,
      dock_glass: true,
      dock_even_padding: true,
      date_below_clock: true,
      home_idle_clock_minutes: 5,
      clock_wallpaper: true,
      clock_wallpaper_dim: 15,
      columns: 7,
    };
  }

  // 2. Merge home_clock configuration
  existing.home_clock = homeClockConfig;

  // 3. Write temp config and push to TV
  const fs = await import('fs');
  const tempPath = path.join(path.dirname(entryPath()), `temp_clk_${Date.now()}.json`);
  fs.writeFileSync(tempPath, JSON.stringify(existing, null, 2), 'utf-8');

  reqCounter = (reqCounter + 1) % 1000000;
  const id = String(reqCounter);
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pendingRequests.delete(id);
      reject(new Error('Timeout updating TV config.json'));
    }, 8000);
    pendingRequests.set(id, { resolve, reject, timer });
    socket.write(JSON.stringify({
      id,
      type: 'push',
      local: tempPath,
      remote: '/sdcard/Android/data/com.gathin.tvhome/files/config.json',
    }) + '\n');
  });

  try { fs.unlinkSync(tempPath); } catch (e) {}

  // 4. Update theme revision and force restart the Home Screen so changes take effect immediately
  const rev = String(Date.now());
  await execTvShell(tvIp, `echo ${rev} > /sdcard/Android/data/com.gathin.tvhome/files/theme_revision; am force-stop com.gathin.tvhome; am start -a android.intent.action.MAIN -c android.intent.category.HOME`);
  return { success: true, home_clock: homeClockConfig };
}

function entryPath() {
  return fileURLToPath ? fileURLToPath(import.meta.url) : __filename;
}

// Warm up daemon connection immediately on module import
setTimeout(() => {
  getDaemonSocket().catch(() => {});
}, 100);
