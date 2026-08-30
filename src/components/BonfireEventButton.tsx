import React from 'react';

interface BonfireEventButtonProps {
  onClick: () => void;
}

export const BonfireEventButton: React.FC<BonfireEventButtonProps> = ({ onClick }) => {
  return (
    <div className="relative group cursor-pointer select-none" id="bonfire-event-container">
      {/* Tooltip on hover */}
      <div className="absolute right-full mr-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-300 transform translate-x-2 group-hover:translate-x-0 whitespace-nowrap z-30">
        <div className="bg-[#1C1917]/95 backdrop-blur-md text-white text-xs font-heading font-bold px-3 py-1.5 rounded-xl shadow-xl border border-orange-500/40 flex items-center gap-1.5">
          <span className="text-sm">🔥</span>
          <span>Hot: Lễ 2/9</span>
          <span className="text-[10px] bg-red-600 px-1.5 py-0.5 rounded text-white font-mono">Bán kính 50km</span>
        </div>
      </div>

      {/* Pure Blazing Fire Flame Button (Chỉ ngọn lửa rực cháy) */}
      <button
        type="button"
        onClick={onClick}
        className="relative flex flex-col items-center justify-center p-1 rounded-2xl transition-all duration-300 active:scale-95 group focus:outline-none cursor-pointer"
        aria-label="Sự kiện Hot: Lễ 2/9 - Xem điểm đến"
        id="btn-holiday-bonfire-fab"
      >
        {/* Ambient Radial Flame Glow / Hào quang lửa đỏ cam */}
        <div className="absolute inset-0 bg-radial from-orange-500/50 via-red-500/25 to-transparent blur-md rounded-full animate-pulse pointer-events-none scale-125" />

        {/* Pure Flame Visual */}
        <div className="relative w-12 h-14 sm:w-14 sm:h-16 flex items-center justify-center">
          {/* Floating Embers / Đốm lửa & tàn lửa nhảy nhót */}
          <div className="absolute inset-0 pointer-events-none overflow-visible">
            <span className="absolute left-2 bottom-6 w-1.5 h-1.5 rounded-full bg-yellow-300 blur-[0.5px] animate-ping opacity-80" />
            <span className="absolute right-2 bottom-8 w-1 h-1 rounded-full bg-amber-300 animate-bounce opacity-90 delay-150" />
            <span className="absolute left-5 bottom-10 w-1.5 h-1.5 rounded-full bg-orange-400 opacity-75 animate-pulse" />
          </div>

          {/* SVG Illustrated Multi-layer Pure Fire Flame */}
          <svg
            viewBox="0 0 100 110"
            className="w-full h-full drop-shadow-[0_6px_18px_rgba(239,68,68,0.65)] transition-transform duration-300 group-hover:scale-115"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              {/* Outer Flame Gradient */}
              <linearGradient id="outerFlameGrad" x1="50" y1="5" x2="50" y2="105" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#FF1E00" />
                <stop offset="35%" stopColor="#FF3D00" />
                <stop offset="70%" stopColor="#FF6D00" />
                <stop offset="100%" stopColor="#D50000" />
              </linearGradient>

              {/* Mid Flame Gradient */}
              <linearGradient id="midFlameGrad" x1="50" y1="20" x2="50" y2="100" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#FF9100" />
                <stop offset="45%" stopColor="#FFAB00" />
                <stop offset="85%" stopColor="#FFD600" />
                <stop offset="100%" stopColor="#FF6D00" />
              </linearGradient>

              {/* Core Hot Hearth Flame Gradient */}
              <linearGradient id="innerCoreGrad" x1="50" y1="45" x2="50" y2="98" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#FFFFFF" />
                <stop offset="30%" stopColor="#FFF9C4" />
                <stop offset="70%" stopColor="#FFEE58" />
                <stop offset="100%" stopColor="#FF9100" />
              </linearGradient>
            </defs>

            {/* 🔥 LAYER 1: Outer Blazing Fire Silhouette */}
            <path
              d="M50 5C36 30 14 42 16 72C18 92 32 105 50 105C68 105 82 92 84 72C86 42 64 30 50 5Z"
              fill="url(#outerFlameGrad)"
              className="animate-pulse origin-bottom"
              style={{ animationDuration: '1.2s' }}
            />

            {/* Flickering Left & Right Licks */}
            <path
              d="M26 42C16 54 12 70 20 84C24 91 32 94 38 94C30 84 28 66 36 52C39 47 32 39 26 42Z"
              fill="#FF1744"
              className="opacity-95 animate-bounce origin-bottom"
              style={{ animationDuration: '1.8s' }}
            />
            <path
              d="M74 42C84 54 88 70 80 84C76 91 68 94 62 94C70 84 72 66 64 52C61 47 68 39 74 42Z"
              fill="#FF1744"
              className="opacity-95 animate-bounce origin-bottom"
              style={{ animationDuration: '1.6s' }}
            />

            {/* 🔥 LAYER 2: Middle Vibrant Yellow-Orange Flame */}
            <path
              d="M50 22C40 40 26 52 28 75C30 89 39 98 50 98C61 98 70 89 72 75C74 52 60 40 50 22Z"
              fill="url(#midFlameGrad)"
              className="origin-bottom animate-pulse"
              style={{ animationDuration: '0.9s' }}
            />

            {/* Inner Left Tongue */}
            <path
              d="M38 52C32 62 30 74 36 84C42 84 46 76 44 68C42 60 46 56 46 56C42 54 38 52 38 52Z"
              fill="#FFD600"
              className="opacity-90 animate-bounce origin-bottom"
              style={{ animationDuration: '1.4s' }}
            />

            {/* 🔥 LAYER 3: Core White-Hot Flame Center */}
            <path
              d="M50 42C43 54 36 64 38 80C40 89 44 94 50 94C56 94 60 89 62 80C64 64 57 54 50 42Z"
              fill="url(#innerCoreGrad)"
              className="animate-pulse origin-bottom"
              style={{ animationDuration: '0.65s' }}
            />

            {/* White-Hot Core Spark */}
            <ellipse cx="50" cy="82" rx="5" ry="8" fill="#FFFFFF" opacity="0.9" className="animate-pulse" />
          </svg>
        </div>

        {/* Compact Badge anchored directly under the Flame */}
        <div className="-mt-1 px-2 py-0.5 rounded-full bg-gradient-to-r from-red-600 to-[#FF6B35] text-white text-[10px] font-heading font-extrabold shadow-md border border-white/40 tracking-tight flex items-center gap-1 group-hover:scale-105 transition-transform whitespace-nowrap">
          <span className="w-1.5 h-1.5 rounded-full bg-yellow-300 animate-ping inline-block" />
          Hot: Lễ 2/9
        </div>
      </button>
    </div>
  );
};

