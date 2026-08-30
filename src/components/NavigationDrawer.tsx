import React from 'react';
import { User, TabType } from '../types';
import { useLanguage } from '../context/LanguageContext';
import { LanguageToggle } from './LanguageToggle';

interface NavigationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: TabType;
  onSelectTab: (tab: TabType) => void;
  user: User;
  onOpenAbout: () => void;
  onOpenJudgeDev: () => void;
  onOpenAuthModal?: () => void;
  onOpenBiteBot?: () => void;
  onOpenLeaderboard?: () => void;
  onGoogleSignIn?: () => void;
  onGoogleSignOut?: () => void;
  isLoggedIn?: boolean;
  isSigningIn?: boolean;
}

export const NavigationDrawer: React.FC<NavigationDrawerProps> = ({
  isOpen,
  onClose,
  activeTab,
  onSelectTab,
  user,
  onOpenAbout,
  onOpenJudgeDev,
  onOpenAuthModal,
  onOpenBiteBot,
  onOpenLeaderboard,
  onGoogleSignIn,
  onGoogleSignOut,
  isLoggedIn = false,
  isSigningIn = false,
}) => {
  const { t, isVi } = useLanguage();

  if (!isOpen) return null;

  const handleNavClick = (tab: TabType) => {
    onSelectTab(tab);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex"
      id="navigation-drawer-root"
      role="dialog"
      aria-modal="true"
      aria-label={isVi ? 'Menu điều hướng chính' : 'Main navigation menu'}
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 animate-fade-in"
        onClick={onClose}
        id="drawer-backdrop"
      />

      {/* Drawer Container (Sliding from Left) */}
      <div
        className="relative z-10 w-[84vw] max-w-sm h-full bg-[#FDFCF8] text-[#2D2926] shadow-2xl flex flex-col justify-between overflow-y-auto animate-slide-right border-r border-[#2D2926]/10 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
        id="navigation-drawer-content"
      >
        {/* TOP SECTION: User Summary & Close */}
        <div>
          {/* Header Bar */}
          <div className="pt-[max(1.25rem,env(safe-area-inset-top))] px-4 pb-3 flex items-center justify-between border-b border-[#2D2926]/5">
            <div className="flex items-center gap-2">
              <span className="text-xl">🍜</span>
              <span className="font-heading text-lg font-black text-[#FF6B35] tracking-tight">
                BiteQuest
              </span>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-10 h-10 rounded-full bg-[#F4F4F0] hover:bg-[#EAE9E4] text-[#2D2926] flex items-center justify-center active:scale-95 transition-all focus:outline-none"
              aria-label={t('close')}
              id="btn-close-drawer"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>

          {/* User Profile Card Summary (Tap -> Profile) */}
          <div
            onClick={() => handleNavClick('profile')}
            className="p-4 mx-3 my-3 bg-white rounded-2xl border border-[#2D2926]/5 shadow-[0_2px_12px_rgba(45,41,38,0.04)] cursor-pointer hover:border-[#FF6B35]/30 transition-all flex items-center gap-3 active:scale-98"
            id="drawer-user-card"
          >
            <div className="relative">
              <img
                src={user.avatarUrl}
                alt={user.name}
                className="w-12 h-12 rounded-full object-cover border-2 border-white shadow-sm ring-1 ring-[#FF6B35]/30"
              />
              <span className="absolute -bottom-1 -right-1 bg-[#FF6B35] text-white text-[9px] font-heading font-black px-1.5 py-0.2 rounded-full">
                Lv.{user.level}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-heading text-sm font-bold text-[#2D2926] truncate">
                {user.name}
              </h3>
              <p className="text-[11px] font-heading font-semibold text-[#006A62] bg-[#2EC4B6]/15 px-2 py-0.5 rounded-full inline-block mt-0.5 truncate max-w-full">
                {user.activeTitle}
              </p>
            </div>
            <span className="material-symbols-outlined text-[#594139]/50 text-[18px]">
              chevron_right
            </span>
          </div>

          {/* XP Mini Bar */}
          <div className="px-5 mb-3 flex items-center justify-between text-[11px] font-heading text-[#594139]">
            <span className="font-medium">{isVi ? 'Tiến độ cấp độ:' : 'Rank Progress:'}</span>
            <span className="font-bold text-[#FF6B35]">
              {user.xp.toLocaleString(isVi ? 'vi-VN' : 'en-US')} / {user.nextLevelXp.toLocaleString(isVi ? 'vi-VN' : 'en-US')} XP
            </span>
          </div>

          {/* PRIMARY NAVIGATION LIST */}
          <div className="px-3 space-y-1">
            <span className="px-3 text-[10px] font-heading font-bold uppercase tracking-wider text-[#594139]/70">
              {isVi ? 'Khám phá & Thử thách' : 'Discovery & Quests'}
            </span>

            {/* 1. Explore */}
            <button
              type="button"
              onClick={() => handleNavClick('explore')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-heading text-xs font-bold text-left transition-all ${
                activeTab === 'explore'
                  ? 'bg-[#FF6B35]/15 text-[#FF6B35]'
                  : 'text-[#2D2926] hover:bg-[#F4F4F0]'
              }`}
              id="drawer-nav-explore"
            >
              <span className="material-symbols-outlined text-[20px]">explore</span>
              <span className="flex-1">{isVi ? 'Bản Đồ Khám Phá' : 'Food Exploration Map'}</span>
              {activeTab === 'explore' && <span className="w-1.5 h-1.5 rounded-full bg-[#FF6B35]" />}
            </button>

            {/* 1b. Feed */}
            <button
              type="button"
              onClick={() => handleNavClick('friends')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-heading text-xs font-bold text-left transition-all ${
                activeTab === 'friends'
                  ? 'bg-[#FF6B35]/15 text-[#FF6B35]'
                  : 'text-[#2D2926] hover:bg-[#F4F4F0]'
              }`}
              id="drawer-nav-friends"
            >
              <span className="material-symbols-outlined text-[20px]">dynamic_feed</span>
              <span className="flex-1">{isVi ? 'Bản Tin Bạn Bè & Cộng Đồng' : 'Community & Food Feed'}</span>
              {activeTab === 'friends' && <span className="w-1.5 h-1.5 rounded-full bg-[#FF6B35]" />}
            </button>

            {/* 1c. Radar */}
            <button
              type="button"
              onClick={() => handleNavClick('radar')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-heading text-xs font-bold text-left transition-all ${
                activeTab === 'radar'
                  ? 'bg-[#FF6B35]/15 text-[#FF6B35]'
                  : 'text-[#2D2926] hover:bg-[#F4F4F0]'
              }`}
              id="drawer-nav-radar"
            >
              <span className="material-symbols-outlined text-[20px]">radar</span>
              <span className="flex-1">{isVi ? 'Radar Gợi Ý Ẩm Thực' : 'Culinary Food Radar'}</span>
              {activeTab === 'radar' && <span className="w-1.5 h-1.5 rounded-full bg-[#FF6B35]" />}
            </button>

            {/* 2. Camera Capture */}
            <button
              type="button"
              onClick={() => handleNavClick('camera')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-heading text-xs font-bold text-left transition-all ${
                activeTab === 'camera'
                  ? 'bg-[#FF6B35]/15 text-[#FF6B35]'
                  : 'text-[#2D2926] hover:bg-[#F4F4F0]'
              }`}
              id="drawer-nav-camera"
            >
              <span className="material-symbols-outlined text-[20px]">photo_camera</span>
              <span className="flex-1">{isVi ? 'Chụp & Xác Minh Món Ngon' : 'Snap & Verify Bites'}</span>
              {activeTab === 'camera' && <span className="w-1.5 h-1.5 rounded-full bg-[#FF6B35]" />}
            </button>

            {/* 3. Passport (Hành trình) */}
            <button
              type="button"
              onClick={() => handleNavClick('passport')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-heading text-xs font-bold text-left transition-all ${
                activeTab === 'passport'
                  ? 'bg-[#FF6B35]/15 text-[#FF6B35]'
                  : 'text-[#2D2926] hover:bg-[#F4F4F0]'
              }`}
              id="drawer-nav-passport"
            >
              <span className="material-symbols-outlined text-[20px]">style</span>
              <span className="flex-1">{isVi ? 'Hành Trình Ẩm Thực' : 'Culinary Passport'}</span>
              {activeTab === 'passport' && <span className="w-1.5 h-1.5 rounded-full bg-[#FF6B35]" />}
            </button>

            {/* 4. Profile */}
            <button
              type="button"
              onClick={() => handleNavClick('profile')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-heading text-xs font-bold text-left transition-all ${
                activeTab === 'profile'
                  ? 'bg-[#FF6B35]/15 text-[#FF6B35]'
                  : 'text-[#2D2926] hover:bg-[#F4F4F0]'
              }`}
              id="drawer-nav-profile"
            >
              <span className="material-symbols-outlined text-[20px]">person</span>
              <span className="flex-1">{isVi ? 'Hồ Sơ & Danh Hiệu' : 'Profile & Badges'}</span>
              {activeTab === 'profile' && <span className="w-1.5 h-1.5 rounded-full bg-[#FF6B35]" />}
            </button>

            {/* 4b. Leaderboard (Đua Top) */}
            {onOpenLeaderboard && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenLeaderboard();
                }}
                className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-heading text-xs font-bold text-left transition-all bg-gradient-to-r from-amber-500/10 to-[#FF6B35]/10 hover:from-amber-500/20 hover:to-[#FF6B35]/20 text-[#2D2926] border border-amber-500/20"
                id="drawer-nav-leaderboard"
              >
                <span className="text-base">🏆</span>
                <span className="flex-1 font-bold text-amber-700">{isVi ? 'Bảng Xếp Hạng Đua Top' : 'Foodie Leaderboard'}</span>
                <span className="bg-amber-400/20 text-amber-900 text-[9px] font-heading font-black px-1.5 py-0.5 rounded-full">
                  {isVi ? 'MÙA 1 🔥' : 'SEASON 1 🔥'}
                </span>
              </button>
            )}

            {/* 5. BiteBot AI Concierge */}
            {onOpenBiteBot && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenBiteBot();
                }}
                className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-heading text-xs font-bold text-left transition-all bg-gradient-to-r from-[#FF6B35]/12 to-[#2EC4B6]/12 hover:from-[#FF6B35]/20 hover:to-[#2EC4B6]/20 text-[#2D2926] border border-[#FF6B35]/20"
                id="drawer-nav-bitebot"
              >
                <span className="text-base">✨</span>
                <span className="flex-1 font-bold text-[#FF6B35]">{isVi ? 'BiteBot - Trợ lý AI' : 'BiteBot - AI Foodie Assistant'}</span>
                <span className="bg-[#2EC4B6]/20 text-[#006A62] text-[9px] font-heading font-black px-1.5 py-0.5 rounded-full">
                  Gemini 3.7
                </span>
              </button>
            )}
          </div>

          {/* DIVIDER */}
          <div className="my-3 mx-4 border-t border-[#2D2926]/5" />

          {/* LANGUAGE SETTING SELECTOR */}
          <div className="px-4 mb-3 space-y-1.5">
            <div className="flex items-center justify-between text-[10px] font-heading font-bold uppercase tracking-wider text-[#594139]/70">
              <span>{t('languageSettingTitle')}</span>
              <span className="text-[#FF6B35]">{isVi ? 'VI / EN' : 'EN / VI'}</span>
            </div>
            <LanguageToggle variant="full" />
          </div>

          {/* SECONDARY SECTION */}
          <div className="px-3 space-y-1">
            <span className="px-3 text-[10px] font-heading font-bold uppercase tracking-wider text-[#594139]/70">
              {isVi ? 'Thông tin & Trợ giúp' : 'Info & Help'}
            </span>

            {/* Về BiteQuest */}
            <button
              type="button"
              onClick={() => {
                onOpenAbout();
                onClose();
              }}
              className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-heading text-xs font-medium text-[#2D2926] hover:bg-[#F4F4F0] text-left transition-all"
              id="drawer-nav-about"
            >
              <span className="material-symbols-outlined text-[20px] text-[#FF6B35]">info</span>
              <span className="flex-1">{isVi ? 'Về BiteQuest' : 'About BiteQuest'}</span>
            </button>

            {/* Judge / Developer Info */}
            <button
              type="button"
              onClick={() => {
                onOpenJudgeDev();
                onClose();
              }}
              className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-heading text-xs font-medium text-[#006A62] bg-[#2EC4B6]/10 hover:bg-[#2EC4B6]/20 text-left transition-all"
              id="drawer-nav-judge-dev"
            >
              <span className="material-symbols-outlined text-[20px] text-[#2EC4B6]">terminal</span>
              <span className="flex-1 font-bold">Judge / Developer Console</span>
              <span className="text-[9px] bg-[#2EC4B6] text-white px-1.5 py-0.2 rounded font-black">
                DEV
              </span>
            </button>
          </div>
        </div>

        {/* BOTTOM AUTH & FOOTER */}
        <div className="p-4 border-t border-[#2D2926]/5 mt-4">
          {isLoggedIn ? (
            <div className="space-y-2">
              {user.isGuest && onOpenAuthModal && (
                <button
                  type="button"
                  onClick={() => {
                    onOpenAuthModal();
                    onClose();
                  }}
                  className="w-full py-2.5 px-3 bg-[#FF6B35]/15 hover:bg-[#FF6B35]/25 text-[#FF6B35] rounded-xl font-heading text-xs font-bold flex items-center justify-center gap-2 active:scale-98 transition-all"
                >
                  <span className="material-symbols-outlined text-[16px]">upgrade</span>
                  <span>{isVi ? 'Nâng cấp tài khoản' : 'Upgrade Account'}</span>
                </button>
              )}
              <button
                type="button"
                onClick={onGoogleSignOut}
                className="w-full py-2.5 px-3 bg-[#F4F4F0] hover:bg-[#EAE9E4] text-[#594139] rounded-xl font-heading text-xs font-semibold flex items-center justify-center gap-2 active:scale-98 transition-all"
              >
                <span className="material-symbols-outlined text-[18px]">logout</span>
                <span>{t('logOut')}</span>
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                if (onOpenAuthModal) {
                  onOpenAuthModal();
                  onClose();
                } else if (onGoogleSignIn) {
                  onGoogleSignIn();
                }
              }}
              disabled={isSigningIn}
              className={`w-full py-2.5 px-3 bg-[#FF6B35] text-white rounded-xl font-heading text-xs font-bold flex items-center justify-center gap-2 shadow-md transition-all ${
                isSigningIn ? 'opacity-60 cursor-not-allowed' : 'hover:bg-[#FF6B35]/90 active:scale-98'
              }`}
            >
              {isSigningIn ? (
                <>
                  <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                  <span>{isVi ? 'Đang kết nối...' : 'Connecting...'}</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[18px]">login</span>
                  <span>{isVi ? 'Đăng nhập / Đăng ký' : 'Sign In / Sign Up'}</span>
                </>
              )}
            </button>
          )}

          <div className="mt-3 text-center text-[10px] text-[#594139]/60 font-heading">
            <span>BiteQuest v1.2.0 · {isVi ? 'Hà Nội Edition 🍜' : 'Hanoi & Vietnam Edition 🍜'}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

