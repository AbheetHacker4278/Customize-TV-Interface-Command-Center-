import React, { useState, useEffect, useRef } from 'react';
import { 
  Clock, 
  Save, 
  Copy, 
  Trash2, 
  Tv, 
  Maximize2, 
  Minimize2, 
  Sliders, 
  Type, 
  Palette, 
  Calendar, 
  Compass, 
  Image as ImageIcon, 
  Sparkles, 
  Check, 
  RefreshCw, 
  Plus, 
  Search, 
  Upload, 
  ExternalLink,
  ChevronRight,
  Sun,
  Moon,
  Layers,
  Shield,
  Monitor
} from 'lucide-react';
import { apiRequest, socket } from './api';
import ClockFaceRenderer from './ClockFaceRenderer';

export default function ClockFaceStudio({ showToast, tvConnected }) {
  // State: Clock Faces Collection
  const [clockFaces, setClockFaces] = useState([]);
  const [activeFaceId, setActiveFaceId] = useState(null);
  const [selectedFace, setSelectedFace] = useState(null);
  const [editedConfig, setEditedConfig] = useState(null);
  const [designName, setDesignName] = useState('');
  const [hasChanges, setHasChanges] = useState(false);

  // Studio UI Controls
  const [activeControlTab, setActiveControlTab] = useState('style'); // style, typography, colors, elements, specifics, background
  const [aspectRatio, setAspectRatio] = useState('16:9'); // 16:9 or 21:9
  const [is24HourOverride, setIs24HourOverride] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [libraryFilter, setLibraryFilter] = useState('all'); // all, presets, custom
  const [searchQuery, setSearchQuery] = useState('');
  const [tvClockOnline, setTvClockOnline] = useState(false);
  const [tvClockClients, setTvClockClients] = useState(0);

  // Async Action Loaders
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [applying, setApplying] = useState(false);
  const [launchingTv, setLaunchingTv] = useState(false);
  const [uploadingBg, setUploadingBg] = useState(false);

  const previewContainerRef = useRef(null);
  const fileInputRef = useRef(null);

  // ---------------- Load Clock Faces ----------------
  const fetchClockFaces = async () => {
    try {
      const res = await apiRequest('/clock-faces');
      if (res.success) {
        setClockFaces(res.clockFaces || []);
        setActiveFaceId(res.activeId);
        setTvClockOnline(Boolean(res.tvClockOnline));
        setTvClockClients(res.tvClockClients || 0);

        // Select initial design (either current active or first)
        if (!selectedFace) {
          const initial = res.clockFaces.find(f => f.id === res.activeId) || res.clockFaces[0];
          if (initial) {
            setSelectedFace(initial);
            setEditedConfig(JSON.parse(JSON.stringify(initial.config)));
            setDesignName(initial.name);
            setHasChanges(false);
          }
        }
      }
    } catch (e) {
      showToast('Could not load clock faces: ' + e.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClockFaces();

    // Listen to real-time events
    const handleClockUpdated = (face) => {
      setActiveFaceId(face.id);
      setClockFaces(prev => prev.map(f => f.id === face.id ? { ...f, ...face, is_active: true } : { ...f, is_active: false }));
    };

    const handleTvClockStatus = (status) => {
      setTvClockOnline(Boolean(status.online));
      setTvClockClients(status.count || 0);
    };

    socket.on('clock_face_updated', handleClockUpdated);
    socket.on('tv_clock_status', handleTvClockStatus);

    return () => {
      socket.off('clock_face_updated', handleClockUpdated);
      socket.off('tv_clock_status', handleTvClockStatus);
    };
  }, []);

  // ---------------- Select Design ----------------
  const handleSelectDesign = (face) => {
    setSelectedFace(face);
    setEditedConfig(JSON.parse(JSON.stringify(face.config)));
    setDesignName(face.name);
    setHasChanges(false);
  };

  // ---------------- Config Mutation Helper ----------------
  const updateConfig = (key, value) => {
    setEditedConfig(prev => {
      const next = { ...prev, [key]: value };
      setHasChanges(true);
      return next;
    });
  };

  // ---------------- Create New Design ----------------
  const handleCreateNew = async () => {
    const newStyle = 'minimal-digital';
    const newConfig = {
      fontFamily: 'Inter',
      fontWeight: '300',
      fontSize: 100,
      letterSpacing: -0.04,
      textColor: '#ffffff',
      useGradient: false,
      gradientColors: ['#ffffff', '#94a3b8'],
      gradientAngle: 135,
      showSeconds: true,
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
    };

    try {
      const res = await apiRequest('/clock-faces', 'POST', {
        name: `Custom Clock #${clockFaces.length + 1}`,
        style: newStyle,
        config: newConfig,
        isDefault: 0,
      });

      if (res.success && res.face) {
        setClockFaces(prev => [res.face, ...prev]);
        handleSelectDesign(res.face);
        showToast('Created new custom clock face!', 'success');
      }
    } catch (e) {
      showToast(e.message, 'error');
    }
  };

  // ---------------- Save Design ----------------
  const handleSaveDesign = async () => {
    if (!selectedFace || !editedConfig) return;
    setSaving(true);
    try {
      const res = await apiRequest(`/clock-faces/${selectedFace.id}`, 'PUT', {
        name: designName.trim() || selectedFace.name,
        style: selectedFace.style,
        config: editedConfig,
      });

      if (res.success && res.face) {
        setClockFaces(prev => prev.map(f => f.id === res.face.id ? res.face : f));
        setSelectedFace(res.face);
        setHasChanges(false);
        showToast(`Saved "${res.face.name}"!`, 'success');
      }
    } catch (e) {
      showToast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  // ---------------- Duplicate Design ----------------
  const handleDuplicate = async (faceId = null) => {
    const targetId = faceId || selectedFace?.id;
    if (!targetId) return;

    try {
      const res = await apiRequest(`/clock-faces/${targetId}/duplicate`, 'POST');
      if (res.success && res.face) {
        setClockFaces(prev => [res.face, ...prev]);
        handleSelectDesign(res.face);
        showToast(`Duplicated into "${res.face.name}"`, 'success');
      }
    } catch (e) {
      showToast(e.message, 'error');
    }
  };

  // ---------------- Delete Design ----------------
  const handleDelete = async (faceId) => {
    const target = clockFaces.find(f => f.id === faceId);
    if (!target) return;
    if (target.is_default) {
      showToast('Built-in presets cannot be deleted.', 'error');
      return;
    }

    if (!window.confirm(`Are you sure you want to delete "${target.name}"?`)) return;

    try {
      const res = await apiRequest(`/clock-faces/${faceId}`, 'DELETE');
      if (res.success) {
        const remaining = clockFaces.filter(f => f.id !== faceId);
        setClockFaces(remaining);
        if (selectedFace?.id === faceId) {
          const next = remaining[0];
          if (next) handleSelectDesign(next);
        }
        showToast('Clock face deleted.', 'info');
      }
    } catch (e) {
      showToast(e.message, 'error');
    }
  };

  // ---------------- Apply to TV ----------------
  const handleApplyToTv = async () => {
    if (!selectedFace) return;
    setApplying(true);

    try {
      // First save if there are unsaved local modifications
      if (hasChanges) {
        await apiRequest(`/clock-faces/${selectedFace.id}`, 'PUT', {
          name: designName.trim() || selectedFace.name,
          style: selectedFace.style,
          config: editedConfig,
        });
        setHasChanges(false);
      }

      // Then apply to TV
      const res = await apiRequest(`/clock-faces/${selectedFace.id}/apply`, 'POST', {
        autoLaunch: true,
      });

      if (res.success) {
        setActiveFaceId(selectedFace.id);
        setClockFaces(prev => prev.map(f => ({
          ...f,
          is_active: f.id === selectedFace.id,
        })));
        showToast(`✨ Applied "${selectedFace.name}" to TV!`, 'success');
      }
    } catch (e) {
      showToast('Could not apply to TV: ' + e.message, 'error');
    } finally {
      setApplying(false);
    }
  };

  // ---------------- Launch TV Browser ----------------
  const handleLaunchTvBrowser = async () => {
    setLaunchingTv(true);
    try {
      const res = await apiRequest('/clock-faces/tv/launch', 'POST');
      if (res.success) {
        showToast('Opened Clock Face in TV Browser!', 'success');
      }
    } catch (e) {
      showToast('TV Launch Error: ' + e.message, 'error');
    } finally {
      setLaunchingTv(false);
    }
  };

  // ---------------- Upload Custom Background Image ----------------
  const handleBgUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast('Please select a valid image file (JPG, PNG, WebP)', 'error');
      return;
    }

    setUploadingBg(true);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const res = await apiRequest('/clock-faces/upload-bg', 'POST', {
          dataBase64: reader.result,
        });

        if (res.success && res.url) {
          updateConfig('backgroundMode', 'wallpaper');
          updateConfig('wallpaperUrl', res.url);
          showToast('Custom background uploaded & applied!', 'success');
        }
      } catch (err) {
        showToast(err.message, 'error');
      } finally {
        setUploadingBg(false);
      }
    };
    reader.readAsDataURL(file);
  };

  // ---------------- Fullscreen Mode ----------------
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      previewContainerRef.current?.requestFullscreen?.();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.();
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  // Filtered designs for library
  const filteredDesigns = clockFaces.filter(face => {
    const matchesSearch = face.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          face.style.toLowerCase().includes(searchQuery.toLowerCase());
    if (libraryFilter === 'presets') return matchesSearch && face.is_default;
    if (libraryFilter === 'custom') return matchesSearch && !face.is_default;
    return matchesSearch;
  });

  const isCurrentActiveOnTv = selectedFace?.id === activeFaceId;

  // Temporary face object passed to renderer with live edits
  const currentRenderFace = selectedFace ? {
    ...selectedFace,
    name: designName,
    config: editedConfig || selectedFace.config,
  } : null;

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-slate-950 text-slate-100 overflow-hidden">
      
      {/* ---------------- Top Studio Toolbar ---------------- */}
      <header className="h-16 border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-xl px-6 flex items-center justify-between shrink-0">
        
        {/* Left: Design Info & Edit Title */}
        <div className="flex items-center space-x-3.5">
          <div className="p-2 bg-gradient-to-br from-cyan-500/20 to-blue-600/20 rounded-xl text-cyan-400 border border-cyan-500/30">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={designName}
                onChange={(e) => {
                  setDesignName(e.target.value);
                  setHasChanges(true);
                }}
                className="bg-transparent text-sm font-semibold text-white tracking-wide border-b border-transparent hover:border-slate-700 focus:border-cyan-400 focus:outline-none px-1 py-0.5 rounded transition-all"
                placeholder="Clock Face Name"
              />
              {selectedFace?.is_default ? (
                <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                  Preset
                </span>
              ) : (
                <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  Custom
                </span>
              )}
            </div>
            
            <p className="text-[11px] text-slate-400 flex items-center space-x-2">
              <span className="capitalize">{selectedFace?.style?.replace('-', ' ')}</span>
              <span>•</span>
              <span className="text-slate-500">Sony BRAVIA 4K Integration</span>
            </p>
          </div>
        </div>

        {/* Center: Live TV Synchronization Status Badge */}
        <div className="hidden lg:flex items-center space-x-3">
          <div className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-full text-xs font-medium border backdrop-blur-md ${
            isCurrentActiveOnTv 
              ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300' 
              : hasChanges 
                ? 'bg-amber-500/15 border-amber-500/30 text-amber-300' 
                : 'bg-slate-800/80 border-slate-700 text-slate-400'
          }`}>
            <span className={`w-2 h-2 rounded-full ${
              isCurrentActiveOnTv ? 'bg-emerald-400 animate-pulse' : hasChanges ? 'bg-amber-400' : 'bg-slate-400'
            }`} />
            <span>
              {isCurrentActiveOnTv ? 'Applied to TV (Active)' : hasChanges ? 'Unsaved Modifications' : 'Saved in Library'}
            </span>
          </div>

          <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs bg-slate-800/50 border border-slate-700/60 text-slate-400">
            <Monitor className="w-3.5 h-3.5 text-cyan-400" />
            <span>TV Browser:</span>
            <span className={tvClockOnline ? 'text-emerald-400 font-medium' : 'text-slate-500'}>
              {tvClockOnline ? `Online (${tvClockClients} connected)` : 'Ready'}
            </span>
          </div>
        </div>

        {/* Right: Studio Primary Action Buttons */}
        <div className="flex items-center space-x-2.5">
          
          {/* Duplicate Button */}
          <button
            onClick={() => handleDuplicate()}
            title="Duplicate this design"
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-slate-800/70 hover:bg-slate-800 text-slate-300 border border-slate-700 transition-all cursor-pointer"
          >
            <Copy className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Duplicate</span>
          </button>

          {/* Save Button */}
          <button
            onClick={handleSaveDesign}
            disabled={saving || !hasChanges}
            className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl text-xs font-medium border transition-all cursor-pointer ${
              hasChanges 
                ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/30' 
                : 'bg-slate-800/40 border-slate-800 text-slate-500 cursor-not-allowed'
            }`}
          >
            {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            <span>Save</span>
          </button>

          {/* Launch on TV Browser */}
          <button
            onClick={handleLaunchTvBrowser}
            disabled={launchingTv}
            title="Open or focus TV Browser app on this clock"
            className="hidden md:flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-slate-800/70 hover:bg-slate-800 text-slate-200 border border-slate-700 transition-all cursor-pointer"
          >
            {launchingTv ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Tv className="w-3.5 h-3.5 text-cyan-400" />}
            <span>Launch TV</span>
          </button>

          {/* PRIMARY: Apply to TV */}
          <button
            onClick={handleApplyToTv}
            disabled={applying}
            className="flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-cyan-500 via-sky-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-lg shadow-cyan-500/25 border border-cyan-400/30 transition-all cursor-pointer active:scale-95"
          >
            {applying ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            <span>Apply to TV</span>
          </button>
        </div>
      </header>

      {/* ---------------- 3-Column Studio Body ---------------- */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        
        {/* ================= COLUMN 1: Clock Face Library ================= */}
        <aside className="w-72 border-r border-slate-800/80 bg-slate-900/40 flex flex-col shrink-0">
          
          {/* Library Header */}
          <div className="p-4 border-b border-slate-800/80 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Clock Library ({clockFaces.length})
              </span>
              <button
                onClick={handleCreateNew}
                className="flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/20 transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New</span>
              </button>
            </div>

            {/* Filter Tabs */}
            <div className="grid grid-cols-3 gap-1 bg-slate-950/70 p-1 rounded-lg border border-slate-800 text-[11px]">
              {['all', 'presets', 'custom'].map(tab => (
                <button
                  key={tab}
                  onClick={() => setLibraryFilter(tab)}
                  className={`py-1 rounded text-center capitalize font-medium transition-all cursor-pointer ${
                    libraryFilter === tab 
                      ? 'bg-cyan-500/20 text-cyan-300' 
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
              <input
                type="text"
                placeholder="Search clock designs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-slate-950/60 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
              />
            </div>
          </div>

          {/* Library Designs List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {filteredDesigns.map(face => {
              const isSelected = selectedFace?.id === face.id;
              const isActiveTv = activeFaceId === face.id;

              return (
                <div
                  key={face.id}
                  onClick={() => handleSelectDesign(face)}
                  className={`group relative p-3 rounded-xl border transition-all cursor-pointer ${
                    isSelected 
                      ? 'bg-slate-800/90 border-cyan-500/50 ring-1 ring-cyan-500/30' 
                      : 'bg-slate-900/60 hover:bg-slate-850 border-slate-800/80 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-xs font-semibold text-white tracking-wide group-hover:text-cyan-300 transition-colors">
                        {face.name}
                      </h4>
                      <p className="text-[10px] text-slate-400 capitalize mt-0.5">
                        {face.style.replace('-', ' ')}
                      </p>
                    </div>

                    {isActiveTv && (
                      <span className="flex items-center space-x-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 uppercase tracking-wider">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        <span>Active</span>
                      </span>
                    )}
                  </div>

                  {/* Card Actions Footer */}
                  <div className="mt-2.5 pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-500">
                    <span className="text-[10px]">
                      {face.is_default ? 'Curated' : 'Custom'}
                    </span>

                    <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDuplicate(face.id);
                        }}
                        title="Duplicate"
                        className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-slate-200 cursor-pointer"
                      >
                        <Copy className="w-3 h-3" />
                      </button>

                      {!face.is_default && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(face.id);
                          }}
                          title="Delete"
                          className="p-1 rounded hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {filteredDesigns.length === 0 && (
              <div className="p-8 text-center text-xs text-slate-500">
                No matching clock designs found.
              </div>
            )}
          </div>
        </aside>

        {/* ================= COLUMN 2: Live Design Preview ================= */}
        <main className="flex-1 flex flex-col min-w-0 bg-slate-950/80 p-6 overflow-hidden">
          
          {/* Preview Controls Bar */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Live TV Screen Preview
              </span>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                Real-Time Clock
              </span>
            </div>

            <div className="flex items-center space-x-2">
              {/* Aspect Ratio Switcher */}
              <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5 text-xs">
                {['16:9', '21:9'].map(ratio => (
                  <button
                    key={ratio}
                    onClick={() => setAspectRatio(ratio)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all cursor-pointer ${
                      aspectRatio === ratio 
                        ? 'bg-cyan-500/20 text-cyan-300' 
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {ratio} {ratio === '16:9' ? '(4K / TV)' : '(Ultrawide)'}
                  </button>
                ))}
              </div>

              {/* 12h / 24h Toggle */}
              <button
                onClick={() => {
                  const current24 = is24HourOverride !== null ? is24HourOverride : Boolean(editedConfig?.is24Hour);
                  setIs24HourOverride(!current24);
                }}
                className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 transition-all cursor-pointer"
              >
                {(is24HourOverride !== null ? is24HourOverride : editedConfig?.is24Hour) ? '24-Hour' : '12-Hour'}
              </button>

              {/* Fullscreen Button */}
              <button
                onClick={toggleFullscreen}
                title="Preview in Fullscreen"
                className="p-1.5 rounded-lg text-xs bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 transition-all cursor-pointer"
              >
                {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* TV Display Stage (Bezel Simulator) */}
          <div className="flex-1 flex items-center justify-center min-h-0 overflow-hidden">
            <div 
              ref={previewContainerRef}
              className={`relative rounded-3xl overflow-hidden shadow-2xl border-4 border-slate-800/90 transition-all ${
                isFullscreen 
                  ? 'w-screen h-screen rounded-none border-none' 
                  : aspectRatio === '16:9' 
                    ? 'w-full max-w-5xl aspect-video' 
                    : 'w-full max-w-6xl aspect-[21/9]'
              }`}
              style={{
                boxShadow: '0 25px 70px -10px rgba(0, 0, 0, 0.9), 0 0 0 1px rgba(255, 255, 255, 0.05)',
              }}
            >
              {currentRenderFace ? (
                <ClockFaceRenderer
                  face={currentRenderFace}
                  is24HourOverride={is24HourOverride}
                  className="w-full h-full"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-slate-900 text-slate-500 text-xs">
                  Select a clock face from the library to preview
                </div>
              )}

              {/* Fullscreen Exit Overlay */}
              {isFullscreen && (
                <button
                  onClick={toggleFullscreen}
                  className="absolute top-6 right-6 z-50 px-4 py-2 rounded-xl bg-slate-900/80 hover:bg-slate-900 border border-white/20 text-white text-xs font-medium backdrop-blur-md transition-all cursor-pointer"
                >
                  ✕ Exit Fullscreen (ESC)
                </button>
              )}
            </div>
          </div>

          {/* Bottom Quick Advice Pill */}
          <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
            <span className="flex items-center space-x-1.5">
              <Shield className="w-3.5 h-3.5 text-cyan-400" />
              <span>Anti Burn-In Sub-Pixel OLED Drift Protection Active</span>
            </span>
            <span>Target: Sony BRAVIA 4K ({tvConnected ? 'Connected' : 'Offline'})</span>
          </div>
        </main>

        {/* ================= COLUMN 3: Customization Controls ================= */}
        <aside className="w-84 border-l border-slate-800/80 bg-slate-900/50 flex flex-col shrink-0">
          
          {/* Controls Tabs */}
          <div className="p-3 border-b border-slate-800/80">
            <div className="grid grid-cols-6 gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-[11px]">
              {[
                { id: 'style', icon: Compass, label: 'Style' },
                { id: 'typography', icon: Type, label: 'Type' },
                { id: 'colors', icon: Palette, label: 'Colors' },
                { id: 'elements', icon: Calendar, label: 'Items' },
                { id: 'specifics', icon: Sliders, label: 'Tuning' },
                { id: 'background', icon: ImageIcon, label: 'Backdrop' },
              ].map(tab => {
                const Icon = tab.icon;
                const active = activeControlTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveControlTab(tab.id)}
                    title={tab.label}
                    className={`py-2 rounded-lg flex flex-col items-center justify-center transition-all cursor-pointer ${
                      active 
                        ? 'bg-cyan-500/20 text-cyan-300 font-medium' 
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span className="text-[9px] mt-1">{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Controls Scrollable Form */}
          <div className="flex-1 overflow-y-auto p-5 space-y-6 text-xs text-slate-300">
            {editedConfig && (
              <>
                {/* ---------------- TAB 1: STYLE & PRESETS ---------------- */}
                {activeControlTab === 'style' && (
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-xs font-semibold text-white uppercase tracking-wider mb-2">
                        Select Clock Style
                      </h4>
                      <div className="grid grid-cols-1 gap-2">
                        {[
                          { id: 'minimal-digital', name: 'Minimal Digital Clock', desc: 'Ultra-clean, thin typography with subtle date' },
                          { id: 'analog', name: 'Analog Clock', desc: 'Customizable dials, ticks, and sweeping hands' },
                          { id: 'flip', name: 'Flip Clock', desc: 'Vintage mechanical split-flap cards' },
                          { id: 'modern-digital', name: 'Modern Digital Clock', desc: 'Pill container with bold gradients' },
                          { id: 'futuristic-neon', name: 'Futuristic / Neon Clock', desc: 'Cyberpunk chromatic glow & scanlines' },
                          { id: 'minimal-typography', name: 'Minimal Typography Clock', desc: 'Editorial serif & luxury aesthetics' },
                          { id: 'date-time-dashboard', name: 'Date & Time Dashboard', desc: 'Glassmorphic status & info cards' },
                        ].map(st => {
                          const isCur = selectedFace?.style === st.id;
                          return (
                            <button
                              key={st.id}
                              onClick={() => {
                                setSelectedFace(prev => ({ ...prev, style: st.id }));
                                setHasChanges(true);
                              }}
                              className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                                isCur 
                                  ? 'bg-cyan-500/15 border-cyan-500/50 text-white ring-1 ring-cyan-500/30' 
                                  : 'bg-slate-900/60 hover:bg-slate-800 border-slate-800 text-slate-300'
                              }`}
                            >
                              <div className="font-semibold text-xs text-white">{st.name}</div>
                              <div className="text-[11px] text-slate-400 mt-0.5">{st.desc}</div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* ---------------- TAB 2: TYPOGRAPHY & LAYOUT ---------------- */}
                {activeControlTab === 'typography' && (
                  <div className="space-y-5">
                    {/* Font Family */}
                    <div>
                      <label className="block text-xs font-semibold text-white mb-1.5">
                        Font Family
                      </label>
                      <select
                        value={editedConfig.fontFamily || 'Inter'}
                        onChange={(e) => updateConfig('fontFamily', e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-cyan-500/50"
                      >
                        <option value="Inter">Inter (Clean Neo-Grotesque)</option>
                        <option value="Outfit">Outfit (Modern Geometric)</option>
                        <option value="Space Grotesk">Space Grotesk (Tech Display)</option>
                        <option value="Orbitron">Orbitron (Sci-Fi Futuristic)</option>
                        <option value="Cinzel">Cinzel (Classical Luxury Serif)</option>
                        <option value="Playfair Display">Playfair Display (Editorial)</option>
                        <option value="JetBrains Mono">JetBrains Mono (Monospace)</option>
                        <option value="Bebas Neue">Bebas Neue (Tall Display)</option>
                      </select>
                    </div>

                    {/* Font Weight */}
                    <div>
                      <label className="block text-xs font-semibold text-white mb-1.5">
                        Font Weight
                      </label>
                      <div className="grid grid-cols-3 gap-1.5">
                        {['300', '400', '500', '600', '700', '800'].map(w => (
                          <button
                            key={w}
                            onClick={() => updateConfig('fontWeight', w)}
                            className={`py-1.5 rounded-lg border text-xs font-medium cursor-pointer ${
                              editedConfig.fontWeight === w 
                                ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300' 
                                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                            }`}
                          >
                            {w === '300' ? 'Light' : w === '400' ? 'Normal' : w === '500' ? 'Medium' : w === '600' ? 'SemiBold' : w === '700' ? 'Bold' : 'Black'}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Clock Scale */}
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="font-semibold text-white">Clock Scale / Size</span>
                        <span className="text-cyan-400">{editedConfig.fontSize || 100}%</span>
                      </div>
                      <input
                        type="range"
                        min="50"
                        max="180"
                        value={editedConfig.fontSize || 100}
                        onChange={(e) => updateConfig('fontSize', Number(e.target.value))}
                        className="w-full accent-cyan-400 cursor-pointer"
                      />
                    </div>

                    {/* Letter Spacing */}
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="font-semibold text-white">Letter Spacing</span>
                        <span className="text-cyan-400">{editedConfig.letterSpacing || 0}em</span>
                      </div>
                      <input
                        type="range"
                        min="-0.06"
                        max="0.25"
                        step="0.01"
                        value={editedConfig.letterSpacing || 0}
                        onChange={(e) => updateConfig('letterSpacing', Number(e.target.value))}
                        className="w-full accent-cyan-400 cursor-pointer"
                      />
                    </div>

                    {/* Alignment */}
                    <div>
                      <label className="block text-xs font-semibold text-white mb-1.5">
                        Screen Alignment
                      </label>
                      <div className="grid grid-cols-3 gap-1.5 mb-2">
                        {['left', 'center', 'right'].map(h => (
                          <button
                            key={h}
                            onClick={() => updateConfig('alignmentH', h)}
                            className={`py-1.5 rounded-lg border text-xs capitalize font-medium cursor-pointer ${
                              editedConfig.alignmentH === h 
                                ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300' 
                                : 'bg-slate-950 border-slate-800 text-slate-400'
                            }`}
                          >
                            {h}
                          </button>
                        ))}
                      </div>
                      <div className="grid grid-cols-3 gap-1.5">
                        {['top', 'center', 'bottom'].map(v => (
                          <button
                            key={v}
                            onClick={() => updateConfig('alignmentV', v)}
                            className={`py-1.5 rounded-lg border text-xs capitalize font-medium cursor-pointer ${
                              editedConfig.alignmentV === v 
                                ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300' 
                                : 'bg-slate-950 border-slate-800 text-slate-400'
                            }`}
                          >
                            {v}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Fine Position Offset */}
                    <div className="space-y-3 pt-2 border-t border-slate-800">
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-slate-400">Horizontal Offset (X)</span>
                          <span className="text-cyan-400">{editedConfig.xOffset || 0}px</span>
                        </div>
                        <input
                          type="range"
                          min="-200"
                          max="200"
                          value={editedConfig.xOffset || 0}
                          onChange={(e) => updateConfig('xOffset', Number(e.target.value))}
                          className="w-full accent-cyan-400 cursor-pointer"
                        />
                      </div>

                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-slate-400">Vertical Offset (Y)</span>
                          <span className="text-cyan-400">{editedConfig.yOffset || 0}px</span>
                        </div>
                        <input
                          type="range"
                          min="-200"
                          max="200"
                          value={editedConfig.yOffset || 0}
                          onChange={(e) => updateConfig('yOffset', Number(e.target.value))}
                          className="w-full accent-cyan-400 cursor-pointer"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* ---------------- TAB 3: COLORS & EFFECTS ---------------- */}
                {activeControlTab === 'colors' && (
                  <div className="space-y-5">
                    {/* Color Mode: Solid vs Gradient */}
                    <div>
                      <label className="block text-xs font-semibold text-white mb-1.5">
                        Text Color Mode
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => updateConfig('useGradient', false)}
                          className={`py-2 rounded-xl border text-xs font-medium cursor-pointer ${
                            !editedConfig.useGradient 
                              ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300' 
                              : 'bg-slate-950 border-slate-800 text-slate-400'
                          }`}
                        >
                          Solid Color
                        </button>
                        <button
                          onClick={() => updateConfig('useGradient', true)}
                          className={`py-2 rounded-xl border text-xs font-medium cursor-pointer ${
                            editedConfig.useGradient 
                              ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300' 
                              : 'bg-slate-950 border-slate-800 text-slate-400'
                          }`}
                        >
                          Linear Gradient
                        </button>
                      </div>
                    </div>

                    {/* Solid Text Color */}
                    {!editedConfig.useGradient && (
                      <div>
                        <label className="block text-xs font-semibold text-white mb-1.5">
                          Text Color
                        </label>
                        <div className="flex items-center space-x-3">
                          <input
                            type="color"
                            value={editedConfig.textColor || '#ffffff'}
                            onChange={(e) => updateConfig('textColor', e.target.value)}
                            className="w-10 h-10 rounded-lg cursor-pointer bg-transparent border-0"
                          />
                          <input
                            type="text"
                            value={editedConfig.textColor || '#ffffff'}
                            onChange={(e) => updateConfig('textColor', e.target.value)}
                            className="flex-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs font-mono"
                          />
                        </div>
                      </div>
                    )}

                    {/* Gradient Colors */}
                    {editedConfig.useGradient && (
                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs text-slate-400 mb-1">Gradient Colors</label>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="flex items-center space-x-2">
                              <input
                                type="color"
                                value={editedConfig.gradientColors?.[0] || '#38bdf8'}
                                onChange={(e) => {
                                  const c = [...(editedConfig.gradientColors || ['#38bdf8', '#c084fc'])];
                                  c[0] = e.target.value;
                                  updateConfig('gradientColors', c);
                                }}
                                className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0"
                              />
                              <span className="text-[11px] font-mono text-slate-300">
                                {editedConfig.gradientColors?.[0] || '#38bdf8'}
                              </span>
                            </div>
                            <div className="flex items-center space-x-2">
                              <input
                                type="color"
                                value={editedConfig.gradientColors?.[1] || '#c084fc'}
                                onChange={(e) => {
                                  const c = [...(editedConfig.gradientColors || ['#38bdf8', '#c084fc'])];
                                  c[1] = e.target.value;
                                  updateConfig('gradientColors', c);
                                }}
                                className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0"
                              />
                              <span className="text-[11px] font-mono text-slate-300">
                                {editedConfig.gradientColors?.[1] || '#c084fc'}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-slate-400">Gradient Angle</span>
                            <span className="text-cyan-400">{editedConfig.gradientAngle || 90}°</span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="360"
                            value={editedConfig.gradientAngle || 90}
                            onChange={(e) => updateConfig('gradientAngle', Number(e.target.value))}
                            className="w-full accent-cyan-400 cursor-pointer"
                          />
                        </div>
                      </div>
                    )}

                    {/* Glow & Neon Effects */}
                    <div className="space-y-3 pt-3 border-t border-slate-800">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-semibold text-white block">Glow / Neon Shadow</span>
                          <span className="text-[10px] text-slate-500">Luminous aura around typography</span>
                        </div>
                        <input
                          type="checkbox"
                          checked={Boolean(editedConfig.glow)}
                          onChange={(e) => updateConfig('glow', e.target.checked)}
                          className="w-4 h-4 accent-cyan-400 rounded cursor-pointer"
                        />
                      </div>

                      {editedConfig.glow && (
                        <div className="space-y-3 pl-2 border-l-2 border-cyan-500/30">
                          <div>
                            <label className="block text-[11px] text-slate-400 mb-1">Glow Color</label>
                            <div className="flex items-center space-x-2">
                              <input
                                type="color"
                                value={editedConfig.glowColor || '#38bdf8'}
                                onChange={(e) => updateConfig('glowColor', e.target.value)}
                                className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0"
                              />
                              <span className="text-xs font-mono">{editedConfig.glowColor || '#38bdf8'}</span>
                            </div>
                          </div>

                          <div>
                            <div className="flex justify-between text-xs mb-1">
                              <span className="text-slate-400">Glow Blur Radius</span>
                              <span className="text-cyan-400">{editedConfig.glowBlur || 20}px</span>
                            </div>
                            <input
                              type="range"
                              min="4"
                              max="50"
                              value={editedConfig.glowBlur || 20}
                              onChange={(e) => updateConfig('glowBlur', Number(e.target.value))}
                              className="w-full accent-cyan-400 cursor-pointer"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* ---------------- TAB 4: ELEMENTS & DATE ---------------- */}
                {activeControlTab === 'elements' && (
                  <div className="space-y-4">
                    {/* Time Elements Toggles */}
                    <div className="space-y-3">
                      <h4 className="text-xs font-semibold text-white uppercase tracking-wider mb-2">
                        Display Elements
                      </h4>

                      <label className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer">
                        <span>Show Seconds</span>
                        <input
                          type="checkbox"
                          checked={editedConfig.showSeconds !== false}
                          onChange={(e) => updateConfig('showSeconds', e.target.checked)}
                          className="w-4 h-4 accent-cyan-400 rounded"
                        />
                      </label>

                      <label className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer">
                        <span>Show AM / PM Marker</span>
                        <input
                          type="checkbox"
                          checked={Boolean(editedConfig.showAmPm)}
                          onChange={(e) => updateConfig('showAmPm', e.target.checked)}
                          className="w-4 h-4 accent-cyan-400 rounded"
                        />
                      </label>

                      <label className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer">
                        <span>24-Hour Time Format</span>
                        <input
                          type="checkbox"
                          checked={Boolean(editedConfig.is24Hour)}
                          onChange={(e) => updateConfig('is24Hour', e.target.checked)}
                          className="w-4 h-4 accent-cyan-400 rounded"
                        />
                      </label>
                    </div>

                    {/* Date Toggles */}
                    <div className="space-y-3 pt-3 border-t border-slate-800">
                      <label className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer">
                        <span className="font-semibold text-white">Show Date</span>
                        <input
                          type="checkbox"
                          checked={Boolean(editedConfig.showDate)}
                          onChange={(e) => updateConfig('showDate', e.target.checked)}
                          className="w-4 h-4 accent-cyan-400 rounded"
                        />
                      </label>

                      {editedConfig.showDate && (
                        <div className="space-y-3 pl-2">
                          <div>
                            <label className="block text-[11px] text-slate-400 mb-1">Date Format</label>
                            <select
                              value={editedConfig.dateFormat || 'EEEE, d MMMM'}
                              onChange={(e) => updateConfig('dateFormat', e.target.value)}
                              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs"
                            >
                              <option value="EEEE, d MMMM">Tuesday, 27 October</option>
                              <option value="EEE, d MMM">Tue, 27 Oct</option>
                              <option value="Tuesday 27 October">Tuesday 27 October</option>
                              <option value="EEEE, MMMM d, yyyy">Tuesday, October 27, 2026</option>
                              <option value="MMMM d, yyyy">October 27, 2026</option>
                              <option value="YYYY.MM.DD // PROTOCOL-7">2026.10.27 // PROTOCOL-7</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-[11px] text-slate-400 mb-1">Date Position</label>
                            <div className="grid grid-cols-2 gap-2">
                              {['below', 'above'].map(pos => (
                                <button
                                  key={pos}
                                  onClick={() => updateConfig('datePosition', pos)}
                                  className={`py-1.5 rounded-lg border text-xs capitalize font-medium cursor-pointer ${
                                    (editedConfig.datePosition || 'below') === pos 
                                      ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300' 
                                      : 'bg-slate-950 border-slate-800 text-slate-400'
                                  }`}
                                >
                                  {pos}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div>
                            <div className="flex justify-between text-xs mb-1">
                              <span className="text-slate-400">Date Font Size</span>
                              <span className="text-cyan-400">{editedConfig.dateFontSize || 24}px</span>
                            </div>
                            <input
                              type="range"
                              min="14"
                              max="48"
                              value={editedConfig.dateFontSize || 24}
                              onChange={(e) => updateConfig('dateFontSize', Number(e.target.value))}
                              className="w-full accent-cyan-400 cursor-pointer"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* ---------------- TAB 5: STYLE SPECIFICS ---------------- */}
                {activeControlTab === 'specifics' && (
                  <div className="space-y-4">
                    {/* Specifics for Analog Clock */}
                    {selectedFace?.style === 'analog' && (
                      <div className="space-y-4">
                        <h4 className="text-xs font-semibold text-white uppercase tracking-wider mb-2">
                          Analog Dial & Hands Tuning
                        </h4>

                        {/* Dial Shape */}
                        <div>
                          <label className="block text-xs text-slate-400 mb-1">Dial Shape</label>
                          <div className="grid grid-cols-2 gap-2">
                            {['circle', 'squircle'].map(sh => (
                              <button
                                key={sh}
                                onClick={() => updateConfig('dialShape', sh)}
                                className={`py-1.5 rounded-lg border text-xs capitalize font-medium cursor-pointer ${
                                  (editedConfig.dialShape || 'circle') === sh 
                                    ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300' 
                                    : 'bg-slate-950 border-slate-800 text-slate-400'
                                }`}
                              >
                                {sh}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Markers Style */}
                        <div>
                          <label className="block text-xs text-slate-400 mb-1">Marker Style</label>
                          <select
                            value={editedConfig.markerStyle || 'ticks'}
                            onChange={(e) => updateConfig('markerStyle', e.target.value)}
                            className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs"
                          >
                            <option value="ticks">Precision Ticks</option>
                            <option value="dots">Minimal Dots</option>
                            <option value="numbers">Arabic Numbers (1-12)</option>
                            <option value="roman">Roman Numerals (I-XII)</option>
                          </select>
                        </div>

                        {/* Sweep Mode */}
                        <div>
                          <label className="block text-xs text-slate-400 mb-1">Second Hand Motion</label>
                          <div className="grid grid-cols-2 gap-2">
                            {['smooth', 'tick'].map(sw => (
                              <button
                                key={sw}
                                onClick={() => updateConfig('sweepMode', sw)}
                                className={`py-1.5 rounded-lg border text-xs capitalize font-medium cursor-pointer ${
                                  (editedConfig.sweepMode || 'smooth') === sw 
                                    ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300' 
                                    : 'bg-slate-950 border-slate-800 text-slate-400'
                                }`}
                              >
                                {sw === 'smooth' ? 'Continuous Sweep' : '1s Mechanical Tick'}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Dial Colors */}
                        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800">
                          <div>
                            <span className="block text-[10px] text-slate-400 mb-1">Border</span>
                            <input
                              type="color"
                              value={editedConfig.dialBorderColor || '#38bdf8'}
                              onChange={(e) => updateConfig('dialBorderColor', e.target.value)}
                              className="w-full h-8 rounded cursor-pointer bg-transparent"
                            />
                          </div>
                          <div>
                            <span className="block text-[10px] text-slate-400 mb-1">Hour Hand</span>
                            <input
                              type="color"
                              value={editedConfig.hourColor || '#ffffff'}
                              onChange={(e) => updateConfig('hourColor', e.target.value)}
                              className="w-full h-8 rounded cursor-pointer bg-transparent"
                            />
                          </div>
                          <div>
                            <span className="block text-[10px] text-slate-400 mb-1">Second Hand</span>
                            <input
                              type="color"
                              value={editedConfig.secondColor || '#f97316'}
                              onChange={(e) => updateConfig('secondColor', e.target.value)}
                              className="w-full h-8 rounded cursor-pointer bg-transparent"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Specifics for Flip Clock */}
                    {selectedFace?.style === 'flip' && (
                      <div className="space-y-4">
                        <h4 className="text-xs font-semibold text-white uppercase tracking-wider mb-2">
                          Split-Flap Plate Tuning
                        </h4>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <span className="block text-[11px] text-slate-400 mb-1">Card Background</span>
                            <input
                              type="color"
                              value={editedConfig.cardBg || '#18181b'}
                              onChange={(e) => updateConfig('cardBg', e.target.value)}
                              className="w-full h-8 rounded cursor-pointer bg-transparent"
                            />
                          </div>
                          <div>
                            <span className="block text-[11px] text-slate-400 mb-1">Card Text</span>
                            <input
                              type="color"
                              value={editedConfig.cardTextColor || '#fafafa'}
                              onChange={(e) => updateConfig('cardTextColor', e.target.value)}
                              className="w-full h-8 rounded cursor-pointer bg-transparent"
                            />
                          </div>
                        </div>

                        <div>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-slate-400">Card Corner Radius</span>
                            <span className="text-cyan-400">{editedConfig.cardRadius || 12}px</span>
                          </div>
                          <input
                            type="range"
                            min="2"
                            max="28"
                            value={editedConfig.cardRadius || 12}
                            onChange={(e) => updateConfig('cardRadius', Number(e.target.value))}
                            className="w-full accent-cyan-400 cursor-pointer"
                          />
                        </div>
                      </div>
                    )}

                    {/* Specifics for Futuristic Neon */}
                    {selectedFace?.style === 'futuristic-neon' && (
                      <div className="space-y-4">
                        <h4 className="text-xs font-semibold text-white uppercase tracking-wider mb-2">
                          Cyberpunk Visual Effects
                        </h4>

                        <label className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer">
                          <span>Cathode Scanline Overlay</span>
                          <input
                            type="checkbox"
                            checked={Boolean(editedConfig.scanlines)}
                            onChange={(e) => updateConfig('scanlines', e.target.checked)}
                            className="w-4 h-4 accent-cyan-400 rounded"
                          />
                        </label>

                        <div>
                          <label className="block text-xs text-slate-400 mb-1">Secondary Accent Glow</label>
                          <div className="flex items-center space-x-2">
                            <input
                              type="color"
                              value={editedConfig.accentColor || '#ff0055'}
                              onChange={(e) => updateConfig('accentColor', e.target.value)}
                              className="w-8 h-8 rounded cursor-pointer bg-transparent"
                            />
                            <span className="font-mono text-xs">{editedConfig.accentColor || '#ff0055'}</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Specifics for Dashboard */}
                    {selectedFace?.style === 'date-time-dashboard' && (
                      <div className="space-y-4">
                        <h4 className="text-xs font-semibold text-white uppercase tracking-wider mb-2">
                          Dashboard Card Tuning
                        </h4>

                        <div>
                          <label className="block text-xs text-slate-400 mb-1">Accent Badge Color</label>
                          <div className="flex items-center space-x-2">
                            <input
                              type="color"
                              value={editedConfig.accentColor || '#06b6d4'}
                              onChange={(e) => updateConfig('accentColor', e.target.value)}
                              className="w-8 h-8 rounded cursor-pointer bg-transparent"
                            />
                            <span className="font-mono text-xs">{editedConfig.accentColor || '#06b6d4'}</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Modern Digital Pill */}
                    {selectedFace?.style === 'modern-digital' && (
                      <div className="space-y-4">
                        <label className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer">
                          <span>Glassmorphic Dock Pill Container</span>
                          <input
                            type="checkbox"
                            checked={Boolean(editedConfig.pillBadge)}
                            onChange={(e) => updateConfig('pillBadge', e.target.checked)}
                            className="w-4 h-4 accent-cyan-400 rounded"
                          />
                        </label>
                      </div>
                    )}
                  </div>
                )}

                {/* ---------------- TAB 6: BACKGROUND & AMBIENCE ---------------- */}
                {activeControlTab === 'background' && (
                  <div className="space-y-5">
                    {/* Background Mode */}
                    <div>
                      <label className="block text-xs font-semibold text-white mb-1.5">
                        Background Mode
                      </label>
                      <div className="grid grid-cols-3 gap-1.5">
                        {['wallpaper', 'gradient', 'color'].map(mode => (
                          <button
                            key={mode}
                            onClick={() => updateConfig('backgroundMode', mode)}
                            className={`py-1.5 rounded-lg border text-xs capitalize font-medium cursor-pointer ${
                              (editedConfig.backgroundMode || 'wallpaper') === mode 
                                ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300' 
                                : 'bg-slate-950 border-slate-800 text-slate-400'
                            }`}
                          >
                            {mode}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Wallpaper Presets */}
                    {editedConfig.backgroundMode === 'wallpaper' && (
                      <div className="space-y-3">
                        <label className="block text-xs font-semibold text-white mb-1">
                          Curated 4K Wallpaper Themes
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          {[
                            { id: 'fuji', name: 'Mount Fuji Sunset', url: '/wallpapers/fuji.jpg' },
                            { id: 'aurora', name: 'Northern Aurora', url: '/wallpapers/aurora.jpg' },
                            { id: 'dusk-peaks', name: 'Dusk Peaks', url: '/wallpapers/dusk-peaks.jpg' },
                            { id: 'moon-lake', name: 'Moon Lake', url: '/wallpapers/moon-lake.jpg' },
                            { id: 'nature-calm', name: 'Nature Calm', url: '/wallpapers/nature-calm.jpg' },
                            { id: 'golden-coast', name: 'Golden Coast', url: '/wallpapers/golden-coast.jpg' },
                            { id: 'glass', name: 'Dark Glass', url: '/wallpapers/glass.jpg' },
                          ].map(wp => (
                            <button
                              key={wp.id}
                              onClick={() => updateConfig('wallpaperUrl', wp.url)}
                              className={`p-2 rounded-xl border text-left flex items-center space-x-2 transition-all cursor-pointer ${
                                editedConfig.wallpaperUrl === wp.url 
                                  ? 'bg-cyan-500/20 border-cyan-500/50 text-white' 
                                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                              }`}
                            >
                              <img src={wp.url} alt="" className="w-8 h-8 rounded-lg object-cover" />
                              <span className="text-[11px] truncate">{wp.name}</span>
                            </button>
                          ))}
                        </div>

                        {/* Upload Custom Wallpaper */}
                        <div className="pt-2">
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleBgUpload}
                            className="hidden"
                          />
                          <button
                            onClick={() => fileInputRef.current?.click()}
                            disabled={uploadingBg}
                            className="w-full py-2.5 rounded-xl border border-dashed border-cyan-500/40 hover:border-cyan-400 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 font-medium text-xs flex items-center justify-center space-x-2 transition-all cursor-pointer"
                          >
                            {uploadingBg ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                            <span>Upload Custom Artwork from PC</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Gradient Presets */}
                    {editedConfig.backgroundMode === 'gradient' && (
                      <div className="space-y-3">
                        <label className="block text-xs font-semibold text-white mb-1">
                          Ambient Gradient Presets
                        </label>
                        <div className="grid grid-cols-1 gap-2">
                          {[
                            { name: 'Obsidian Night', grad: 'linear-gradient(135deg, #090d16 0%, #020408 100%)' },
                            { name: 'Tokyo Twilight', grad: 'linear-gradient(135deg, #1e1b4b 0%, #0f172a 100%)' },
                            { name: 'Cyber Deep Void', grad: 'radial-gradient(circle at center, #071324 0%, #02040a 100%)' },
                            { name: 'Minimal Charcoal', grad: 'linear-gradient(180deg, #18181b 0%, #09090b 100%)' },
                          ].map(g => (
                            <button
                              key={g.name}
                              onClick={() => updateConfig('backgroundGradient', g.grad)}
                              className={`p-2.5 rounded-xl border text-left flex items-center space-x-3 cursor-pointer ${
                                editedConfig.backgroundGradient === g.grad 
                                  ? 'border-cyan-500 text-white' 
                                  : 'border-slate-800 text-slate-300 hover:border-slate-700'
                              }`}
                              style={{ background: g.grad }}
                            >
                              <span className="text-xs font-medium">{g.name}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Overlay Tint & Backdrop Blur */}
                    <div className="space-y-4 pt-3 border-t border-slate-800">
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="font-semibold text-white">Darkness Tint Opacity</span>
                          <span className="text-cyan-400">{Math.round((editedConfig.overlayOpacity ?? 0.4) * 100)}%</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.05"
                          value={editedConfig.overlayOpacity ?? 0.4}
                          onChange={(e) => updateConfig('overlayOpacity', Number(e.target.value))}
                          className="w-full accent-cyan-400 cursor-pointer"
                        />
                      </div>

                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="font-semibold text-white">Backdrop Blur</span>
                          <span className="text-cyan-400">{editedConfig.backdropBlur || 0}px</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="30"
                          value={editedConfig.backdropBlur || 0}
                          onChange={(e) => updateConfig('backdropBlur', Number(e.target.value))}
                          className="w-full accent-cyan-400 cursor-pointer"
                        />
                      </div>

                      <label className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer">
                        <span>Cinematic Vignette Shadow</span>
                        <input
                          type="checkbox"
                          checked={Boolean(editedConfig.vignette)}
                          onChange={(e) => updateConfig('vignette', e.target.checked)}
                          className="w-4 h-4 accent-cyan-400 rounded"
                        />
                      </label>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </aside>

      </div>
    </div>
  );
}
