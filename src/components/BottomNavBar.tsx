import React from 'react';
import { TabType } from '../types';
export type { TabType };

interface BottomNavBarProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  isNearActiveVenue?: boolean;
}

/**
 * BiteQuest V6 Redesigned Bottom Navigation Bar:
 * Balanced 5-tab mobile dock with center hero camera action trigger
 */
export const BottomNavBar: React.FC<BottomNavBarProps> = ({
  activeTab,
  onTabChange,
  isNearActiveVenue = false,
}) => {
  return (
    <nav
      className="fixed bottom-0 left-0 w-full z-40 bg-[#FDFCF8]/95 backdrop-blur-xl rounded-t-3xl shadow-[0_-6px_28px_rgba(45,41,38,0.09)] border-t border-[#2D2926]/8 pb-[max(0.65rem,env(safe-area-inset-bottom))]"
      id="main-bottom-nav"
      aria-label="Điều hướng chính"
    >
      <div className="max-w-md mx-auto grid grid-cols-5 items-center px-2 pt-1.5 relative">
        {/* 1. Explore (Khám phá) */}
        <button
          type="button"
          onClick={() => onTabChange('explore')}
          className={`min-h-[44px] flex flex-col items-center justify-center py-1 rounded-2xl transition-all duration-150 active:scale-95 cursor-pointer ${
            activeTab === 'explore'
              ? 'text-[#FF6B35] font-bold'
              : 'text-[#594139]/70 hover:text-[#2D2926]'
          }`}
          id="tab-explore"
          aria-selected={activeTab === 'explore'}
        >
          <div
            className={`w-9 h-7 flex items-center justify-center rounded-full transition-all ${
              activeTab === 'explore' ? 'bg-[#FF6B35]/12' : ''
            }`}
          >
            <span
              className={`material-symbols-outlined text-[22px] sm:text-[24px] ${
                activeTab === 'explore' ? 'fill text-[#FF6B35]' : 'text-[#594139]'
              }`}
            >
              map
            </span>
          </div>
          <span className="text-[10px] sm:text-[11px] font-heading mt-0.5 tracking-tight whitespace-nowrap">
            Khám phá
          </span>
        </button>

        {/* 2. Feed (Bản tin bạn bè & cộng đồng) */}
        <button
          type="button"
          onClick={() => onTabChange('friends')}
          className={`min-h-[44px] flex flex-col items-center justify-center py-1 rounded-2xl transition-all duration-150 active:scale-95 cursor-pointer ${
            activeTab === 'friends'
              ? 'text-[#FF6B35] font-bold'
              : 'text-[#594139]/70 hover:text-[#2D2926]'
          }`}
          id="tab-friends"
          aria-selected={activeTab === 'friends'}
        >
          <div
            className={`w-9 h-7 flex items-center justify-center rounded-full transition-all ${
              activeTab === 'friends' ? 'bg-[#FF6B35]/12' : ''
            }`}
          >
            <span
              className={`material-symbols-outlined text-[22px] sm:text-[24px] ${
                activeTab === 'friends' ? 'fill text-[#FF6B35]' : 'text-[#594139]'
              }`}
            >
              dynamic_feed
            </span>
          </div>
          <span className="text-[10px] sm:text-[11px] font-heading mt-0.5 tracking-tight whitespace-nowrap">
            Bản tin
          </span>
        </button>

        {/* 3. Center Camera Action Hero FAB (Chụp Bite - True Horizontal Center) */}
        <div className="flex flex-col items-center justify-center relative -top-3.5 sm:-top-4">
          <button
            type="button"
            onClick={() => onTabChange('camera')}
            className={`w-[56px] h-[56px] sm:w-[60px] sm:h-[60px] rounded-full bg-gradient-to-tr from-[#FF6B35] to-[#FFA07A] text-white flex items-center justify-center ring-4 ring-[#FDFCF8] shadow-[0_6px_20px_rgba(255,107,53,0.35)] active:scale-90 hover:scale-105 transition-all cursor-pointer shrink-0 z-10 ${
              activeTab === 'camera' ? 'ring-[#FF6B35]/30 scale-105 shadow-[0_8px_24px_rgba(255,107,53,0.45)]' : ''
            }`}
            id="tab-camera-fab"
            title="Chụp Bite - Check in quán ăn"
            aria-label="Chụp Bite"
          >
            <span className="material-symbols-outlined text-[28px] sm:text-[30px] fill">photo_camera</span>
            {isNearActiveVenue && (
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-[#2EC4B6] ring-2 ring-white animate-pulse" />
            )}
          </button>
          <span className="text-[10px] sm:text-[11px] font-heading font-extrabold text-[#FF6B35] mt-0.5 tracking-tight whitespace-nowrap">
            Chụp Bite
          </span>
        </div>

        {/* 4. Journey (Hành trình) */}
        <button
          type="button"
          onClick={() => onTabChange('passport')}
          className={`min-h-[44px] flex flex-col items-center justify-center py-1 rounded-2xl transition-all duration-150 active:scale-95 cursor-pointer ${
            activeTab === 'passport'
              ? 'text-[#FF6B35] font-bold'
              : 'text-[#594139]/70 hover:text-[#2D2926]'
          }`}
          id="tab-passport"
          aria-selected={activeTab === 'passport'}
        >
          <div
            className={`w-9 h-7 flex items-center justify-center rounded-full transition-all ${
              activeTab === 'passport' ? 'bg-[#FF6B35]/12' : ''
            }`}
          >
            <span
              className={`material-symbols-outlined text-[22px] sm:text-[24px] ${
                activeTab === 'passport' ? 'fill text-[#FF6B35]' : 'text-[#594139]'
              }`}
            >
              style
            </span>
          </div>
          <span className="text-[10px] sm:text-[11px] font-heading mt-0.5 tracking-tight whitespace-nowrap">
            Hành trình
          </span>
        </button>

        {/* 5. Profile (Hồ sơ) */}
        <button
          type="button"
          onClick={() => onTabChange('profile')}
          className={`min-h-[44px] flex flex-col items-center justify-center py-1 rounded-2xl transition-all duration-150 active:scale-95 cursor-pointer ${
            activeTab === 'profile'
              ? 'text-[#FF6B35] font-bold'
              : 'text-[#594139]/70 hover:text-[#2D2926]'
          }`}
          id="tab-profile"
          aria-selected={activeTab === 'profile'}
        >
          <div
            className={`w-9 h-7 flex items-center justify-center rounded-full transition-all ${
              activeTab === 'profile' ? 'bg-[#FF6B35]/12' : ''
            }`}
          >
            <span
              className={`material-symbols-outlined text-[22px] sm:text-[24px] ${
                activeTab === 'profile' ? 'fill text-[#FF6B35]' : 'text-[#594139]'
              }`}
            >
              person
            </span>
          </div>
          <span className="text-[10px] sm:text-[11px] font-heading mt-0.5 tracking-tight whitespace-nowrap">
            Hồ sơ
          </span>
        </button>
      </div>
    </nav>
  );
};



