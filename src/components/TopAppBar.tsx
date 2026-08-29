import React from 'react';

interface TopAppBarProps {
  districtName?: string;
  xp?: number;
  unreadCount?: number;
  onOpenMenu?: () => void;
  onOpenNotifications?: () => void;
  onOpenBiteBot?: () => void;
}

export const TopAppBar: React.FC<TopAppBarProps> = ({
  districtName = 'Cầu Giấy',
  xp,
  unreadCount = 0,
  onOpenMenu,
  onOpenNotifications,
  onOpenBiteBot,
}) => {
  const displayXp = typeof xp === 'number' ? xp : 0;

  return (
    <header
      className="fixed top-0 left-0 w-full pt-[env(safe-area-inset-top,0px)] h-[calc(3.75rem+env(safe-area-inset-top,0px))] z-40 bg-[#FDFCF8]/94 backdrop-blur-md px-3 sm:px-4 flex justify-between items-center border-b border-[#2D2926]/6 transition-all"
      id="main-top-app-bar"
    >
      {/* LEFT: Menu Trigger + Brand + AI Riser Micro-Branding */}
      <div className="flex items-center gap-2 min-w-0">
        <button
          onClick={onOpenMenu}
          className="w-9 h-9 sm:w-10 sm:h-10 shrink-0 flex items-center justify-center rounded-full hover:bg-[#2D2926]/6 text-[#2D2926] active:scale-95 transition-all cursor-pointer"
          title="Menu mở rộng"
          id="btn-top-menu"
          aria-label="Mở menu"
        >
          <span className="material-symbols-outlined text-[22px] sm:text-[24px]">menu</span>
        </button>

        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
          <div className="flex items-center gap-1.5 shrink-0">
            <h1 className="font-heading text-xl sm:text-2xl font-black text-[#FF6B35] tracking-tight leading-none">
              BiteQuest
            </h1>
            {/* Subtle AI Riser Micro-Branding Accent */}
            <span
              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-[#2EC4B6]/12 text-[#006A62] border border-[#2EC4B6]/25 text-[8px] sm:text-[8.5px] font-heading font-black tracking-wider uppercase select-none"
              title="Dự án đồng hành phát triển cùng AI Riser"
            >
              <span className="text-[7px]">⚡</span>
              <span className="hidden xs:inline">AI RISER</span>
            </span>
          </div>

          {/* Location / District Badge */}
          <div className="hidden md:flex items-center gap-1 bg-[#2D2926]/5 text-[#594139] px-2.5 py-1 rounded-full text-xs font-semibold truncate max-w-[130px] border border-[#2D2926]/5">
            <span className="text-[#FF6B35] text-[12px]">📍</span>
            <span className="truncate">{districtName}</span>
          </div>
        </div>
      </div>

      {/* RIGHT: BiteBot Assistant + XP Capsule + Notifications */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        {/* BiteBot AI Assistant Quick Pill */}
        {onOpenBiteBot && (
          <button
            type="button"
            onClick={onOpenBiteBot}
            className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full bg-gradient-to-r from-[#FF6B35]/12 to-[#2EC4B6]/12 hover:from-[#FF6B35]/20 hover:to-[#2EC4B6]/20 border border-[#FF6B35]/20 text-[#2D2926] active:scale-95 transition-all cursor-pointer shadow-2xs"
            title="Hỏi Trợ lý Ẩm thực AI BiteBot"
            id="btn-top-bitebot"
          >
            <span className="text-xs sm:text-sm animate-pulse">✨</span>
            <span className="font-heading text-[11px] sm:text-xs font-bold text-[#FF6B35] hidden xs:inline">
              BiteBot
            </span>
          </button>
        )}

        {/* Compact Gamified XP Badge */}
        <div
          className="flex items-center gap-1 bg-[#FF6B35]/10 border border-[#FF6B35]/15 text-[#FF6B35] px-2.5 sm:px-3 py-1 rounded-full text-xs font-bold font-heading whitespace-nowrap shadow-2xs"
          title={`Điểm kinh nghiệm: ${displayXp.toLocaleString('vi-VN')} XP`}
        >
          <span className="text-[11px]">⚡</span>
          <span>{displayXp.toLocaleString('vi-VN')}</span>
          <span className="text-[9px] opacity-80 uppercase tracking-tighter">XP</span>
        </div>

        {/* Notifications Icon with Unread Indicator */}
        <button
          onClick={onOpenNotifications}
          className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-full hover:bg-[#2D2926]/6 text-[#2D2926] active:scale-95 transition-all relative shrink-0 cursor-pointer"
          title="Thông báo"
          id="btn-top-notifications"
          aria-label="Xem thông báo"
        >
          <span className="material-symbols-outlined text-[22px] sm:text-[24px]">notifications</span>
          {unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-[#FF6B35] text-white text-[9px] font-heading font-black flex items-center justify-center ring-2 ring-[#FDFCF8]">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      </div>
    </header>
  );
};

