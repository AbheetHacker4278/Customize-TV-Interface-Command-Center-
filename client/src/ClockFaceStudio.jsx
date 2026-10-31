import React, { useState, useEffect } from 'react';
import { 
  Clock, 
  Sparkles, 
  Save, 
  Copy, 
  RotateCcw, 
  Sliders, 
  Type, 
  Palette, 
  Calendar, 
  Tv, 
  Check, 
  RefreshCw, 
  Sun, 
  Wifi, 
  Settings as SettingsIcon, 
  Layers, 
  ShieldCheck, 
  Maximize2
} from 'lucide-react';
import { apiRequest } from './api';

export default function ClockFaceStudio({ showToast, tvConnected }) {
  // Preset Themes specifically tuned for the Sony BRAVIA TV Home Screen
  const HOME_CLOCK_PRESETS = [
    {
      id: 'cyan_gradient',
      name: 'Apple TV Sky Cyan',
      desc: 'Default signature light-blue gradient with deep ambient glow',
      config: {
        style: 'cyan_gradient',
        size: 58,
        font: 'medium',
        show_seconds: false,
        format_24h: false,
        show_date: true,
        show_greeting: true,
        color_top: '#CBEBFE',
        color_mid: '#64B5F6',
        color_bottom: '#1976D2',
        color_shadow: '#440D47A1',
        shadow_radius: 8,
        color_date: '#CCFFFFFF',
      }
    },
    {
      id: 'amber_gold',
      name: 'Golden Amber Sunset',
      desc: 'Warm sunrise & golden-hour gradient matching evening wallpapers',
      config: {
        style: 'amber_gold',
        size: 64,
        font: 'bold',
        show_seconds: false,
        format_24h: false,
        show_date: true,
        show_greeting: true,
        color_top: '#FEF3C7',
        color_mid: '#F59E0B',
        color_bottom: '#B45309',
        color_shadow: '#6678350F',
        shadow_radius: 12,
        color_date: '#FDE68A',
      }
    },
    {
      id: 'pure_white',
      name: 'Minimal Platinum White',
      desc: 'Pure crisp white with clean thin typography and subtle shadow',
      config: {
        style: 'pure_white',
        size: 58,
        font: 'light',
        show_seconds: false,
        format_24h: false,
        show_date: true,
        show_greeting: true,
        color_top: '#FFFFFF',
        color_mid: '#FFFFFF',
        color_bottom: '#FFFFFF',
        color_shadow: '#55000000',
        shadow_radius: 6,
        color_date: '#E2E8F0',
      }
    },
    {
      id: 'cyberpunk_neon',
      name: 'Cyberpunk Neon Glow',
      desc: 'High-contrast cyan to electric magenta glow with tech aura',
      config: {
        style: 'cyberpunk_neon',
        size: 66,
        font: 'bold',
        show_seconds: true,
        format_24h: true,
        show_date: true,
        show_greeting: true,
        color_top: '#00F0FF',
        color_mid: '#C084FC',
        color_bottom: '#FF0055',
        color_shadow: '#8800F0FF',
        shadow_radius: 16,
        color_date: '#FF0055',
      }
    },
    {
      id: 'emerald_aurora',
      name: 'Emerald Aurora Mint',
      desc: 'Lush northern-lights mint green with soft nature glow',
      config: {
        style: 'emerald_aurora',
        size: 60,
        font: 'medium',
        show_seconds: false,
        format_24h: false,
        show_date: true,
        show_greeting: true,
        color_top: '#D1FAE5',
        color_mid: '#10B981',
        color_bottom: '#047857',
        color_shadow: '#44065F46',
        shadow_radius: 10,
        color_date: '#A7F3D0',
      }
    },
    {
      id: 'crimson_fire',
      name: 'Ruby Crimson Fire',
      desc: 'Bold red crimson gradient with fiery dramatic focus',
      config: {
        style: 'crimson_fire',
        size: 64,
        font: 'bold',
        show_seconds: false,
        format_24h: false,
        show_date: true,
        show_greeting: true,
        color_top: '#FEE2E2',
        color_mid: '#EF4444',
        color_bottom: '#991B1B',
        color_shadow: '#667F1D1D',
        shadow_radius: 12,
        color_date: '#FECACA',
      }
    },
    {
      id: 'amethyst_purple',
      name: 'Amethyst Royal Purple',
      desc: 'Deep twilight violet gradient with regal ambient backlight',
      config: {
        style: 'amethyst_purple',
        size: 60,
        font: 'medium',
        show_seconds: false,
        format_24h: false,
        show_date: true,
        show_greeting: true,
        color_top: '#F3E8FF',
        color_mid: '#A855F7',
        color_bottom: '#6B21A8',
        color_shadow: '#554C1D95',
        shadow_radius: 10,
        color_date: '#E9D5FF',
      }
    },
    {
      id: 'monospace_matrix',
      name: 'Monospace Tech Matrix',
      desc: 'Fixed-width developer code typography with phosphor green glow',
      config: {
        style: 'monospace_matrix',
        size: 54,
        font: 'mono',
        show_seconds: true,
        format_24h: true,
        show_date: true,
        show_greeting: true,
        color_top: '#86EFAC',
        color_mid: '#22C55E',
        color_bottom: '#15803D',
        color_shadow: '#66166534',
        shadow_radius: 10,
        color_date: '#86EFAC',
      }
    },
    {
      id: 'editorial_serif',
      name: 'Classical Roman Serif',
      desc: 'Luxury editorial serif typography with warm champagne finish',
      config: {
        style: 'editorial_serif',
        size: 64,
        font: 'serif',
        show_seconds: false,
        format_24h: false,
        show_date: true,
        show_greeting: true,
        color_top: '#FEF9C3',
        color_mid: '#FDE047',
        color_bottom: '#CA8A04',
        color_shadow: '#44713F12',
        shadow_radius: 8,
        color_date: '#FEF08A',
      }
    }
  ];

  // Current Active & Editing Configuration
  const [clockConfig, setClockConfig] = useState(HOME_CLOCK_PRESETS[0].config);
  const [activePresetId, setActivePresetId] = useState('cyan_gradient');
  const [hasChanges, setHasChanges] = useState(false);
  const [applying, setApplying] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('presets'); // presets, typography, colors, elements

  // Live time ticker for Home Screen simulator
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch current applied clock config from TV
  useEffect(() => {
    const loadCurrent = async () => {
      try {
        const res = await apiRequest('/home-clock');
        if (res.success && res.homeClock) {
          setClockConfig(res.homeClock);
          const matched = HOME_CLOCK_PRESETS.find(p => p.id === res.homeClock.style);
          if (matched) setActivePresetId(matched.id);
        }
      } catch (e) {
        console.warn('Could not load home clock:', e);
      } finally {
        setLoading(false);
      }
    };
    loadCurrent();
  }, []);

  const updateField = (key, value) => {
    setClockConfig(prev => {
      const next = { ...prev, [key]: value };
      setHasChanges(true);
      return next;
    });
  };

  const selectPreset = (preset) => {
    setActivePresetId(preset.id);
    setClockConfig(JSON.parse(JSON.stringify(preset.config)));
    setHasChanges(true);
  };

  // Apply Clock Design directly to the TV Home Screen
  const handleApplyToTv = async () => {
    setApplying(true);
    try {
      const res = await apiRequest('/home-clock/apply', 'POST', {
        clockConfig,
      });

      if (res.success) {
        setHasChanges(false);
        showToast('✨ Clock applied to TV Home Screen!', 'success');
      }
    } catch (e) {
      showToast('Error applying to Home Screen: ' + e.message, 'error');
    } finally {
      setApplying(false);
    }
  };

  // Format Live Time according to config
  const hoursRaw = time.getHours();
  const is24h = Boolean(clockConfig.format_24h);
  const hours = is24h ? hoursRaw : (hoursRaw % 12 || 12);
  const hStr = String(hours).padStart(is24h ? 2 : 1, '0');
  const mStr = String(time.getMinutes()).padStart(2, '0');
  const sStr = String(time.getSeconds()).padStart(2, '0');

  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const dayName = days[time.getDay()];
  const monthName = months[time.getMonth()];
  const dateStr = `${dayName} ${time.getDate()} ${monthName}`;

  // Font Family style for live simulator
  let fontFamilyCss = 'system-ui, -apple-system, sans-serif';
  let fontWeightCss = '500';
  if (clockConfig.font === 'bold') {
    fontWeightCss = '700';
  } else if (clockConfig.font === 'light') {
    fontWeightCss = '300';
  } else if (clockConfig.font === 'mono') {
    fontFamilyCss = 'ui-monospace, "JetBrains Mono", monospace';
    fontWeightCss = '600';
  } else if (clockConfig.font === 'serif') {
    fontFamilyCss = '"Playfair Display", "Cinzel", Georgia, serif';
    fontWeightCss = '600';
  }

  // Gradient text styling
  const isSolid = clockConfig.color_top === clockConfig.color_bottom && clockConfig.color_top === clockConfig.color_mid;
  const clockTextStyle = {
    fontFamily: fontFamilyCss,
    fontWeight: fontWeightCss,
    letterSpacing: '-0.02em',
  };

  if (isSolid) {
    clockTextStyle.color = clockConfig.color_top || '#FFFFFF';
  } else {
    clockTextStyle.backgroundImage = `linear-gradient(180deg, ${clockConfig.color_top || '#CBEBFE'} 0%, ${clockConfig.color_mid || '#64B5F6'} 50%, ${clockConfig.color_bottom || '#1976D2'} 100%)`;
    clockTextStyle.WebkitBackgroundClip = 'text';
    clockTextStyle.WebkitTextFillColor = 'transparent';
  }

  if (clockConfig.shadow_radius > 0) {
    const shadowCol = clockConfig.color_shadow || 'rgba(13, 71, 161, 0.4)';
    clockTextStyle.filter = `drop-shadow(0 4px ${clockConfig.shadow_radius}px ${shadowCol})`;
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-slate-950 text-slate-100 overflow-hidden">
      
      {/* ---------------- Top Studio Header ---------------- */}
      <header className="h-16 border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-xl px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center space-x-3.5">
          <div className="p-2 bg-gradient-to-br from-cyan-500/20 to-blue-600/20 rounded-xl text-cyan-400 border border-cyan-500/30">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-sm font-semibold text-white tracking-wide">
                Home Screen Clock Designer
              </h2>
              <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                Top-Left Clock
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Personalize the native clock on your TV Home Screen without opening any browser
            </p>
          </div>
        </div>

        {/* Live Status & Apply Button */}
        <div className="flex items-center space-x-3">
          <div className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-full text-xs font-medium border backdrop-blur-md ${
            !hasChanges 
              ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300' 
              : 'bg-amber-500/15 border-amber-500/30 text-amber-300'
          }`}>
            <span className={`w-2 h-2 rounded-full ${!hasChanges ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
            <span>{!hasChanges ? 'Synced on TV Home' : 'Unsaved Changes'}</span>
          </div>

          <button
            onClick={handleApplyToTv}
            disabled={applying}
            className="flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-cyan-500 via-sky-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-lg shadow-cyan-500/25 border border-cyan-400/30 transition-all cursor-pointer active:scale-95"
          >
            {applying ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            <span>Apply to TV Home Screen</span>
          </button>
        </div>
      </header>

      {/* ---------------- Studio Workspace ---------------- */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        
        {/* ================= LEFT / CENTER: TV Home Screen Simulator ================= */}
        <div className="flex-1 flex flex-col p-6 min-w-0 bg-slate-950/80 overflow-y-auto">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2 text-xs text-slate-400 font-semibold uppercase tracking-wider">
              <span>Live Sony BRAVIA Home Screen Simulator</span>
            </div>
            <div className="text-xs text-slate-500">
              100% Native Launcher Canvas • Direct TV Sync
            </div>
          </div>

          {/* TV Frame Simulator */}
          <div className="flex-1 flex items-center justify-center">
            <div 
              className="relative w-full max-w-5xl aspect-video rounded-3xl overflow-hidden shadow-2xl border-4 border-slate-800/90 flex flex-col justify-between p-8 sm:p-10 select-none"
              style={{
                backgroundImage: 'url(/wallpapers/fuji.jpg)',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                boxShadow: '0 25px 70px -10px rgba(0, 0, 0, 0.95), 0 0 0 1px rgba(255, 255, 255, 0.05)',
              }}
            >
              {/* Wallpaper Ambient Dim */}
              <div className="absolute inset-0 bg-black/20 pointer-events-none" />

              {/* ---------------- TOP ROW (Header) ---------------- */}
              <div className="relative z-10 flex items-start justify-between">
                
                {/* TOP LEFT: Greeting, Live Clock, and Date */}
                <div className="flex flex-col">
                  {/* Greeting & Weather Row */}
                  {clockConfig.show_greeting !== false && (
                    <div className="flex items-center space-x-2 text-xs font-semibold text-white/70 tracking-widest uppercase mb-1">
                      <span>GOOD MORNING</span>
                      <span className="opacity-40">•</span>
                      <div className="flex items-center space-x-1 text-white/90">
                        <Sun className="w-3.5 h-3.5 text-amber-400" />
                        <span>29°C CLEAR</span>
                      </div>
                    </div>
                  )}

                  {/* THE CLOCK */}
                  <div className="flex items-baseline line-none leading-none select-none my-1">
                    <span 
                      className="transition-all tabular-nums"
                      style={{
                        ...clockTextStyle,
                        fontSize: `${(clockConfig.size || 58) * 0.075}vw`,
                      }}
                    >
                      {hStr}:{mStr}
                    </span>

                    {clockConfig.show_seconds && (
                      <span 
                        className="opacity-80 ml-2 transition-all tabular-nums"
                        style={{
                          ...clockTextStyle,
                          fontSize: `${(clockConfig.size || 58) * 0.04}vw`,
                        }}
                      >
                        :{sStr}
                      </span>
                    )}

                    {!is24h && (
                      <span 
                        className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-white/60 ml-2"
                      >
                        {hoursRaw < 12 ? 'AM' : 'PM'}
                      </span>
                    )}
                  </div>

                  {/* Date Below Clock */}
                  {clockConfig.show_date !== false && (
                    <div 
                      className="text-xs sm:text-sm font-medium tracking-wide mt-1 transition-colors"
                      style={{ color: clockConfig.color_date || 'rgba(255, 255, 255, 0.8)' }}
                    >
                      {dateStr}
                    </div>
                  )}
                </div>

                {/* TOP RIGHT: Top Buttons (Inputs, Wi-Fi, Settings) */}
                <div className="flex items-center space-x-2 sm:space-x-3">
                  <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-white/15 backdrop-blur-md border border-white/20 text-white text-xs font-medium shadow-lg">
                    <Layers className="w-3.5 h-3.5" />
                    <span>Inputs</span>
                  </div>
                  <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-white/15 backdrop-blur-md border border-white/20 text-white text-xs font-medium shadow-lg">
                    <Wifi className="w-3.5 h-3.5" />
                    <span>Wi-Fi</span>
                  </div>
                  <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-white/15 backdrop-blur-md border border-white/20 text-white text-xs font-medium shadow-lg">
                    <SettingsIcon className="w-3.5 h-3.5" />
                    <span>Settings</span>
                  </div>
                </div>

              </div>

              {/* ---------------- BOTTOM ROW (Focused Title & Glass Dock) ---------------- */}
              <div className="relative z-10 flex flex-col space-y-3">
                {/* Focused App Title */}
                <div className="text-3xl sm:text-4xl font-light text-white tracking-tight ml-2 drop-shadow-md">
                  YouTube
                </div>

                {/* Floating Glass Dock */}
                <div className="p-3 sm:p-4 rounded-3xl bg-black/40 backdrop-blur-2xl border border-white/15 shadow-2xl flex items-center space-x-3 sm:space-x-4 overflow-hidden">
                  {/* YouTube (Focused) */}
                  <div className="p-2.5 sm:p-3 rounded-2xl bg-white text-rose-600 font-bold text-xs shadow-xl ring-4 ring-white/60 transform scale-105 transition-all">
                    ▶ YouTube
                  </div>

                  {/* Netflix */}
                  <div className="px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl bg-black/60 border border-white/10 text-rose-500 font-bold text-xs">
                    NETFLIX
                  </div>

                  {/* Prime Video */}
                  <div className="px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl bg-sky-600 text-white font-bold text-xs">
                    prime video
                  </div>

                  {/* JioHotstar */}
                  <div className="px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold text-xs">
                    JioHotstar
                  </div>

                  {/* JioCinema */}
                  <div className="px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl bg-pink-600 text-white font-bold text-xs">
                    JioCinema
                  </div>

                  {/* Cleaner App */}
                  <div className="px-3 py-2 rounded-xl bg-emerald-500/80 text-white font-bold text-xs flex items-center space-x-1">
                    <Sparkles className="w-3 h-3" />
                    <span>Cleaner</span>
                  </div>
                </div>
              </div>

            </div>
          </div>

          <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
            <span>Live Home Screen Rendering Mode</span>
            <span>Target: Sony BRAVIA 4K ({tvConnected ? 'Online' : 'Connected'})</span>
          </div>
        </div>

        {/* ================= RIGHT COLUMN: Customization Controls ================= */}
        <aside className="w-88 border-l border-slate-800/80 bg-slate-900/60 flex flex-col shrink-0">
          
          {/* Controls Tabs */}
          <div className="p-3 border-b border-slate-800/80">
            <div className="grid grid-cols-4 gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
              {[
                { id: 'presets', label: 'Themes' },
                { id: 'typography', label: 'Size & Font' },
                { id: 'colors', label: 'Colors' },
                { id: 'elements', label: 'Items' },
              ].map(t => (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  className={`py-1.5 rounded-lg text-center font-medium transition-all cursor-pointer ${
                    activeTab === t.id 
                      ? 'bg-cyan-500/20 text-cyan-300 font-semibold' 
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Form Body */}
          <div className="flex-1 overflow-y-auto p-5 space-y-6 text-xs text-slate-300">
            
            {/* ---------------- TAB 1: THEMES / PRESETS ---------------- */}
            {activeTab === 'presets' && (
              <div className="space-y-3">
                <div className="text-xs font-semibold text-white uppercase tracking-wider mb-2">
                  Curated Home Screen Clock Styles
                </div>

                <div className="space-y-2">
                  {HOME_CLOCK_PRESETS.map(preset => {
                    const isSelected = activePresetId === preset.id;
                    return (
                      <button
                        key={preset.id}
                        onClick={() => selectPreset(preset)}
                        className={`w-full p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                          isSelected 
                            ? 'bg-cyan-500/15 border-cyan-500/60 ring-1 ring-cyan-500/30' 
                            : 'bg-slate-950/60 hover:bg-slate-800 border-slate-800'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold text-xs text-white">{preset.name}</span>
                          {isSelected && <Check className="w-4 h-4 text-cyan-400" />}
                        </div>
                        <p className="text-[11px] text-slate-400">{preset.desc}</p>
                        
                        {/* Color gradient preview ribbon */}
                        <div 
                          className="h-2 rounded-full mt-2 w-full"
                          style={{
                            background: `linear-gradient(90deg, ${preset.config.color_top}, ${preset.config.color_mid}, ${preset.config.color_bottom})`,
                          }}
                        />
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ---------------- TAB 2: TYPOGRAPHY & SIZE ---------------- */}
            {activeTab === 'typography' && (
              <div className="space-y-5">
                {/* Clock Size Slider */}
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-semibold text-white">Clock Size</span>
                    <span className="text-cyan-400 font-mono font-semibold">{clockConfig.size || 58} sp</span>
                  </div>
                  <input
                    type="range"
                    min="40"
                    max="90"
                    value={clockConfig.size || 58}
                    onChange={(e) => updateField('size', Number(e.target.value))}
                    className="w-full accent-cyan-400 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                    <span>Compact (40sp)</span>
                    <span>Standard (58sp)</span>
                    <span>Hero Giant (90sp)</span>
                  </div>
                </div>

                {/* Font Typography Style */}
                <div>
                  <label className="block text-xs font-semibold text-white mb-1.5">
                    Typography Weight & Family
                  </label>
                  <div className="grid grid-cols-1 gap-2">
                    {[
                      { id: 'medium', label: 'Clean Medium Sans', desc: 'Apple TV balanced sans-serif' },
                      { id: 'bold', label: 'Bold Heavy Display', desc: 'Prominent punchy numbers' },
                      { id: 'light', label: 'Ultra-Light Elegance', desc: 'Thin sophisticated luxury look' },
                      { id: 'mono', label: 'Tech Monospace', desc: 'Terminal / hacker clock font' },
                      { id: 'serif', label: 'Classical Roman Serif', desc: 'Luxury editorial serif style' },
                    ].map(f => (
                      <button
                        key={f.id}
                        onClick={() => updateField('font', f.id)}
                        className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                          (clockConfig.font || 'medium') === f.id 
                            ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300 font-semibold' 
                            : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <div className="text-xs">{f.label}</div>
                        <div className="text-[10px] text-slate-500">{f.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ---------------- TAB 3: COLORS & GRADIENTS ---------------- */}
            {activeTab === 'colors' && (
              <div className="space-y-5">
                <div className="space-y-3">
                  <span className="font-semibold text-white block">Vertical Color Gradient</span>

                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Top Highlight Color</label>
                    <div className="flex items-center space-x-2">
                      <input
                        type="color"
                        value={clockConfig.color_top || '#CBEBFE'}
                        onChange={(e) => updateField('color_top', e.target.value)}
                        className="w-8 h-8 rounded cursor-pointer bg-transparent"
                      />
                      <input
                        type="text"
                        value={clockConfig.color_top || '#CBEBFE'}
                        onChange={(e) => updateField('color_top', e.target.value)}
                        className="flex-1 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Mid Color</label>
                    <div className="flex items-center space-x-2">
                      <input
                        type="color"
                        value={clockConfig.color_mid || '#64B5F6'}
                        onChange={(e) => updateField('color_mid', e.target.value)}
                        className="w-8 h-8 rounded cursor-pointer bg-transparent"
                      />
                      <input
                        type="text"
                        value={clockConfig.color_mid || '#64B5F6'}
                        onChange={(e) => updateField('color_mid', e.target.value)}
                        className="flex-1 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Bottom Shade Color</label>
                    <div className="flex items-center space-x-2">
                      <input
                        type="color"
                        value={clockConfig.color_bottom || '#1976D2'}
                        onChange={(e) => updateField('color_bottom', e.target.value)}
                        className="w-8 h-8 rounded cursor-pointer bg-transparent"
                      />
                      <input
                        type="text"
                        value={clockConfig.color_bottom || '#1976D2'}
                        onChange={(e) => updateField('color_bottom', e.target.value)}
                        className="flex-1 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* Glow & Shadow */}
                <div className="space-y-3 pt-3 border-t border-slate-800">
                  <span className="font-semibold text-white block">Drop Shadow & Glow Layer</span>

                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-400">Glow Blur Radius</span>
                      <span className="text-cyan-400 font-mono">{clockConfig.shadow_radius ?? 8} px</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="24"
                      value={clockConfig.shadow_radius ?? 8}
                      onChange={(e) => updateField('shadow_radius', Number(e.target.value))}
                      className="w-full accent-cyan-400 cursor-pointer"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Shadow Color</label>
                    <div className="flex items-center space-x-2">
                      <input
                        type="color"
                        value={(clockConfig.color_shadow || '#440D47A1').slice(0, 7)}
                        onChange={(e) => updateField('color_shadow', e.target.value)}
                        className="w-8 h-8 rounded cursor-pointer bg-transparent"
                      />
                      <input
                        type="text"
                        value={clockConfig.color_shadow || '#440D47A1'}
                        onChange={(e) => updateField('color_shadow', e.target.value)}
                        className="flex-1 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ---------------- TAB 4: ELEMENTS & FORMAT ---------------- */}
            {activeTab === 'elements' && (
              <div className="space-y-4">
                <span className="font-semibold text-white block">Home Screen Elements</span>

                <label className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer">
                  <div>
                    <div className="text-xs font-medium text-white">Show Seconds</div>
                    <div className="text-[10px] text-slate-500">Live ticking seconds (:00)</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={Boolean(clockConfig.show_seconds)}
                    onChange={(e) => updateField('show_seconds', e.target.checked)}
                    className="w-4 h-4 accent-cyan-400 rounded"
                  />
                </label>

                <label className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer">
                  <div>
                    <div className="text-xs font-medium text-white">24-Hour Format</div>
                    <div className="text-[10px] text-slate-500">Display 21:40 instead of 9:40</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={Boolean(clockConfig.format_24h)}
                    onChange={(e) => updateField('format_24h', e.target.checked)}
                    className="w-4 h-4 accent-cyan-400 rounded"
                  />
                </label>

                <label className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer">
                  <div>
                    <div className="text-xs font-medium text-white">Show Date Below Clock</div>
                    <div className="text-[10px] text-slate-500">e.g. Saturday 31 October</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={clockConfig.show_date !== false}
                    onChange={(e) => updateField('show_date', e.target.checked)}
                    className="w-4 h-4 accent-cyan-400 rounded"
                  />
                </label>

                {clockConfig.show_date !== false && (
                  <div className="pl-2">
                    <label className="block text-[11px] text-slate-400 mb-1">Date Text Color</label>
                    <div className="flex items-center space-x-2">
                      <input
                        type="color"
                        value={(clockConfig.color_date || '#CCFFFFFF').slice(0, 7)}
                        onChange={(e) => updateField('color_date', e.target.value)}
                        className="w-8 h-8 rounded cursor-pointer bg-transparent"
                      />
                      <input
                        type="text"
                        value={clockConfig.color_date || '#CCFFFFFF'}
                        onChange={(e) => updateField('color_date', e.target.value)}
                        className="flex-1 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono"
                      />
                    </div>
                  </div>
                )}

                <label className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer">
                  <div>
                    <div className="text-xs font-medium text-white">Show Greeting & Weather</div>
                    <div className="text-[10px] text-slate-500">e.g. GOOD MORNING • 29°C CLEAR</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={clockConfig.show_greeting !== false}
                    onChange={(e) => updateField('show_greeting', e.target.checked)}
                    className="w-4 h-4 accent-cyan-400 rounded"
                  />
                </label>
              </div>
            )}

          </div>
        </aside>

      </div>
    </div>
  );
}
