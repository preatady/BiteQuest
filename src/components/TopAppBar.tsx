import React from 'react';

interface TopAppBarProps {
  districtName?: string;
  xp?: number;
  onOpenMenu?: () => void;
  onOpenNotifications?: () => void;
  onOpenBiteBot?: () => void;
}

export const TopAppBar: React.FC<TopAppBarProps> = ({
  districtName = 'Cầu Giấy',
  xp,
  onOpenMenu,
  onOpenNotifications,
  onOpenBiteBot,
}) => {
  const displayXp = typeof xp === 'number' ? xp : 0;

  return (
    <header className="fixed top-0 left-0 w-full pt-[env(safe-area-inset-top,0px)] h-[calc(4rem+env(safe-area-inset-top,0px))] z-40 bg-[#FDFCF8]/92 backdrop-blur-md px-4 flex justify-between items-center border-b border-[#2D2926]/5" id="main-top-app-bar">
      <div className="flex items-center gap-2 min-w-0">
        <button
          onClick={onOpenMenu}
          className="w-10 h-10 shrink-0 flex items-center justify-center rounded-full hover:bg-[#EFEEEA] text-[#2D2926] active:scale-95 transition-all cursor-pointer"
          title="Menu"
          id="btn-top-menu"
        >
          <span className="material-symbols-outlined text-[24px]">menu</span>
        </button>

        <div className="flex items-center gap-2 min-w-0">
          <h1 className="font-heading text-2xl font-black text-[#FF6B35] tracking-tight shrink-0">
            BiteQuest
          </h1>
          <span className="hidden sm:inline-flex items-center gap-1 bg-[#2EC4B6]/15 text-[#006a62] px-2.5 py-0.5 rounded-full text-xs font-semibold truncate max-w-[140px]">
            <span>📍</span> {districtName}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {/* BiteBot AI Assistant Button */}
        {onOpenBiteBot && (
          <button
            type="button"
            onClick={onOpenBiteBot}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-[#FF6B35]/15 to-[#2EC4B6]/15 hover:from-[#FF6B35]/25 hover:to-[#2EC4B6]/25 border border-[#FF6B35]/20 text-[#2D2926] active:scale-95 transition-all cursor-pointer shadow-xs"
            title="Hỏi Trợ lý Ẩm thực AI BiteBot"
            id="btn-top-bitebot"
          >
            <span className="text-sm">✨</span>
            <span className="font-heading text-xs font-bold text-[#FF6B35] hidden xs:inline">BiteBot</span>
          </button>
        )}

        <div className="flex items-center gap-1 bg-[#FF6B35]/10 text-[#FF6B35] px-3 py-1 rounded-full text-xs font-bold font-heading whitespace-nowrap">
          <span>⚡</span>
          <span>{displayXp.toLocaleString('vi-VN')} XP</span>
        </div>

        <button
          onClick={onOpenNotifications}
          className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-[#EFEEEA] text-[#2D2926] active:scale-95 transition-all relative shrink-0 cursor-pointer"
          title="Thông báo"
          id="btn-top-notifications"
        >
          <span className="material-symbols-outlined text-[24px]">notifications</span>
          <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[#FF6B35] ring-2 ring-white"></span>
        </button>
      </div>
    </header>
  );
};
