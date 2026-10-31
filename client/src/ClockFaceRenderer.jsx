import React, { useState, useEffect, useRef } from 'react';

/**
 * ClockFaceRenderer
 * Pixel-perfect renderer for all 7 Smart TV clock face designs.
 * Used identically in the Studio Preview and can match the TV Browser render.
 */
export default function ClockFaceRenderer({
  face,
  is24HourOverride = null,
  scaleFactor = 1,
  className = '',
  style = {},
  isStatic = false,
}) {
  const [time, setTime] = useState(new Date());
  const animRef = useRef(null);

  useEffect(() => {
    if (isStatic) return;

    const isSmoothAnalog = face?.style === 'analog' && face?.config?.sweepMode === 'smooth';

    if (isSmoothAnalog) {
      let frameId;
      const update = () => {
        setTime(new Date());
        frameId = requestAnimationFrame(update);
      };
      frameId = requestAnimationFrame(update);
      return () => cancelAnimationFrame(frameId);
    } else {
      const timer = setInterval(() => {
        setTime(new Date());
      }, 500);
      return () => clearInterval(timer);
    }
  }, [face?.style, face?.config?.sweepMode, isStatic]);

  if (!face || !face.config) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-950 text-slate-500 text-sm">
        No clock configuration selected
      </div>
    );
  }

  const cfg = face.config;
  const clockStyle = face.style || 'minimal-digital';

  const is24Hour = is24HourOverride !== null ? is24HourOverride : Boolean(cfg.is24Hour);
  const hoursRaw = time.getHours();
  const isAm = hoursRaw < 12;
  const hours = is24Hour ? hoursRaw : (hoursRaw % 12 || 12);
  const minutes = time.getMinutes();
  const seconds = time.getSeconds();
  const ms = time.getMilliseconds();

  const hStr = String(hours).padStart(is24Hour ? 2 : 1, '0');
  const mStr = String(minutes).padStart(2, '0');
  const sStr = String(seconds).padStart(2, '0');

  // Format custom date
  const formatDate = () => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const daysShort = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const monthsShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    const dayName = days[time.getDay()];
    const dayShort = daysShort[time.getDay()];
    const monthName = months[time.getMonth()];
    const monthShort = monthsShort[time.getMonth()];
    const dateNum = time.getDate();
    const year = time.getFullYear();

    const fmt = cfg.dateFormat || 'EEEE, d MMMM';
    if (fmt === 'EEEE, d MMMM') return `${dayName}, ${dateNum} ${monthName}${cfg.showYear ? ' ' + year : ''}`;
    if (fmt === 'EEE, d MMM') return `${dayShort}, ${dateNum} ${monthShort}${cfg.showYear ? ' ' + year : ''}`;
    if (fmt === 'Tuesday 27 October') return `${dayName} ${dateNum} ${monthName}${cfg.showYear ? ' ' + year : ''}`;
    if (fmt === 'EEEE, MMMM d, yyyy') return `${dayName}, ${monthName} ${dateNum}, ${year}`;
    if (fmt === 'MMMM d, yyyy') return `${monthName} ${dateNum}, ${year}`;
    if (fmt === 'YYYY.MM.DD // PROTOCOL-7') {
      const m = String(time.getMonth() + 1).padStart(2, '0');
      const d = String(dateNum).padStart(2, '0');
      return `${year}.${m}.${d} // PROTOCOL-7`;
    }
    return `${dayName}, ${dateNum} ${monthName} ${year}`;
  };

  // Background style
  let backgroundStyle = {};
  if (cfg.backgroundMode === 'wallpaper' && cfg.wallpaperUrl) {
    backgroundStyle = {
      backgroundImage: `url(${cfg.wallpaperUrl})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
    };
  } else if (cfg.backgroundMode === 'gradient' && cfg.backgroundGradient) {
    backgroundStyle = {
      background: cfg.backgroundGradient,
    };
  } else {
    backgroundStyle = {
      backgroundColor: cfg.backgroundColor || '#020617',
    };
  }

  // Alignment classes
  const alignH = cfg.alignmentH || 'center';
  const alignV = cfg.alignmentV || 'center';
  const hClass = alignH === 'left' ? 'items-start text-left' : alignH === 'right' ? 'items-end text-right' : 'items-center text-center';
  const vClass = alignV === 'top' ? 'justify-start pt-12' : alignV === 'bottom' ? 'justify-end pb-12' : 'justify-center';

  // Typography & Color Styles
  const textStyle = {
    fontFamily: cfg.fontFamily || 'Inter',
    fontWeight: cfg.fontWeight || '400',
    letterSpacing: `${cfg.letterSpacing || 0}em`,
    color: cfg.textColor || '#ffffff',
  };

  if (cfg.useGradient && cfg.gradientColors && cfg.gradientColors.length >= 2) {
    textStyle.backgroundImage = `linear-gradient(${cfg.gradientAngle || 90}deg, ${cfg.gradientColors[0]}, ${cfg.gradientColors[1]})`;
    textStyle.WebkitBackgroundClip = 'text';
    textStyle.WebkitTextFillColor = 'transparent';
  }

  const shadows = [];
  if (cfg.glow) {
    const glowColor = cfg.glowColor || '#38bdf8';
    const glowBlur = cfg.glowBlur || 18;
    shadows.push(`0 0 ${glowBlur}px ${glowColor}`, `0 0 ${glowBlur * 1.8}px ${glowColor}`);
  }
  if (cfg.textShadow) {
    shadows.push('0 4px 20px rgba(0, 0, 0, 0.7)');
  }
  if (shadows.length > 0 && !cfg.useGradient) {
    textStyle.textShadow = shadows.join(', ');
  }

  // Offset Transform
  const xOffset = cfg.xOffset || 0;
  const yOffset = cfg.yOffset || 0;
  const transformStyle = {
    transform: `translate(${xOffset}px, ${yOffset}px) scale(${scaleFactor})`,
    transformOrigin: alignH === 'left' ? 'left center' : alignH === 'right' ? 'right center' : 'center center',
  };

  return (
    <div 
      className={`relative w-full h-full overflow-hidden select-none ${className}`} 
      style={{ ...backgroundStyle, ...style }}
    >
      {/* Overlay Tint & Blur */}
      <div 
        className="absolute inset-0 pointer-events-none transition-all duration-300" 
        style={{
          backgroundColor: `rgba(0, 0, 0, ${typeof cfg.overlayOpacity === 'number' ? cfg.overlayOpacity : 0.4})`,
          backdropFilter: cfg.backdropBlur ? `blur(${cfg.backdropBlur}px)` : 'none',
          WebkitBackdropFilter: cfg.backdropBlur ? `blur(${cfg.backdropBlur}px)` : 'none',
        }}
      />

      {/* Vignette */}
      {cfg.vignette && (
        <div 
          className="absolute inset-0 pointer-events-none" 
          style={{
            background: 'radial-gradient(circle at center, transparent 40%, rgba(0, 0, 0, 0.8) 100%)',
          }}
        />
      )}

      {/* Futuristic Scanlines */}
      {cfg.scanlines && (
        <div 
          className="absolute inset-0 pointer-events-none opacity-40" 
          style={{
            background: 'linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.5) 50%), linear-gradient(90deg, rgba(255,0,0,0.03), rgba(0,255,0,0.01), rgba(0,0,255,0.03))',
            backgroundSize: '100% 4px, 6px 100%',
          }}
        />
      )}

      {/* Content Stage */}
      <div className={`relative z-10 w-full h-full flex flex-col p-8 sm:p-12 md:p-16 ${vClass} ${hClass}`}>
        <div 
          className={`flex flex-col ${hClass} transition-transform duration-300`} 
          style={transformStyle}
        >

          {/* 1. ANALOG CLOCK */}
          {clockStyle === 'analog' && (
            <div className="flex flex-col items-center">
              {renderAnalogDial(cfg, time, seconds, ms)}
              {cfg.showDate && renderDateText(cfg, formatDate())}
            </div>
          )}

          {/* 2. FLIP CLOCK */}
          {clockStyle === 'flip' && (
            <div className="flex flex-col items-center">
              <div className="flex items-center gap-3 sm:gap-4 md:gap-5">
                {/* Hours Group */}
                <div className="flex gap-1.5 sm:gap-2">
                  <FlipCard digit={hStr[0]} cfg={cfg} />
                  <FlipCard digit={hStr[1]} cfg={cfg} />
                </div>

                {/* Divider */}
                <span className="text-3xl sm:text-4xl md:text-5xl font-bold opacity-60 text-white pb-2">:</span>

                {/* Minutes Group */}
                <div className="flex gap-1.5 sm:gap-2">
                  <FlipCard digit={mStr[0]} cfg={cfg} />
                  <FlipCard digit={mStr[1]} cfg={cfg} />
                </div>

                {/* Seconds Group */}
                {cfg.showSeconds && (
                  <>
                    <span className="text-xl sm:text-2xl md:text-3xl font-bold opacity-50 text-white pb-2">:</span>
                    <div className="flex gap-1">
                      <FlipCard digit={sStr[0]} cfg={cfg} isSecond />
                      <FlipCard digit={sStr[1]} cfg={cfg} isSecond />
                    </div>
                  </>
                )}

                {/* AM/PM */}
                {cfg.showAmPm && !is24Hour && (
                  <div 
                    className="flex items-center justify-center font-bold px-2.5 py-1.5 rounded-lg text-xs sm:text-sm tracking-wider uppercase border border-white/10"
                    style={{
                      background: cfg.cardBg || '#18181b',
                      color: cfg.cardTextColor || '#fafafa',
                    }}
                  >
                    {isAm ? 'AM' : 'PM'}
                  </div>
                )}
              </div>

              {cfg.showDate && renderDateText(cfg, formatDate(), 'mt-5 sm:mt-6')}
            </div>
          )}

          {/* 3. DATE & TIME DASHBOARD */}
          {clockStyle === 'date-time-dashboard' && (
            <div className="flex flex-col gap-4 max-w-full">
              <div 
                className="rounded-3xl p-6 sm:p-8 md:p-10 border border-white/10 shadow-2xl backdrop-blur-2xl"
                style={{
                  background: 'rgba(15, 23, 42, 0.72)',
                  borderColor: 'rgba(255, 255, 255, 0.12)',
                }}
              >
                <div className="flex items-baseline line-none leading-none select-none">
                  <span 
                    className="text-6xl sm:text-7xl md:text-8xl font-bold tracking-tight tabular-nums"
                    style={textStyle}
                  >
                    {hStr}:{mStr}
                  </span>

                  {cfg.showSeconds && (
                    <span 
                      className="text-2xl sm:text-3xl md:text-4xl font-medium opacity-70 ml-2 sm:ml-3 tabular-nums"
                      style={{ color: cfg.accentColor || '#06b6d4' }}
                    >
                      {sStr}
                    </span>
                  )}

                  {cfg.showAmPm && !is24Hour && (
                    <span 
                      className="text-sm sm:text-base font-semibold uppercase tracking-widest opacity-80 ml-3"
                      style={{ color: cfg.textColor || '#ffffff' }}
                    >
                      {isAm ? 'AM' : 'PM'}
                    </span>
                  )}
                </div>

                {/* Dashboard Badges */}
                <div className="flex items-center gap-2 sm:gap-3 mt-4 sm:mt-6 flex-wrap">
                  <div 
                    className="flex items-center gap-2 px-3 sm:px-4 py-1.5 rounded-full text-xs sm:text-sm font-semibold border backdrop-blur-md"
                    style={{
                      background: 'rgba(6, 182, 212, 0.12)',
                      borderColor: 'rgba(6, 182, 212, 0.35)',
                      color: cfg.accentColor || '#06b6d4',
                    }}
                  >
                    <span>📅</span>
                    <span>{formatDate()}</span>
                  </div>

                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-white/5 border border-white/10 text-slate-300">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span>Sony BRAVIA 4K Connected</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 4. DIGITAL STYLES (Minimal Digital, Modern Digital, Futuristic Neon, Minimal Typography) */}
          {clockStyle !== 'analog' && clockStyle !== 'flip' && clockStyle !== 'date-time-dashboard' && (
            <div className={`flex flex-col ${hClass}`}>
              <div 
                className={`${clockStyle === 'modern-digital' && cfg.pillBadge ? 'rounded-3xl p-6 sm:p-8 md:p-10 border shadow-2xl backdrop-blur-xl' : ''}`}
                style={clockStyle === 'modern-digital' && cfg.pillBadge ? {
                  background: cfg.pillBg || 'rgba(15, 23, 42, 0.7)',
                  borderColor: cfg.pillBorder || 'rgba(56, 189, 248, 0.3)',
                  boxShadow: '0 20px 50px rgba(0, 0, 0, 0.55)',
                } : {}}
              >
                {/* Date on Top if requested */}
                {cfg.showDate && cfg.datePosition === 'above' && (
                  renderDateText(cfg, formatDate(), 'mb-2 sm:mb-3')
                )}

                {/* Primary Time Digits */}
                <div className="flex items-baseline line-none leading-none select-none">
                  <span 
                    className="text-6xl sm:text-7xl md:text-8xl lg:text-9xl font-bold tracking-tight tabular-nums transition-all"
                    style={{
                      ...textStyle,
                      fontSize: `${(cfg.fontSize || 100) * 0.075}vw`,
                    }}
                  >
                    {hStr}
                    <span className="opacity-90 mx-1">:</span>
                    {mStr}
                  </span>

                  {cfg.showSeconds && (
                    <span 
                      className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-medium opacity-70 ml-2 sm:ml-4 tabular-nums"
                      style={{
                        ...textStyle,
                        fontSize: `${(cfg.fontSize || 100) * 0.038}vw`,
                        color: clockStyle === 'futuristic-neon' ? (cfg.accentColor || '#ff0055') : (cfg.textColor || '#ffffff'),
                      }}
                    >
                      {sStr}
                    </span>
                  )}

                  {cfg.showAmPm && !is24Hour && (
                    <span 
                      className="text-sm sm:text-base md:text-lg lg:text-xl font-semibold uppercase tracking-widest opacity-80 ml-3"
                      style={{
                        ...textStyle,
                        fontSize: `${(cfg.fontSize || 100) * 0.024}vw`,
                      }}
                    >
                      {isAm ? 'AM' : 'PM'}
                    </span>
                  )}
                </div>

                {/* Date Below */}
                {cfg.showDate && cfg.datePosition !== 'above' && (
                  renderDateText(cfg, formatDate(), 'mt-3 sm:mt-4')
                )}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

// Subcomponent: Flip Clock Single Card
function FlipCard({ digit, cfg, isSecond = false }) {
  const cardRadius = (cfg.cardRadius || 12) * (isSecond ? 0.75 : 1);
  return (
    <div 
      className={`relative flex items-center justify-center font-bold overflow-hidden select-none shadow-2xl border border-white/10 ${
        isSecond 
          ? 'w-7 sm:w-9 md:w-11 h-10 sm:h-12 md:h-14 text-xl sm:text-2xl md:text-3xl' 
          : 'w-12 sm:w-16 md:w-20 h-16 sm:h-22 md:h-28 text-4xl sm:text-6xl md:text-7xl'
      }`}
      style={{
        background: cfg.cardBg || '#18181b',
        color: cfg.cardTextColor || '#fafafa',
        borderRadius: `${cardRadius}px`,
        fontFamily: cfg.fontFamily || 'Bebas Neue',
      }}
    >
      <span className="z-10">{digit}</span>
      {/* 3D split-flap divider horizontal slit */}
      <div 
        className="absolute left-0 right-0 top-1/2 h-0.5 pointer-events-none z-20"
        style={{
          background: cfg.dividerColor || 'rgba(0, 0, 0, 0.85)',
          boxShadow: '0 1px 0 rgba(255, 255, 255, 0.12)',
        }}
      />
    </div>
  );
}

// Subcomponent: Date String
function renderDateText(cfg, dateStr, extraClass = '') {
  return (
    <div 
      className={`font-medium tracking-wide transition-all ${extraClass}`}
      style={{
        fontFamily: cfg.fontFamily || 'Inter',
        fontSize: `${cfg.dateFontSize || 22}px`,
        color: cfg.dateColor || '#94a3b8',
        opacity: cfg.dateOpacity || 0.85,
      }}
    >
      {dateStr}
    </div>
  );
}

// Subcomponent: Analog Clock SVG
function renderAnalogDial(cfg, time, seconds, ms) {
  const dialSize = cfg.dialSize || 380;
  const radius = dialSize / 2;
  const center = radius;

  const hours = time.getHours() % 12;
  const minutes = time.getMinutes();
  const sec = cfg.sweepMode === 'smooth' ? seconds + ms / 1000 : seconds;

  const hourDeg = (hours + minutes / 60 + sec / 3600) * 30;
  const minuteDeg = (minutes + sec / 60) * 6;
  const secondDeg = sec * 6;

  const markerStyle = cfg.markerStyle || 'ticks';
  const markerColor = cfg.markerColor || '#94a3b8';

  const markers = [];
  for (let i = 0; i < 12; i++) {
    const angle = (i * 30) * (Math.PI / 180);
    const isMain = i % 3 === 0;

    if (markerStyle === 'dots') {
      const r = radius - 24;
      const cx = center + r * Math.sin(angle);
      const cy = center - r * Math.cos(angle);
      markers.push(
        <circle key={i} cx={cx} cy={cy} r={isMain ? 4 : 2.5} fill={markerColor} opacity={isMain ? 1 : 0.6} />
      );
    } else if (markerStyle === 'numbers') {
      const r = radius - 36;
      const cx = center + r * Math.sin(angle);
      const cy = center - r * Math.cos(angle);
      const num = i === 0 ? 12 : i;
      markers.push(
        <text 
          key={i} 
          x={cx} 
          y={cy} 
          fontFamily={cfg.fontFamily || 'Outfit'} 
          fontSize={isMain ? 20 : 15} 
          fontWeight={isMain ? '700' : '500'} 
          fill={markerColor} 
          textAnchor="middle" 
          dominantBaseline="central"
        >
          {num}
        </text>
      );
    } else if (markerStyle === 'roman') {
      const r = radius - 36;
      const cx = center + r * Math.sin(angle);
      const cy = center - r * Math.cos(angle);
      const romans = ['XII', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
      markers.push(
        <text 
          key={i} 
          x={cx} 
          y={cy} 
          fontFamily={cfg.fontFamily || 'Cinzel'} 
          fontSize={isMain ? 17 : 13} 
          fontWeight="600" 
          fill={markerColor} 
          textAnchor="middle" 
          dominantBaseline="central"
        >
          {romans[i]}
        </text>
      );
    } else {
      // Default ticks
      const r1 = radius - (isMain ? 24 : 18);
      const r2 = radius - 12;
      const x1 = center + r1 * Math.sin(angle);
      const y1 = center - r1 * Math.cos(angle);
      const x2 = center + r2 * Math.sin(angle);
      const y2 = center - r2 * Math.cos(angle);
      markers.push(
        <line 
          key={i} 
          x1={x1} 
          y1={y1} 
          x2={x2} 
          y2={y2} 
          stroke={markerColor} 
          strokeWidth={isMain ? 3.5 : 2} 
          strokeLinecap="round" 
          opacity={isMain ? 1 : 0.6} 
        />
      );
    }
  }

  const borderWidth = cfg.showBorder ? (cfg.dialBorderWidth || 4) : 0;
  const borderColor = cfg.dialBorderColor || '#38bdf8';

  return (
    <div 
      className="relative drop-shadow-2xl" 
      style={{ width: `${dialSize}px`, height: `${dialSize}px` }}
    >
      <svg 
        className="w-full h-full overflow-visible" 
        viewBox={`0 0 ${dialSize} ${dialSize}`}
      >
        <defs>
          <radialGradient id="previewDialGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#1e293b" />
            <stop offset="100%" stopColor="#090d16" />
          </radialGradient>
        </defs>

        {/* Dial Plate */}
        {cfg.dialShape === 'squircle' ? (
          <rect 
            x="6" 
            y="6" 
            width={dialSize - 12} 
            height={dialSize - 12} 
            rx="56" 
            fill="url(#previewDialGrad)" 
            stroke={borderColor} 
            strokeWidth={borderWidth} 
          />
        ) : (
          <circle 
            cx={center} 
            cy={center} 
            r={radius - 6} 
            fill="url(#previewDialGrad)" 
            stroke={borderColor} 
            strokeWidth={borderWidth} 
          />
        )}

        {/* Markers */}
        {markers}

        {/* Hour Hand */}
        <line 
          x1={center} 
          y1={center} 
          x2={center} 
          y2={center - (cfg.hourLength || 65)} 
          stroke={cfg.hourColor || '#ffffff'} 
          strokeWidth={cfg.hourWidth || 8} 
          strokeLinecap="round" 
          transform={`rotate(${hourDeg} ${center} ${center})`}
        />

        {/* Minute Hand */}
        <line 
          x1={center} 
          y1={center} 
          x2={center} 
          y2={center - (cfg.minuteLength || 85)} 
          stroke={cfg.minuteColor || '#38bdf8'} 
          strokeWidth={cfg.minuteWidth || 5} 
          strokeLinecap="round" 
          transform={`rotate(${minuteDeg} ${center} ${center})`}
        />

        {/* Second Hand */}
        {cfg.showSeconds !== false && (
          <>
            <line 
              x1={center} 
              y1={center + 20} 
              x2={center} 
              y2={center - (cfg.secondLength || 95)} 
              stroke={cfg.secondColor || '#f97316'} 
              strokeWidth={cfg.secondWidth || 2} 
              strokeLinecap="round" 
              transform={`rotate(${secondDeg} ${center} ${center})`}
            />
            <circle 
              cx={center} 
              cy={center} 
              r={(cfg.pinSize || 10) / 2} 
              fill={cfg.pinColor || '#f97316'} 
            />
          </>
        )}

        {cfg.showSeconds === false && (
          <circle 
            cx={center} 
            cy={center} 
            r="6" 
            fill={cfg.hourColor || '#ffffff'} 
          />
        )}
      </svg>
    </div>
  );
}
