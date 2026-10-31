import React, { useState } from 'react';
import { 
  Tv, 
  Power, 
  Volume2, 
  VolumeX, 
  ArrowUp, 
  ArrowDown, 
  ArrowLeft, 
  ArrowRight, 
  Check, 
  Home, 
  Undo2, 
  Menu, 
  Settings, 
  Play, 
  Pause, 
  Square, 
  FastForward, 
  Rewind, 
  Sparkles,
  Send,
  Keyboard,
  Layers,
  Sliders,
  AppWindow,
  Monitor,
  Activity,
  Terminal,
  ShieldCheck,
  ChevronRight,
  RefreshCw,
  LogOut,
  Maximize2,
  Image,
  Upload,
  MicOff,
  Mic,
  Trash2,
  Download,
  Radio,
  Clock,
  Film,
  CheckCircle2,
  X
} from 'lucide-react';
import { socket, apiRequest } from './api';
import ClockFaceStudio from './ClockFaceStudio';
import AssistantView from './AssistantView';

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('tv_dashboard_token') || '');
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState('');
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // Real-time synchronization state
  const [tvConnected, setTvConnected] = useState(false);
  const [deviceInfo, setDeviceInfo] = useState({
    model: 'BRAVIA 4K GB ATV3',
    brand: 'Sony',
    androidVersion: '9',
    ip: '192.168.29.29',
    resolution: '1920x1080 (Native 4K)',
  });
  const [tvState, setTvState] = useState({
    power: 'AWAKE',
    volume: 40,
    muted: false,
    currentApp: 'com.gathin.tvhome',
    currentAppLabel: 'Clean Apple TV Launcher',
    currentInput: 'HDMI 1',
    activeInputs: ['HDMI 1', 'HDMI 2', 'HDMI 3', 'HDMI 4', 'AV'],
    brightness: 255,
    lastSync: null,
  });

  const [apps, setApps] = useState([]);
  const [logs, setLogs] = useState([]);
  const [liveSnapshot, setLiveSnapshot] = useState(null);
  const [loadingSnapshot, setLoadingSnapshot] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [terminalCmd, setTerminalCmd] = useState('');
  const [terminalOutput, setTerminalOutput] = useState('');
  const [cleanerMessage, setCleanerMessage] = useState(null);
  const [isCleaning, setIsCleaning] = useState(false);
  const [wallpaperPresets, setWallpaperPresets] = useState([]);
  const [uploadingWallpaper, setUploadingWallpaper] = useState(false);
  const [toast, setToast] = useState(null);

  // Auto Screen Carousel State (5-Min Inactivity Screensaver)
  const [carouselConfig, setCarouselConfig] = useState({
    selectedIds: ['fuji', 'aurora', 'golden-coast', 'autumn-valley', 'nature-calm'],
    idleMinutes: 5,
    maxAllowed: 5,
    intervalSeconds: 18,
  });
  const [selectedCarouselIds, setSelectedCarouselIds] = useState([
    'fuji', 'aurora', 'golden-coast', 'autumn-valley', 'nature-calm'
  ]);
  const [applyingCarousel, setApplyingCarousel] = useState(false);
  const [previewingCarousel, setPreviewingCarousel] = useState(false);

  // Audio Recording & Local Storage State
  const [recordings, setRecordings] = useState([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recTitleInput, setRecTitleInput] = useState('');
  const mediaRecorderRef = React.useRef(null);
  const audioChunksRef = React.useRef([]);
  const recordingTimerRef = React.useRef(null);

  // Setup Socket.IO listener for immediate bidirectional sync
  React.useEffect(() => {
    socket.on('connect', () => console.log('WebSocket connected'));
    
    socket.on('state_snapshot', (data) => {
      if (data) {
        setTvConnected(data.connected);
        if (data.deviceInfo) setDeviceInfo(data.deviceInfo);
        if (data.state) setTvState(data.state);
      }
    });

    socket.on('state_updated', (newState) => {
      setTvState(prev => ({ ...prev, ...newState }));
    });

    socket.on('connection_changed', (info) => {
      setTvConnected(info.connected);
      showToast(info.connected ? `Sony TV connected (${info.ip})` : 'Sony TV disconnected', info.connected ? 'success' : 'warning');
    });

    socket.on('device_info', (info) => {
      setDeviceInfo(prev => ({ ...prev, ...info }));
    });

    return () => {
      socket.off('state_snapshot');
      socket.off('state_updated');
      socket.off('connection_changed');
      socket.off('device_info');
    };
  }, []);

  // Fetch initial app list & logs once logged in
  React.useEffect(() => {
    if (token) {
      loadApps();
      loadLogs();
      fetchSnapshot();
      loadWallpaperPresets();
      loadRecordings();
      loadCarouselConfig();
    }
  }, [token]);

  const showToast = (message, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthError('');
    try {
      const res = await apiRequest('/auth/verify', 'POST', { password: passwordInput });
      if (res.success) {
        localStorage.setItem('tv_dashboard_token', res.token);
        setToken(res.token);
        showToast('Authenticated successfully', 'success');
      }
    } catch (err) {
      setAuthError(err.message || 'Authentication failed');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('tv_dashboard_token');
    setToken('');
  };

  const loadApps = async () => {
    try {
      const res = await apiRequest('/apps');
      if (res.apps) setApps(res.apps);
    } catch (e) {
      console.warn('Could not load apps:', e);
    }
  };

  const loadLogs = async () => {
    try {
      const res = await apiRequest('/logs');
      if (res.logs) setLogs(res.logs);
    } catch (e) {}
  };

  const fetchSnapshot = async () => {
    setLoadingSnapshot(true);
    try {
      const res = await apiRequest('/screen/snapshot');
      if (res.url) setLiveSnapshot(res.url);
    } catch (e) {
      console.warn('Snapshot error:', e);
    } finally {
      setLoadingSnapshot(false);
    }
  };

  const loadWallpaperPresets = async () => {
    try {
      const res = await apiRequest('/wallpapers/presets');
      if (res.presets) setWallpaperPresets(res.presets);
    } catch (e) {
      console.warn('Could not load wallpaper presets:', e);
    }
  };

  const handleApplyWallpaper = async (presetId) => {
    try {
      showToast('Applying wallpaper to TV...', 'info');
      await apiRequest('/wallpapers/apply', 'POST', { presetId });
      showToast('TV Wallpaper updated successfully!', 'success');
      setTimeout(() => fetchSnapshot(), 1200);
    } catch (e) {
      showToast(e.message || 'Failed to update wallpaper', 'error');
    }
  };

  const handleCustomWallpaperUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast('Please select a valid image file (.jpg or .png)', 'error');
      return;
    }

    setUploadingWallpaper(true);
    showToast('Uploading custom wallpaper to TV...', 'info');

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        await apiRequest('/wallpapers/upload', 'POST', {
          dataBase64: reader.result,
          filename: file.name
        });
        showToast('Custom wallpaper applied and displayed on TV!', 'success');
        loadWallpaperPresets();
        setTimeout(() => fetchSnapshot(), 1200);
      } catch (err) {
        showToast(err.message || 'Upload failed', 'error');
      } finally {
        setUploadingWallpaper(false);
      }
    };
    reader.readAsDataURL(file);
  };

  // Auto Screen Carousel Handlers (5-Minute Inactivity Screensaver)
  const loadCarouselConfig = async () => {
    try {
      const res = await apiRequest('/carousel');
      if (res.config) {
        setCarouselConfig(res.config);
        if (Array.isArray(res.config.selectedIds)) {
          setSelectedCarouselIds(res.config.selectedIds);
        }
      }
    } catch (e) {
      console.warn('Could not load carousel config:', e);
    }
  };

  const toggleCarouselImage = (presetId) => {
    if (selectedCarouselIds.includes(presetId)) {
      if (selectedCarouselIds.length <= 1) {
        showToast('At least 1 image is required for the carousel.', 'warning');
        return;
      }
      setSelectedCarouselIds(prev => prev.filter(id => id !== presetId));
    } else {
      if (selectedCarouselIds.length >= 5) {
        showToast('Strict limit: Only 5 images are allowed for the carousel. Deselect one first.', 'warning');
        return;
      }
      setSelectedCarouselIds(prev => [...prev, presetId]);
    }
  };

  const handleApplyCarousel = async () => {
    if (selectedCarouselIds.length === 0) {
      showToast('Please select at least 1 image for the carousel.', 'warning');
      return;
    }
    if (selectedCarouselIds.length > 5) {
      showToast('Strict limit: Maximum 5 images allowed for carousel.', 'error');
      return;
    }

    setApplyingCarousel(true);
    try {
      showToast(`Pushing ${selectedCarouselIds.length} carousel image(s) to TV with 5-minute inactivity auto-start...`, 'info');
      const res = await apiRequest('/carousel/apply', 'POST', { selectedIds: selectedCarouselIds });
      showToast(res.result?.message || '5-Minute Auto Carousel saved & activated on Sony TV!', 'success');
      loadCarouselConfig();
    } catch (err) {
      showToast(err.message || 'Failed to apply carousel', 'error');
    } finally {
      setApplyingCarousel(false);
    }
  };

  const handlePreviewCarousel = async () => {
    setPreviewingCarousel(true);
    try {
      showToast('Launching instant carousel preview on Sony BRAVIA TV...', 'info');
      await apiRequest('/carousel/preview', 'POST');
      showToast('Carousel preview is running on your TV! Press any remote button to dismiss.', 'success');
    } catch (err) {
      showToast(err.message || 'Failed to preview carousel', 'error');
    } finally {
      setPreviewingCarousel(false);
    }
  };

  const handleResetCarouselToTop5 = () => {
    const default5 = ['fuji', 'aurora', 'golden-coast', 'autumn-valley', 'nature-calm'];
    setSelectedCarouselIds(default5);
    showToast('Selected default top 5 cinematic wallpapers for carousel', 'info');
  };

  // Audio Recording Handlers (Local PC Storage)
  const loadRecordings = async () => {
    try {
      const res = await apiRequest('/recordings');
      if (res.recordings) setRecordings(res.recordings);
    } catch (e) {
      console.warn('Could not load recordings:', e);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        stream.getTracks().forEach(track => track.stop());

        const reader = new FileReader();
        reader.onloadend = async () => {
          try {
            showToast('Saving audio recording locally to PC...', 'info');
            const res = await apiRequest('/recordings/upload', 'POST', {
              dataBase64: reader.result,
              title: recTitleInput.trim() || undefined,
              duration: recordingSeconds,
              format: 'webm',
            });
            if (res.success) {
              showToast('Recording saved to PC successfully!', 'success');
              setRecTitleInput('');
              loadRecordings();
            }
          } catch (err) {
            showToast(err.message || 'Failed to save recording', 'error');
          }
        };
        reader.readAsDataURL(audioBlob);
      };

      mediaRecorder.start(200);
      setIsRecording(true);
      setRecordingSeconds(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds(s => s + 1);
      }, 1000);
      showToast('Audio recording active. Recording...', 'info');
    } catch (err) {
      showToast('Microphone error: ' + err.message, 'error');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
    }
  };

  const handleDeleteRecording = async (id) => {
    try {
      await apiRequest(`/recordings/${id}`, 'DELETE');
      showToast('Recording deleted from PC', 'info');
      setRecordings(prev => prev.filter(r => r.id !== id));
    } catch (e) {
      showToast('Failed to delete recording', 'error');
    }
  };

  // Remote keypress execution - Ultra-fast WebSocket pipe with zero-latency dispatch
  const sendKey = (keyCode, name = '') => {
    if (socket && socket.connected) {
      socket.emit('send_key', { keyCode, name });
    } else {
      apiRequest('/remote/key', 'POST', { key: keyCode, keyName: name }).catch(console.warn);
    }
    // Only show toast on special action buttons, avoiding DOM churn on rapid navigation
    if (['POWER', 'SLEEP', 'WAKE', 'SETTINGS', 'INPUT'].includes(name)) {
      showToast(`Key: ${name}`, 'info');
    }
  };

  const sendTextToTv = async (e) => {
    e.preventDefault();
    if (!textInput.trim()) return;
    try {
      if (socket && socket.connected) {
        socket.emit('send_text', { text: textInput });
      } else {
        await apiRequest('/remote/text', 'POST', { text: textInput });
      }
      showToast(`Sent text: "${textInput}"`, 'success');
      setTextInput('');
    } catch (e) {
      showToast(e.message, 'error');
    }
  };

  const handleVolumeChange = async (newVol) => {
    setTvState(prev => ({ ...prev, volume: newVol }));
    try {
      await apiRequest('/audio/volume', 'POST', { volume: newVol });
    } catch (e) {
      showToast(e.message, 'error');
    }
  };

  const handleBrightnessChange = async (newVal) => {
    setTvState(prev => ({ ...prev, brightness: newVal }));
    try {
      await apiRequest('/display/brightness', 'POST', { brightness: newVal });
    } catch (e) {
      showToast(e.message, 'error');
    }
  };

  const handleSwitchInput = async (inputName) => {
    try {
      await apiRequest('/input/switch', 'POST', { input: inputName });
      showToast(`Switched to ${inputName}`, 'success');
    } catch (e) {
      showToast(e.message, 'error');
    }
  };

  const handlePowerAction = async (action) => {
    try {
      await apiRequest('/power', 'POST', { action });
      showToast(`Power command: ${action}`, 'info');
    } catch (e) {
      showToast(e.message, 'error');
    }
  };

  const handleLaunchApp = async (pkg) => {
    try {
      await apiRequest('/apps/launch', 'POST', { pkg });
      showToast(`Launched ${pkg}`, 'success');
      setTimeout(fetchSnapshot, 1500);
    } catch (e) {
      showToast(e.message, 'error');
    }
  };

  const handleCloseApp = async (pkg) => {
    try {
      await apiRequest('/apps/close', 'POST', { pkg });
      showToast(`Force-closed ${pkg}`, 'info');
    } catch (e) {
      showToast(e.message, 'error');
    }
  };

  const handleRunCacheCleaner = async () => {
    setIsCleaning(true);
    setCleanerMessage('Launching Auto Cache Cleaner on Sony TV...');
    try {
      const res = await apiRequest('/maintenance/clean-cache', 'POST');
      setCleanerMessage('✓ TV Cleaner opened! Executing cache & RAM purge.');
      showToast('Cache Cleaner executed on TV', 'success');
      setTimeout(fetchSnapshot, 2000);
    } catch (e) {
      setCleanerMessage(`Failed: ${e.message}`);
    } finally {
      setTimeout(() => setIsCleaning(false), 4000);
    }
  };

  const handleRunTerminal = async (e) => {
    e.preventDefault();
    if (!terminalCmd.trim()) return;
    try {
      setTerminalOutput('Executing on TV...');
      const res = await apiRequest('/terminal/exec', 'POST', { command: terminalCmd });
      setTerminalOutput(res.output || '(No output returned)');
    } catch (err) {
      setTerminalOutput(`Error: ${err.message}`);
    }
  };

  // ---------------- Render: Login Screen ----------------
  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-slate-950 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(14,165,233,0.15),rgba(255,255,255,0))]">
        <div className="w-full max-w-md p-8 rounded-2xl glass-panel shadow-2xl border border-slate-800">
          <div className="flex items-center justify-center space-x-3 mb-6">
            <div className="p-3 bg-cyan-500/10 rounded-xl border border-cyan-500/20 text-cyan-400">
              <Tv className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white">Sony BRAVIA 4K</h1>
              <p className="text-xs text-slate-400">Web Control Center</p>
            </div>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Dashboard Access Key
              </label>
              <input
                type="password"
                placeholder="Enter password (default: bravia2026)"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-900/80 border border-slate-700 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
              />
            </div>

            {authError && (
              <p className="text-xs text-rose-400 bg-rose-500/10 p-2.5 rounded-lg border border-rose-500/20">
                {authError}
              </p>
            )}

            <button
              type="submit"
              className="w-full py-2.5 px-4 rounded-xl font-medium text-sm bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white transition-all shadow-lg shadow-cyan-500/25 cursor-pointer"
            >
              Connect to Dashboard
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center space-x-1.5">
              <span className={`w-2 h-2 rounded-full ${tvConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
              <span>Target: {deviceInfo.ip}</span>
            </span>
            <span className="text-slate-500">Sony Android TV 9</span>
          </div>
        </div>
      </div>
    );
  }

  // ---------------- Render: Main Dashboard ----------------
  return (
    <div className="min-h-screen flex bg-slate-950 text-slate-100">
      
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-2.5 rounded-xl text-xs font-medium border shadow-2xl backdrop-blur-md transition-all ${
          toast.type === 'success' ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300' :
          toast.type === 'error' ? 'bg-rose-500/15 border-rose-500/30 text-rose-300' :
          'bg-cyan-500/15 border-cyan-500/30 text-cyan-300'
        }`}>
          {toast.message}
        </div>
      )}

      {/* Sidebar Navigation */}
      <aside className="w-64 border-r border-slate-800/80 bg-slate-900/50 backdrop-blur-xl flex flex-col shrink-0">
        <div className="p-5 border-b border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-cyan-500/10 rounded-lg text-cyan-400">
              <Tv className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white tracking-wide">BRAVIA Control</h2>
              <p className="text-[11px] text-slate-400">{deviceInfo.ip}</p>
            </div>
          </div>
          <span className={`w-2.5 h-2.5 rounded-full ${tvConnected ? 'bg-emerald-400 ring-4 ring-emerald-400/20' : 'bg-rose-400 ring-4 ring-rose-400/20'}`} />
        </div>

        <nav className="p-3 space-y-1 flex-1 overflow-y-auto">
          {[
            { id: 'dashboard', label: 'Dashboard', icon: Activity },
            { id: 'remote', label: 'Virtual Remote', icon: Tv },
            { id: 'assistant', label: 'AI Voice Assistant', icon: Sparkles },
            { id: 'clockfaces', label: 'Clock Face Studio', icon: Clock },
            { id: 'wallpapers', label: 'Wallpapers & Carousel', icon: Image },
            { id: 'recordings', label: 'Audio & Recordings', icon: Mic },
            { id: 'apps', label: 'Apps & Streaming', icon: AppWindow },
            { id: 'inputs', label: 'Inputs & HDMI', icon: Layers },
            { id: 'display', label: 'Display & Audio', icon: Sliders },
            { id: 'screen', label: 'Live TV Mirror', icon: Monitor },
            { id: 'terminal', label: 'System & ADB', icon: Terminal },
            { id: 'logs', label: 'Action History', icon: ShieldCheck },
          ].map(item => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all ${
                  active 
                    ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30' 
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Quick Power Bar at Sidebar Bottom */}
        <div className="p-3 border-t border-slate-800/80 space-y-2">
          <button
            onClick={() => handlePowerAction('toggle')}
            className="w-full flex items-center justify-center space-x-2 py-2 rounded-xl text-xs font-medium bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition-all cursor-pointer"
          >
            <Power className="w-3.5 h-3.5" />
            <span>Power Toggle</span>
          </button>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center space-x-2 py-1.5 rounded-xl text-[11px] text-slate-500 hover:text-slate-300 transition-all cursor-pointer"
          >
            <LogOut className="w-3 h-3" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      {activeTab === 'clockfaces' ? (
        <ClockFaceStudio showToast={showToast} tvConnected={tvConnected} />
      ) : (
        <main className="flex-1 flex flex-col h-screen overflow-y-auto bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(14,165,233,0.08),rgba(255,255,255,0))]">
          
          {/* Top Header */}
        <header className="h-16 border-b border-slate-800/80 px-8 flex items-center justify-between backdrop-blur-md bg-slate-950/40 sticky top-0 z-30">
          <div className="flex items-center space-x-3">
            <h1 className="text-base font-semibold capitalize text-white">
              {activeTab === 'dashboard' ? 'Control Dashboard' : activeTab.replace('-', ' ')}
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
              {tvState.currentAppLabel}
            </span>
          </div>

          <div className="flex items-center space-x-4">
            {/* Quick Auto Cache Cleaner Button */}
            <button
              onClick={handleRunCacheCleaner}
              disabled={isCleaning}
              className="flex items-center space-x-2 px-3 py-1.5 rounded-xl text-xs font-medium bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 transition-all cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{isCleaning ? 'Cleaning...' : 'Auto Cache Clean'}</span>
            </button>

            {/* Quick Volume Slider in Header */}
            <div className="flex items-center space-x-2 bg-slate-900/80 px-3 py-1.5 rounded-xl border border-slate-800">
              <button 
                onClick={() => apiRequest('/audio/mute', 'POST')} 
                className="text-slate-400 hover:text-white"
              >
                {tvState.muted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4" />}
              </button>
              <input
                type="range"
                min="0"
                max="100"
                value={tvState.volume}
                onChange={(e) => handleVolumeChange(e.target.value)}
                className="w-20 accent-cyan-400 h-1 bg-slate-700 rounded-lg cursor-pointer"
              />
              <span className="text-xs font-mono text-slate-300 w-6 text-right">{tvState.volume}</span>
            </div>

            <div className="flex items-center space-x-2 pl-2 border-l border-slate-800">
              <span className={`w-2 h-2 rounded-full ${tvConnected ? 'bg-emerald-400' : 'bg-rose-400'}`} />
              <span className="text-xs text-slate-300 font-medium">
                {tvConnected ? 'Online' : 'Disconnected'}
              </span>
            </div>
          </div>
        </header>

        {/* Tab Content Views */}
        <div className="p-8 space-y-6 flex-1">

          {/* TAB 1: DASHBOARD */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6 max-w-6xl">
              {/* Stat Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="p-5 rounded-2xl glass-card">
                  <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                    <span>Power State</span>
                    <Power className={`w-4 h-4 ${tvState.power === 'AWAKE' ? 'text-emerald-400' : 'text-slate-500'}`} />
                  </div>
                  <div className="text-xl font-bold text-white tracking-tight">{tvState.power}</div>
                  <p className="text-[11px] text-slate-400 mt-1">Screen active & responsive</p>
                </div>

                <div className="p-5 rounded-2xl glass-card">
                  <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                    <span>Current Focus</span>
                    <AppWindow className="w-4 h-4 text-cyan-400" />
                  </div>
                  <div className="text-lg font-bold text-white truncate tracking-tight">{tvState.currentAppLabel}</div>
                  <p className="text-[11px] text-slate-400 mt-1 truncate">{tvState.currentApp}</p>
                </div>

                <div className="p-5 rounded-2xl glass-card">
                  <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                    <span>Active Input</span>
                    <Layers className="w-4 h-4 text-indigo-400" />
                  </div>
                  <div className="text-xl font-bold text-white tracking-tight">{tvState.currentInput}</div>
                  <p className="text-[11px] text-slate-400 mt-1">4K HDR Pass-through</p>
                </div>

                <div className="p-5 rounded-2xl glass-card">
                  <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                    <span>System Audio</span>
                    <Volume2 className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="text-xl font-bold text-white tracking-tight">{tvState.muted ? 'Muted' : `${tvState.volume}%`}</div>
                  <p className="text-[11px] text-slate-400 mt-1">Sony ARC / Internal</p>
                </div>
              </div>

              {/* Middle Row: Live Snapshot & Quick Remote */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Live Screen Preview */}
                <div className="lg:col-span-2 p-6 rounded-2xl glass-panel space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-white">Live Screen View</h3>
                      <p className="text-xs text-slate-400">Current visual output from Sony TV</p>
                    </div>
                    <button
                      onClick={fetchSnapshot}
                      disabled={loadingSnapshot}
                      className="flex items-center space-x-1.5 px-3 py-1 rounded-xl text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 transition-all cursor-pointer"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${loadingSnapshot ? 'animate-spin' : ''}`} />
                      <span>Refresh</span>
                    </button>
                  </div>

                  <div className="aspect-video w-full rounded-xl overflow-hidden bg-slate-900 border border-slate-800 relative flex items-center justify-center">
                    {liveSnapshot ? (
                      <img src={liveSnapshot} alt="TV Screenshot" className="w-full h-full object-cover" />
                    ) : (
                      <div className="text-center text-slate-500 text-xs">
                        <Monitor className="w-10 h-10 mx-auto mb-2 opacity-30" />
                        <span>Click refresh to capture screen</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Quick D-Pad & Controls */}
                <div className="p-6 rounded-2xl glass-panel flex flex-col items-center justify-center space-y-4">
                  <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Quick Navigation</h3>
                  
                  {/* D-Pad Circular Layout */}
                  <div className="relative w-44 h-44 rounded-full bg-slate-900/80 border border-slate-700/80 p-2 flex items-center justify-center shadow-inner">
                    <button
                      onClick={() => sendKey(19, 'Up')}
                      className="absolute top-2 p-2 rounded-xl hover:bg-slate-700/60 active:scale-90 active:bg-cyan-500/30 text-slate-200 transition-all cursor-pointer"
                    >
                      <ArrowUp className="w-5 h-5" />
                    </button>

                    <button
                      onClick={() => sendKey(21, 'Left')}
                      className="absolute left-2 p-2 rounded-xl hover:bg-slate-700/60 active:scale-90 active:bg-cyan-500/30 text-slate-200 transition-all cursor-pointer"
                    >
                      <ArrowLeft className="w-5 h-5" />
                    </button>

                    <button
                      onClick={() => sendKey(23, 'OK')}
                      className="w-14 h-14 rounded-full bg-cyan-500 hover:bg-cyan-400 active:scale-90 text-white font-bold flex items-center justify-center shadow-lg shadow-cyan-500/25 transition-all cursor-pointer"
                    >
                      <Check className="w-6 h-6" />
                    </button>

                    <button
                      onClick={() => sendKey(22, 'Right')}
                      className="absolute right-2 p-2 rounded-xl hover:bg-slate-700/60 active:scale-90 active:bg-cyan-500/30 text-slate-200 transition-all cursor-pointer"
                    >
                      <ArrowRight className="w-5 h-5" />
                    </button>

                    <button
                      onClick={() => sendKey(20, 'Down')}
                      className="absolute bottom-2 p-2 rounded-xl hover:bg-slate-700/60 active:scale-90 active:bg-cyan-500/30 text-slate-200 transition-all cursor-pointer"
                    >
                      <ArrowDown className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Auxiliary Key Row */}
                  <div className="grid grid-cols-3 gap-2 w-full pt-2">
                    <button
                      onClick={() => sendKey(4, 'Back')}
                      className="py-2 rounded-xl glass-button text-xs font-medium text-slate-300 flex items-center justify-center space-x-1 cursor-pointer"
                    >
                      <Undo2 className="w-3.5 h-3.5" />
                      <span>Back</span>
                    </button>
                    <button
                      onClick={() => sendKey(3, 'Home')}
                      className="py-2 rounded-xl glass-button text-xs font-medium text-slate-300 flex items-center justify-center space-x-1 cursor-pointer"
                    >
                      <Home className="w-3.5 h-3.5" />
                      <span>Home</span>
                    </button>
                    <button
                      onClick={() => sendKey(176, 'Settings')}
                      className="py-2 rounded-xl glass-button text-xs font-medium text-slate-300 flex items-center justify-center space-x-1 cursor-pointer"
                    >
                      <Settings className="w-3.5 h-3.5" />
                      <span>Settings</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Maintenance Banner */}
              {cleanerMessage && (
                <div className="p-4 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-xs text-cyan-300 flex items-center justify-between">
                  <span>{cleanerMessage}</span>
                  <button onClick={() => setCleanerMessage(null)} className="text-slate-400 hover:text-white">✕</button>
                </div>
              )}
            </div>
          )}

          {/* TAB: AI VOICE ASSISTANT */}
          {activeTab === 'assistant' && (
            <AssistantView tvConnected={tvConnected} targetIp={deviceInfo.ip} />
          )}

          {/* TAB 2: VIRTUAL REMOTE */}
          {activeTab === 'remote' && (
            <div className="max-w-md mx-auto p-6 rounded-3xl glass-panel border border-slate-800 space-y-6 shadow-2xl">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-xs font-semibold text-white tracking-wide">SONY BRAVIA REMOTE</span>
                </div>
                <button
                  onClick={() => handlePowerAction('toggle')}
                  className="p-2 rounded-full bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 transition-all cursor-pointer"
                >
                  <Power className="w-4 h-4" />
                </button>
              </div>

              {/* Remote Upper Keys */}
              <div className="grid grid-cols-4 gap-2">
                <button onClick={() => sendKey(178, 'Input')} className="py-2.5 rounded-xl glass-button text-xs font-medium cursor-pointer">Input</button>
                <button onClick={() => sendKey(176, 'Settings')} className="py-2.5 rounded-xl glass-button text-xs font-medium cursor-pointer">Settings</button>
                <button onClick={() => sendKey(82, 'Menu')} className="py-2.5 rounded-xl glass-button text-xs font-medium cursor-pointer">Menu</button>
                <button 
                  onClick={() => sendKey(231, 'Voice')} 
                  title="Trigger Google Assistant / Voice Search on TV"
                  className="py-2.5 rounded-xl bg-gradient-to-r from-red-500/20 to-amber-500/20 hover:from-red-500/30 hover:to-amber-500/30 border border-red-500/30 text-xs font-medium text-amber-300 flex items-center justify-center space-x-1 cursor-pointer"
                >
                  <Mic className="w-3.5 h-3.5 text-red-400" />
                  <span>Voice</span>
                </button>
              </div>

              {/* Central D-Pad Controller */}
              <div className="relative w-56 h-56 mx-auto rounded-full bg-slate-900 border border-slate-700 p-2 flex items-center justify-center shadow-2xl">
                <button
                  onClick={() => sendKey(19, 'Up')}
                  className="absolute top-2 w-12 h-10 rounded-xl hover:bg-slate-700/60 active:scale-90 active:bg-cyan-500/30 text-slate-200 flex items-center justify-center transition-all cursor-pointer"
                >
                  <ArrowUp className="w-6 h-6" />
                </button>

                <button
                  onClick={() => sendKey(21, 'Left')}
                  className="absolute left-2 w-10 h-12 rounded-xl hover:bg-slate-700/60 active:scale-90 active:bg-cyan-500/30 text-slate-200 flex items-center justify-center transition-all cursor-pointer"
                >
                  <ArrowLeft className="w-6 h-6" />
                </button>

                <button
                  onClick={() => sendKey(23, 'OK')}
                  className="w-20 h-20 rounded-full bg-gradient-to-tr from-cyan-600 to-blue-500 hover:from-cyan-500 hover:to-blue-400 active:scale-90 text-white font-bold text-sm flex items-center justify-center shadow-xl shadow-cyan-500/30 transition-all cursor-pointer"
                >
                  OK
                </button>

                <button
                  onClick={() => sendKey(22, 'Right')}
                  className="absolute right-2 w-10 h-12 rounded-xl hover:bg-slate-700/60 active:scale-90 active:bg-cyan-500/30 text-slate-200 flex items-center justify-center transition-all cursor-pointer"
                >
                  <ArrowRight className="w-6 h-6" />
                </button>

                <button
                  onClick={() => sendKey(20, 'Down')}
                  className="absolute bottom-2 w-12 h-10 rounded-xl hover:bg-slate-700/60 active:scale-90 active:bg-cyan-500/30 text-slate-200 flex items-center justify-center transition-all cursor-pointer"
                >
                  <ArrowDown className="w-6 h-6" />
                </button>
              </div>

              {/* Navigation Back & Home */}
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => sendKey(4, 'Back')} className="py-3 rounded-2xl glass-button text-xs font-semibold flex items-center justify-center space-x-2 cursor-pointer">
                  <Undo2 className="w-4 h-4 text-slate-400" />
                  <span>BACK</span>
                </button>
                <button onClick={() => sendKey(3, 'Home')} className="py-3 rounded-2xl glass-button text-xs font-semibold flex items-center justify-center space-x-2 cursor-pointer">
                  <Home className="w-4 h-4 text-cyan-400" />
                  <span>HOME</span>
                </button>
              </div>

              {/* Media Playback Controls */}
              <div className="grid grid-cols-4 gap-2 pt-2 border-t border-slate-800">
                <button onClick={() => sendKey(89, 'Rewind')} className="py-2.5 rounded-xl glass-button flex items-center justify-center text-slate-300 cursor-pointer">
                  <Rewind className="w-4 h-4" />
                </button>
                <button onClick={() => sendKey(85, 'Play/Pause')} className="py-2.5 rounded-xl glass-button flex items-center justify-center text-cyan-400 cursor-pointer">
                  <Play className="w-4 h-4" />
                </button>
                <button onClick={() => sendKey(86, 'Stop')} className="py-2.5 rounded-xl glass-button flex items-center justify-center text-slate-300 cursor-pointer">
                  <Square className="w-4 h-4" />
                </button>
                <button onClick={() => sendKey(90, 'Forward')} className="py-2.5 rounded-xl glass-button flex items-center justify-center text-slate-300 cursor-pointer">
                  <FastForward className="w-4 h-4" />
                </button>
              </div>

              {/* Keyboard Direct Input Field */}
              <form onSubmit={sendTextToTv} className="pt-2 border-t border-slate-800 flex space-x-2">
                <input
                  type="text"
                  placeholder="Type directly into TV..."
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                />
                <button type="submit" className="p-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-white cursor-pointer">
                  <Send className="w-4 h-4" />
                </button>
              </form>

              {/* Voice Remote & Recording Studio Shortcut */}
              <div className="pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setActiveTab('recordings')}
                  className="w-full py-2.5 px-3 rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 text-xs text-slate-300 flex items-center justify-center space-x-2 transition-all cursor-pointer"
                >
                  <Mic className="w-3.5 h-3.5 text-rose-400" />
                  <span>Open Audio Recording Studio & PC Library</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB: TV WALLPAPERS & CAROUSEL */}
          {activeTab === 'wallpapers' && (
            <div className="max-w-6xl space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold text-white flex items-center space-x-2">
                    <Sparkles className="w-5 h-5 text-cyan-400" />
                    <span>Sony BRAVIA Wallpaper & Auto Carousel Studio</span>
                  </h2>
                  <p className="text-xs text-slate-400">
                    Configure live home wallpapers and customize the 5-minute inactivity screensaver carousel with smooth faded transitions
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <button 
                    onClick={() => { loadWallpaperPresets(); loadCarouselConfig(); }} 
                    className="px-3 py-1.5 rounded-xl text-xs glass-button flex items-center space-x-1 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Refresh</span>
                  </button>
                </div>
              </div>

              {/* HERO FEATURE: AUTO SCREEN CAROUSEL (5-MIN INACTIVITY SCREENSAVER) */}
              <div className="p-6 rounded-3xl glass-panel border border-cyan-500/30 bg-gradient-to-br from-slate-900/90 via-cyan-950/20 to-slate-950/90 shadow-2xl space-y-5 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />

                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                        Feature Active
                      </span>
                      <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                        <Clock className="w-4 h-4 text-cyan-400" />
                        <span>Auto Screen Carousel (5-Min Inactivity Screensaver)</span>
                      </h3>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed max-w-3xl">
                      When your Sony TV is left unused for <strong>5 minutes</strong>, the screen automatically activates this cinematic carousel, gently transitioning between your selected images with <strong>smooth faded cross-fades</strong> every 18 seconds. Pressing any remote button immediately wakes up Home.
                    </p>
                  </div>

                  {/* Strict 5-Image Counter Badge */}
                  <div className="flex items-center space-x-2 self-start md:self-auto shrink-0">
                    <div className={`px-4 py-2 rounded-2xl border flex items-center space-x-2.5 ${
                      selectedCarouselIds.length === 5 
                        ? 'bg-cyan-500/15 border-cyan-400/40 text-cyan-300' 
                        : 'bg-slate-800/80 border-slate-700 text-slate-300'
                    }`}>
                      <CheckCircle2 className={`w-4 h-4 ${selectedCarouselIds.length === 5 ? 'text-cyan-400' : 'text-slate-400'}`} />
                      <div className="text-right">
                        <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Carousel Limit</div>
                        <div className="text-xs font-black">
                          <span className={selectedCarouselIds.length === 5 ? 'text-cyan-300' : 'text-white'}>
                            {selectedCarouselIds.length}
                          </span> / 5 Images Selected
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 4 Feature Spec Badges */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 rounded-2xl bg-slate-900/60 border border-slate-800 flex items-center space-x-2.5">
                    <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400">
                      <Clock className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-500 font-medium">Idle Timeout</div>
                      <div className="text-xs font-semibold text-white">5 Minutes Unused</div>
                    </div>
                  </div>

                  <div className="p-3 rounded-2xl bg-slate-900/60 border border-slate-800 flex items-center space-x-2.5">
                    <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400">
                      <Film className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-500 font-medium">Transitions</div>
                      <div className="text-xs font-semibold text-white">Smooth Faded Cross-Fade</div>
                    </div>
                  </div>

                  <div className="p-3 rounded-2xl bg-slate-900/60 border border-slate-800 flex items-center space-x-2.5">
                    <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
                      <Sparkles className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-500 font-medium">Slide Interval</div>
                      <div className="text-xs font-semibold text-white">Every 18 Seconds</div>
                    </div>
                  </div>

                  <div className="p-3 rounded-2xl bg-slate-900/60 border border-slate-800 flex items-center space-x-2.5">
                    <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
                      <ShieldCheck className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-500 font-medium">Burn-In Guard</div>
                      <div className="text-xs font-semibold text-white">Ambient + Drift Clock</div>
                    </div>
                  </div>
                </div>

                {/* Selected 5-Slots Carousel Preview Strip */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-300">
                      Active Carousel Sequence (Order of Slides on TV):
                    </span>
                    <button 
                      onClick={handleResetCarouselToTop5}
                      className="text-[11px] text-cyan-400 hover:text-cyan-300 transition-colors cursor-pointer"
                    >
                      Reset to Curated 5
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                    {[0, 1, 2, 3, 4].map((index) => {
                      const id = selectedCarouselIds[index];
                      const preset = id ? wallpaperPresets.find(p => p.id === id) : null;
                      const isCustom = id && !preset;

                      return (
                        <div 
                          key={index}
                          className={`relative rounded-2xl overflow-hidden aspect-video border transition-all ${
                            id 
                              ? 'border-cyan-500/50 bg-slate-950 shadow-lg shadow-cyan-950/30' 
                              : 'border-dashed border-slate-800 bg-slate-900/30 flex flex-col items-center justify-center'
                          }`}
                        >
                          {id ? (
                            <>
                              <img 
                                src={preset?.url || `/wallpapers/${id}.jpg`} 
                                alt={preset?.name || id}
                                className="w-full h-full object-cover" 
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-transparent to-transparent" />
                              
                              {/* Slot Number Badge */}
                              <div className="absolute top-1.5 left-1.5 px-2 py-0.5 rounded-full bg-slate-950/80 backdrop-blur-md text-[10px] font-black text-cyan-400 border border-cyan-500/40">
                                #{index + 1}
                              </div>

                              {/* Remove Button */}
                              <button
                                onClick={() => toggleCarouselImage(id)}
                                title="Remove from carousel"
                                className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-slate-950/80 hover:bg-rose-600/90 text-slate-400 hover:text-white flex items-center justify-center transition-all cursor-pointer"
                              >
                                <X className="w-3 h-3" />
                              </button>

                              {/* Title */}
                              <div className="absolute bottom-1.5 left-2 right-2 truncate text-[10px] font-bold text-white drop-shadow">
                                {preset?.name || id}
                              </div>
                            </>
                          ) : (
                            <div className="p-3 text-center space-y-1">
                              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                                Slot #{index + 1}
                              </span>
                              <p className="text-[10px] text-slate-600">Select an image below</p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Primary Carousel Action Controls */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                  <div className="text-xs text-slate-400 flex items-center space-x-1.5">
                    <Check className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Any remote key press immediately wakes the TV back to Home launcher</span>
                  </div>

                  <div className="flex items-center space-x-3 w-full sm:w-auto">
                    {/* Instant Preview Button */}
                    <button
                      onClick={handlePreviewCarousel}
                      disabled={previewingCarousel || !tvConnected}
                      className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl text-xs font-semibold bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 flex items-center justify-center space-x-2 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>{previewingCarousel ? 'Starting...' : 'Preview Carousel Now on TV'}</span>
                    </button>

                    {/* Apply 5-Min Carousel Button */}
                    <button
                      onClick={handleApplyCarousel}
                      disabled={applyingCarousel || selectedCarouselIds.length === 0 || !tvConnected}
                      className="flex-1 sm:flex-initial px-5 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 shadow-lg shadow-cyan-500/20 flex items-center justify-center space-x-2 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                    >
                      {applyingCarousel ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Pushing to Sony TV...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>Apply 5-Min Auto Carousel to TV</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Action Banner: Custom Upload & Audio Hardware Privacy Note */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* Upload Custom Card */}
                <div className="md:col-span-2 p-6 rounded-2xl glass-panel border border-cyan-500/20 bg-gradient-to-r from-cyan-950/20 to-slate-900/40 flex flex-col justify-between space-y-4">
                  <div>
                    <div className="flex items-center space-x-2 text-cyan-400 mb-1">
                      <Upload className="w-4 h-4" />
                      <h3 className="text-sm font-semibold text-white">Upload Custom Wallpaper from PC</h3>
                    </div>
                    <p className="text-xs text-slate-400">
                      Select any photo, 4K artwork, or custom picture from your PC. It will be pushed over ADB and applied to your TV launcher instantly.
                    </p>
                  </div>

                  <div className="flex items-center space-x-3">
                    <label className={`px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center space-x-2 transition-all cursor-pointer ${
                      uploadingWallpaper ? 'bg-slate-700 text-slate-400 cursor-not-allowed' : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950'
                    }`}>
                      <Upload className="w-4 h-4" />
                      <span>{uploadingWallpaper ? 'Uploading to TV...' : 'Select Image File (.jpg / .png)'}</span>
                      <input 
                        type="file" 
                        accept="image/jpeg,image/png,image/webp" 
                        disabled={uploadingWallpaper} 
                        onChange={handleCustomWallpaperUpload} 
                        className="hidden" 
                      />
                    </label>
                    <span className="text-[11px] text-slate-500">Supports high-res JPG & PNG up to 25MB</span>
                  </div>
                </div>

                {/* Privacy & Remote Mic Info Card */}
                <div className="p-6 rounded-2xl glass-panel border border-slate-800 space-y-3">
                  <div className="flex items-center space-x-2 text-amber-400">
                    <MicOff className="w-4 h-4" />
                    <h3 className="text-xs font-semibold text-white">Remote Mic & Audio Security</h3>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    <strong>Hardware Protection:</strong> Sony Bluetooth voice remotes physically isolate the microphone circuit unless the physical button is pressed by hand. Android TV strictly prevents background room eavesdropping or covert call recording to safeguard user privacy.
                  </p>
                </div>
              </div>

              {/* Preset Gallery */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Cinematic 4K Themes</h3>
                  <span className="text-[11px] text-slate-500">{wallpaperPresets.length} Curated Wallpapers</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {wallpaperPresets.map((preset) => {
                    const carouselIndex = selectedCarouselIds.indexOf(preset.id);
                    const isSelected = carouselIndex !== -1;

                    return (
                      <div 
                        key={preset.id} 
                        className={`group rounded-2xl glass-card overflow-hidden border transition-all flex flex-col justify-between ${
                          isSelected 
                            ? 'border-cyan-500/50 shadow-lg shadow-cyan-950/30 bg-slate-900/60' 
                            : 'border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="relative aspect-video overflow-hidden bg-slate-950">
                          <img 
                            src={preset.url} 
                            alt={preset.name} 
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-80" />
                          
                          {/* Carousel Selected Indicator Badge */}
                          {isSelected && (
                            <div className="absolute top-2 left-2 px-2.5 py-0.5 rounded-full bg-cyan-500 text-slate-950 text-[10px] font-black tracking-wide flex items-center space-x-1 shadow-md">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>CAROUSEL #{carouselIndex + 1}</span>
                            </div>
                          )}

                          <span className="absolute bottom-2 left-3 text-xs font-bold text-white drop-shadow">
                            {preset.name}
                          </span>
                        </div>

                        <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
                          <p className="text-[11px] text-slate-400 leading-normal">{preset.description}</p>
                          
                          <div className="space-y-2 pt-1">
                            {/* Carousel Toggle Action */}
                            {isSelected ? (
                              <button
                                onClick={() => toggleCarouselImage(preset.id)}
                                className="w-full py-2 rounded-xl text-xs font-semibold bg-cyan-500/20 hover:bg-rose-500/20 text-cyan-300 hover:text-rose-300 border border-cyan-500/40 hover:border-rose-500/30 flex items-center justify-center space-x-1.5 transition-all cursor-pointer"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Selected for Carousel (#{carouselIndex + 1})</span>
                              </button>
                            ) : (
                              <button
                                onClick={() => toggleCarouselImage(preset.id)}
                                className={`w-full py-2 rounded-xl text-xs font-medium border flex items-center justify-center space-x-1.5 transition-all cursor-pointer ${
                                  selectedCarouselIds.length < 5
                                    ? 'bg-slate-800/80 hover:bg-cyan-500/15 text-slate-300 hover:text-cyan-300 border-slate-700/60 hover:border-cyan-500/30'
                                    : 'bg-slate-900/50 text-slate-500 border-slate-800/80 cursor-not-allowed'
                                }`}
                              >
                                <span>
                                  {selectedCarouselIds.length < 5
                                    ? `+ Add to 5-Min Carousel (${selectedCarouselIds.length}/5)`
                                    : 'Carousel Full (Max 5 Limit)'}
                                </span>
                              </button>
                            )}

                            {/* Set Single Home Wallpaper */}
                            <button
                              onClick={() => handleApplyWallpaper(preset.id)}
                              className="w-full py-2 rounded-xl text-xs font-semibold bg-slate-800/40 hover:bg-slate-700/50 text-slate-300 hover:text-white border border-slate-700/40 flex items-center justify-center space-x-1.5 transition-all cursor-pointer active:scale-95"
                            >
                              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                              <span>Set Single Home Wallpaper</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB: AUDIO & CALL RECORDINGS (SAVED LOCALLY ON PC) */}
          {activeTab === 'recordings' && (
            <div className="max-w-6xl space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold text-white flex items-center space-x-2">
                    <Mic className="w-5 h-5 text-rose-400" />
                    <span>Audio & Call Recording Studio</span>
                  </h2>
                  <p className="text-xs text-slate-400">
                    Record voice, conversations, and audio notes directly from the web app. All files are saved permanently on your PC and playable right here.
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <button onClick={loadRecordings} className="px-3 py-1.5 rounded-xl text-xs glass-button flex items-center space-x-1 cursor-pointer">
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Refresh Library</span>
                  </button>
                  <button
                    onClick={() => sendKey(231, 'Voice')}
                    className="px-3 py-1.5 rounded-xl text-xs bg-gradient-to-r from-red-500/20 to-amber-500/20 text-amber-300 border border-red-500/30 flex items-center space-x-1 cursor-pointer hover:from-red-500/30 hover:to-amber-500/30"
                  >
                    <Radio className="w-3.5 h-3.5 text-rose-400" />
                    <span>Trigger TV Voice Assistant</span>
                  </button>
                </div>
              </div>

              {/* Recording Controls & Hardware Info Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Live Recorder Box */}
                <div className="md:col-span-2 p-6 rounded-2xl glass-panel border border-rose-500/30 bg-gradient-to-br from-rose-950/20 via-slate-900/60 to-slate-900/80 space-y-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2.5">
                      <div className={"p-2 rounded-xl " + (isRecording ? "bg-rose-500 text-white animate-pulse" : "bg-slate-800 text-rose-400")}>
                        <Mic className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-white">Live Audio & Voice Recorder</h3>
                        <p className="text-[11px] text-slate-400">Captures voice/calls and stores WAV/WebM directly into your local PC storage</p>
                      </div>
                    </div>
                    {isRecording && (
                      <span className="px-3 py-1 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs font-mono font-bold animate-pulse flex items-center space-x-1.5">
                        <span className="w-2 h-2 rounded-full bg-rose-500" />
                        <span>REC {Math.floor(recordingSeconds / 60).toString().padStart(2, '0')}:{(recordingSeconds % 60).toString().padStart(2, '0')}</span>
                      </span>
                    )}
                  </div>

                  {/* Title Input */}
                  <div>
                    <label className="block text-[11px] font-medium text-slate-400 mb-1.5">Recording Label / Call Note (Optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. Call Recording 30-Oct, Voice Search Note, Room Memo..."
                      value={recTitleInput}
                      onChange={(e) => setRecTitleInput(e.target.value)}
                      disabled={isRecording}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900/80 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-rose-500"
                    />
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center space-x-4 pt-1">
                    {!isRecording ? (
                      <button
                        onClick={startRecording}
                        className="px-6 py-3 rounded-xl bg-gradient-to-r from-rose-600 to-red-500 hover:from-rose-500 hover:to-red-400 text-white text-xs font-semibold flex items-center space-x-2 shadow-lg shadow-rose-600/30 active:scale-95 transition-all cursor-pointer"
                      >
                        <Mic className="w-4 h-4" />
                        <span>Start Recording</span>
                      </button>
                    ) : (
                      <button
                        onClick={stopRecording}
                        className="px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-rose-500/50 text-rose-300 text-xs font-semibold flex items-center space-x-2 shadow-lg active:scale-95 transition-all cursor-pointer"
                      >
                        <Square className="w-4 h-4 text-rose-400 fill-rose-400" />
                        <span>Stop & Save to PC</span>
                      </button>
                    )}
                    <span className="text-[11px] text-slate-400">
                      {isRecording ? "Listening and capturing audio..." : "Files are automatically saved to tv-control-center/recordings/"}
                    </span>
                  </div>
                </div>

                {/* Info Card */}
                <div className="p-6 rounded-2xl glass-panel border border-slate-800 bg-slate-900/40 space-y-4 flex flex-col justify-between">
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2 text-cyan-400">
                      <Radio className="w-4 h-4" />
                      <h4 className="text-xs font-semibold text-white">TV Remote & Storage Guide</h4>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      • <strong>Saved on PC:</strong> Every recording made here is stored in <code className="text-rose-300 text-[10px]">tv-control-center/recordings/</code> on this computer.
                    </p>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      • <strong>Listen in Web App:</strong> Use the built-in media players below to listen, seek, or download recordings.
                    </p>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      • <strong>TV Remote Mic:</strong> Use <span className="text-amber-300 font-medium">Trigger TV Voice Assistant</span> to activate Sony TV voice listening on screen.
                    </p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/60 text-[10px] text-slate-300">
                    Host: <span className="text-cyan-300">http://localhost:5050</span> (Local PC)
                  </div>
                </div>
              </div>

              {/* Saved Recordings Library */}
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <div className="flex items-center space-x-2">
                    <h3 className="text-sm font-semibold text-white">Locally Saved Audio Library</h3>
                    <span className="px-2 py-0.5 rounded-full bg-slate-800 text-[11px] text-slate-400 font-mono">
                      {recordings.length} {recordings.length === 1 ? 'file' : 'files'}
                    </span>
                  </div>
                </div>

                {recordings.length === 0 ? (
                  <div className="p-12 text-center rounded-2xl glass-panel border border-slate-800 space-y-3">
                    <div className="w-12 h-12 mx-auto rounded-full bg-rose-500/10 flex items-center justify-center text-rose-400">
                      <Mic className="w-6 h-6" />
                    </div>
                    <h4 className="text-sm font-medium text-white">No Audio Recordings Yet</h4>
                    <p className="text-xs text-slate-400 max-w-sm mx-auto">
                      Click the "Start Recording" button above to record voice or audio. The recording will be saved directly to your PC and appear in this library.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {recordings.map((rec) => (
                      <div key={rec.id} className="p-4 rounded-2xl glass-card border border-slate-800 space-y-3 hover:border-slate-700 transition-all">
                        <div className="flex items-start justify-between">
                          <div className="space-y-0.5 overflow-hidden">
                            <h4 className="text-xs font-semibold text-white truncate">{rec.title}</h4>
                            <p className="text-[10px] text-slate-400 font-mono">
                              {new Date(rec.created_at).toLocaleString()} • {Math.round(rec.size / 1024)} KB
                              {rec.duration ? " • " + Math.floor(rec.duration / 60) + ":" + (rec.duration % 60).toString().padStart(2, '0') : ''}
                            </p>
                          </div>
                          <div className="flex items-center space-x-1 shrink-0 ml-2">
                            <a
                              href={rec.url}
                              download={rec.filename}
                              title="Download audio file to PC"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-400 hover:bg-cyan-500/10 transition-all cursor-pointer"
                            >
                              <Download className="w-4 h-4" />
                            </a>
                            <button
                              onClick={() => handleDeleteRecording(rec.id)}
                              title="Delete recording from PC"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-all cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Inline Audio Player */}
                        <div className="pt-1">
                          <audio
                            controls
                            src={rec.url}
                            className="w-full h-8 rounded-lg filter invert-[0.85] contrast-125"
                            preload="metadata"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: APPS & STREAMING */}
          {activeTab === 'apps' && (
            <div className="max-w-5xl space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold text-white">Installed TV Applications</h2>
                  <p className="text-xs text-slate-400">Launch and manage apps installed on your Sony BRAVIA</p>
                </div>
                <button onClick={loadApps} className="px-3 py-1.5 rounded-xl text-xs glass-button flex items-center space-x-1 cursor-pointer">
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Refresh Apps</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {apps.map((app) => (
                  <div key={app.pkg} className="p-4 rounded-2xl glass-card flex items-center justify-between hover:border-slate-600 transition-all">
                    <div className="flex items-center space-x-3 overflow-hidden">
                      <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center shrink-0">
                        <AppWindow className="w-5 h-5" />
                      </div>
                      <div className="overflow-hidden">
                        <h4 className="text-xs font-semibold text-white truncate">{app.name}</h4>
                        <p className="text-[10px] text-slate-500 truncate">{app.pkg}</p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-1.5 shrink-0">
                      <button
                        onClick={() => handleLaunchApp(app.pkg)}
                        className="px-3 py-1 rounded-lg text-xs font-medium bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/30 transition-all cursor-pointer"
                      >
                        Launch
                      </button>
                      <button
                        onClick={() => handleCloseApp(app.pkg)}
                        className="px-2 py-1 rounded-lg text-xs text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-all cursor-pointer"
                        title="Force Close"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: INPUTS & HDMI */}
          {activeTab === 'inputs' && (
            <div className="max-w-3xl space-y-6">
              <div>
                <h2 className="text-base font-semibold text-white">Input Source Selection</h2>
                <p className="text-xs text-slate-400">Switch TV input directly without navigating the on-screen menu</p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {['HDMI 1', 'HDMI 2', 'HDMI 3', 'HDMI 4', 'AV', 'Inputs Menu'].map(inp => (
                  <button
                    key={inp}
                    onClick={() => handleSwitchInput(inp)}
                    className={`p-6 rounded-2xl glass-panel text-left flex flex-col justify-between space-y-3 transition-all cursor-pointer ${
                      tvState.currentInput === inp ? 'border-cyan-500/50 bg-cyan-500/10' : 'hover:border-slate-600'
                    }`}
                  >
                    <Layers className={`w-6 h-6 ${tvState.currentInput === inp ? 'text-cyan-400' : 'text-slate-400'}`} />
                    <div>
                      <div className="text-sm font-semibold text-white">{inp}</div>
                      <p className="text-[11px] text-slate-500">Sony BRAVIA Port</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* TAB 5: DISPLAY & AUDIO SETTINGS */}
          {activeTab === 'display' && (
            <div className="max-w-3xl space-y-6">
              <div>
                <h2 className="text-base font-semibold text-white">Display & Audio Controls</h2>
                <p className="text-xs text-slate-400">Synchronized settings sent directly to Sony TV firmware</p>
              </div>

              <div className="p-6 rounded-2xl glass-panel space-y-6">
                {/* Brightness Control */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-slate-300">
                    <span>Panel Brightness</span>
                    <span className="font-mono">{Math.round((tvState.brightness / 255) * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="255"
                    value={tvState.brightness}
                    onChange={(e) => handleBrightnessChange(e.target.value)}
                    className="w-full accent-cyan-400 h-2 bg-slate-800 rounded-lg cursor-pointer"
                  />
                </div>

                {/* Volume Level */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-slate-300">
                    <span>Master Audio Volume</span>
                    <span className="font-mono">{tvState.volume}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={tvState.volume}
                    onChange={(e) => handleVolumeChange(e.target.value)}
                    className="w-full accent-cyan-400 h-2 bg-slate-800 rounded-lg cursor-pointer"
                  />
                </div>

                {/* Sleep Timer & Energy */}
                <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-semibold text-white">Sleep & Standby</h4>
                    <p className="text-[11px] text-slate-500">Put TV into low-power standby mode</p>
                  </div>
                  <button
                    onClick={() => handlePowerAction('sleep')}
                    className="px-4 py-2 rounded-xl text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 transition-all cursor-pointer"
                  >
                    Enter Standby
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: LIVE TV MIRROR */}
          {activeTab === 'screen' && (
            <div className="max-w-4xl space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold text-white">Live Screen Monitor</h2>
                  <p className="text-xs text-slate-400">High-resolution frame mirror captured directly from the display engine</p>
                </div>
                <button
                  onClick={fetchSnapshot}
                  disabled={loadingSnapshot}
                  className="flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-medium bg-cyan-500 hover:bg-cyan-400 text-white transition-all cursor-pointer shadow-lg shadow-cyan-500/25"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingSnapshot ? 'animate-spin' : ''}`} />
                  <span>Refresh Screen</span>
                </button>
              </div>

              <div className="aspect-video w-full rounded-2xl overflow-hidden bg-slate-900 border border-slate-800 shadow-2xl flex items-center justify-center">
                {liveSnapshot ? (
                  <img src={liveSnapshot} alt="TV Output" className="w-full h-full object-contain" />
                ) : (
                  <div className="text-center text-slate-500 text-xs">
                    <Monitor className="w-12 h-12 mx-auto mb-2 opacity-30" />
                    <span>No snapshot loaded yet. Click 'Refresh Screen'.</span>
            </div>
          )}
              </div>
            </div>
          )}

          {/* TAB 7: TERMINAL & SYSTEM */}
          {activeTab === 'terminal' && (
            <div className="max-w-4xl space-y-6">
              <div>
                <h2 className="text-base font-semibold text-white">System Diagnostics & Shell</h2>
                <p className="text-xs text-slate-400">Execute authorized maintenance and inspection commands on your TV</p>
              </div>

              {/* Hardware Information Box */}
              <div className="p-5 rounded-2xl glass-panel grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                <div>
                  <span className="text-slate-500">Model</span>
                  <div className="font-semibold text-white mt-0.5">{deviceInfo.model}</div>
                </div>
                <div>
                  <span className="text-slate-500">Brand</span>
                  <div className="font-semibold text-white mt-0.5">{deviceInfo.brand}</div>
                </div>
                <div>
                  <span className="text-slate-500">Android Version</span>
                  <div className="font-semibold text-white mt-0.5">{deviceInfo.androidVersion}</div>
                </div>
                <div>
                  <span className="text-slate-500">Resolution</span>
                  <div className="font-semibold text-white mt-0.5">{deviceInfo.resolution}</div>
                </div>
              </div>

              {/* Command Terminal */}
              <div className="p-5 rounded-2xl glass-panel space-y-4">
                <form onSubmit={handleRunTerminal} className="flex space-x-2">
                  <input
                    type="text"
                    placeholder="Enter command, e.g. dumpsys meminfo, top -n 1, getprop..."
                    value={terminalCmd}
                    onChange={(e) => setTerminalCmd(e.target.value)}
                    className="flex-1 px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-xs font-mono text-cyan-300 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  />
                  <button type="submit" className="px-4 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-white text-xs font-medium cursor-pointer">
                    Run Shell
                  </button>
                </form>

                <div className="h-64 p-4 rounded-xl bg-slate-950 font-mono text-[11px] text-slate-300 overflow-y-auto border border-slate-800 whitespace-pre-wrap">
                  {terminalOutput || '# Ready to execute commands on TV...'}
                </div>
              </div>
            </div>
          )}

          {/* TAB 8: ACTION LOGS */}
          {activeTab === 'logs' && (
            <div className="max-w-4xl space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold text-white">Action History & Security Log</h2>
                  <p className="text-xs text-slate-400">Audit trail of remote commands, system state events, and authentication</p>
                </div>
                <button onClick={loadLogs} className="px-3 py-1.5 rounded-xl text-xs glass-button flex items-center space-x-1 cursor-pointer">
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Refresh Logs</span>
                </button>
              </div>

              <div className="rounded-2xl glass-panel overflow-hidden border border-slate-800">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900/80 text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="p-3.5">Time</th>
                      <th className="p-3.5">Source</th>
                      <th className="p-3.5">Action</th>
                      <th className="p-3.5">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                    {logs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-900/40">
                        <td className="p-3.5 text-slate-500">{new Date(log.timestamp).toLocaleTimeString()}</td>
                        <td className="p-3.5 text-cyan-400">{log.source}</td>
                        <td className="p-3.5 text-white font-medium">{log.action}</td>
                        <td className="p-3.5 text-slate-400">{log.details}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      </main>
      )}

    </div>
  );
}
