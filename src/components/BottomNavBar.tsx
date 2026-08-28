import React from 'react';
import { TabType } from '../types';
export type { TabType };

interface BottomNavBarProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

/**
 * BiteQuest V5 Primary Navigation:
 * Exposes 5 balanced symmetric slots:
 * 1. Khám phá (explore)
 * 2. Radar (radar)
 * 3. Chụp Bite (camera - Center Action Hero FAB)
 * 4. Hành trình (passport)
 * 5. Hồ sơ (profile)
 */
export const BottomNavBar: React.FC<BottomNavBarProps> = ({ activeTab, onTabChange }) => {
  return (
    <nav
      className="fixed bottom-0 left-0 w-full z-40 bg-white/95 backdrop-blur-lg rounded-t-2xl shadow-[0_-4px_24px_rgba(45,41,38,0.08)] border-t border-[#2D2926]/6 pb-[max(0.65rem,env(safe-area-inset-bottom))]"
      id="main-bottom-nav"
    >
      <div className="max-w-md mx-auto grid grid-cols-5 items-center px-1 pt-1 relative">
        {/* 1. Explore (Khám phá) */}
        <button
          type="button"
          onClick={() => onTabChange('explore')}
          className={`min-h-[44px] flex flex-col items-center justify-center py-1 rounded-xl transition-all duration-150 active:scale-95 cursor-pointer ${
            activeTab === 'explore'
              ? 'text-[#FF6B35] font-bold'
              : 'text-[#594139] opacity-70 hover:opacity-100 hover:text-[#FF6B35]'
          }`}
          id="tab-explore"
        >
          <span
            className={`material-symbols-outlined text-[23px] sm:text-[24px] ${
              activeTab === 'explore' ? 'fill' : ''
            }`}
          >
            map
          </span>
          <span className="text-[10px] sm:text-[11px] font-heading mt-0.5 tracking-tight whitespace-nowrap">
            Khám phá
          </span>
        </button>

        {/* 2. Radar (Radar Gợi Ý) */}
        <button
          type="button"
          onClick={() => onTabChange('radar')}
          className={`min-h-[44px] flex flex-col items-center justify-center py-1 rounded-xl transition-all duration-150 active:scale-95 cursor-pointer ${
            activeTab === 'radar'
              ? 'text-[#FF6B35] font-bold'
              : 'text-[#594139] opacity-70 hover:opacity-100 hover:text-[#FF6B35]'
          }`}
          id="tab-radar"
        >
          <span
            className={`material-symbols-outlined text-[23px] sm:text-[24px] ${
              activeTab === 'radar' ? 'fill' : ''
            }`}
          >
            radar
          </span>
          <span className="text-[10px] sm:text-[11px] font-heading mt-0.5 tracking-tight whitespace-nowrap">
            Radar
          </span>
        </button>

        {/* 3. Center Camera Action Hero FAB (Chụp Bite - True Horizontal Center) */}
        <div className="flex flex-col items-center justify-center relative -top-3.5 sm:-top-4">
          <button
            type="button"
            onClick={() => onTabChange('camera')}
            className={`w-[58px] h-[58px] sm:w-[60px] sm:h-[60px] rounded-full bg-[#FF6B35] text-white flex items-center justify-center ring-4 ring-white shadow-[0_4px_16px_rgba(255,107,53,0.28)] active:scale-90 hover:scale-105 transition-all cursor-pointer shrink-0 z-10 ${
              activeTab === 'camera' ? 'ring-[#FF6B35]/25 scale-105' : ''
            }`}
            id="tab-camera-fab"
            title="Chụp Bite"
            aria-label="Chụp Bite"
          >
            <span className="material-symbols-outlined text-[28px] sm:text-[30px] fill">photo_camera</span>
          </button>
          <span className="text-[10px] sm:text-[11px] font-heading font-semibold text-[#FF6B35] mt-0.5 tracking-tight whitespace-nowrap">
            Chụp Bite
          </span>
        </div>

        {/* 4. Journey (Hành trình) */}
        <button
          type="button"
          onClick={() => onTabChange('passport')}
          className={`min-h-[44px] flex flex-col items-center justify-center py-1 rounded-xl transition-all duration-150 active:scale-95 cursor-pointer ${
            activeTab === 'passport'
              ? 'text-[#FF6B35] font-bold'
              : 'text-[#594139] opacity-70 hover:opacity-100 hover:text-[#FF6B35]'
          }`}
          id="tab-passport"
        >
          <span
            className={`material-symbols-outlined text-[23px] sm:text-[24px] ${
              activeTab === 'passport' ? 'fill' : ''
            }`}
          >
            style
          </span>
          <span className="text-[10px] sm:text-[11px] font-heading mt-0.5 tracking-tight whitespace-nowrap">
            Hành trình
          </span>
        </button>

        {/* 5. Profile (Hồ sơ) */}
        <button
          type="button"
          onClick={() => onTabChange('profile')}
          className={`min-h-[44px] flex flex-col items-center justify-center py-1 rounded-xl transition-all duration-150 active:scale-95 cursor-pointer ${
            activeTab === 'profile'
              ? 'text-[#FF6B35] font-bold'
              : 'text-[#594139] opacity-70 hover:opacity-100 hover:text-[#FF6B35]'
          }`}
          id="tab-profile"
        >
          <span
            className={`material-symbols-outlined text-[23px] sm:text-[24px] ${
              activeTab === 'profile' ? 'fill' : ''
            }`}
          >
            person
          </span>
          <span className="text-[10px] sm:text-[11px] font-heading mt-0.5 tracking-tight whitespace-nowrap">
            Hồ sơ
          </span>
        </button>
      </div>
    </nav>
  );
};


