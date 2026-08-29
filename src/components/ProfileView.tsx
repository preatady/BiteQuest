import React, { useState } from 'react';
import { User, AchievementBadge, AchievementRarity } from '../types';

interface ProfileViewProps {
  user: User;
  achievements: AchievementBadge[];
  onUpdateTitle: (title: string) => void;
  onNavigateToExplore?: () => void;
  onNavigateToPassport?: () => void;
  onNavigateToFriends?: () => void;
  onOpenKnowledge?: () => void;
  onOpenAbout?: () => void;
  onOpenJudgeDev?: () => void;
  onOpenAuthModal?: () => void;
  onOpenPersonalization?: () => void;
  onOpenBiteBot?: () => void;
  onOpenLeaderboard?: () => void;
  onGoogleSignIn?: () => void;
  onGoogleSignOut?: () => void;
  isLoggedIn?: boolean;
  isSigningIn?: boolean;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  user,
  achievements,
  onUpdateTitle,
  onNavigateToExplore,
  onNavigateToPassport,
  onNavigateToFriends,
  onOpenKnowledge,
  onOpenAbout,
  onOpenJudgeDev,
  onOpenAuthModal,
  onOpenPersonalization,
  onOpenBiteBot,
  onOpenLeaderboard,
  onGoogleSignIn,
  onGoogleSignOut,
  isLoggedIn = false,
  isSigningIn = false,
}) => {
  const [showTitleSelector, setShowTitleSelector] = useState(false);
  const [selectedBadge, setSelectedBadge] = useState<AchievementBadge | null>(null);
  const [activeTabFilter, setActiveTabFilter] = useState<'all' | 'hunting' | 'unlocked'>('all');
  const [justEquippedTitle, setJustEquippedTitle] = useState<string | null>(null);

  const expPercent = Math.min(100, Math.round((user.xp / user.nextLevelXp) * 100));
  const unlockedCount = achievements.filter((a) => a.isUnlocked).length;
  const totalCount = achievements.length;
  const titlesPercent = totalCount > 0 ? Math.round((unlockedCount / totalCount) * 100) : 0;

  // Next Chase: Pick locked achievement closest to unlock (or high priority)
  const nextChaseBadge =
    achievements
      .filter((a) => !a.isUnlocked)
      .sort((a, b) => {
        const ratioA = (a.current || 0) / (a.target || 1);
        const ratioB = (b.current || 0) / (b.target || 1);
        return ratioB - ratioA;
      })[0] || achievements.find((a) => a.id === 'badge_right_time') || achievements[0];

  // Helper for Rarity Styling (Clean, mathematical, non-neon)
  const getRarityConfig = (rarity: AchievementRarity = 'common') => {
    switch (rarity) {
      case 'legendary':
        return {
          label: 'LEGENDARY',
          badgeBg: 'bg-amber-500/10 text-amber-800 border-amber-300/80',
          ringColor: 'ring-amber-400/40',
          barBg: 'bg-gradient-to-r from-amber-500 to-yellow-500',
          textAccent: 'text-amber-700',
          cardBg: 'bg-gradient-to-br from-white via-[#FFFDF5] to-[#FEF9E7]',
          borderColor: 'border-amber-300/70',
          glowColor: 'bg-amber-400/15',
        };
      case 'epic':
        return {
          label: 'EPIC',
          badgeBg: 'bg-orange-500/10 text-[#FF6B35] border-[#FF6B35]/30',
          ringColor: 'ring-[#FF6B35]/30',
          barBg: 'bg-[#FF6B35]',
          textAccent: 'text-[#FF6B35]',
          cardBg: 'bg-white',
          borderColor: 'border-[#FF6B35]/20',
          glowColor: 'bg-[#FF6B35]/10',
        };
      case 'rare':
        return {
          label: 'RARE',
          badgeBg: 'bg-[#2EC4B6]/15 text-[#006A62] border-[#2EC4B6]/30',
          ringColor: 'ring-[#2EC4B6]/30',
          barBg: 'bg-[#2EC4B6]',
          textAccent: 'text-[#006A62]',
          cardBg: 'bg-white',
          borderColor: 'border-[#2EC4B6]/20',
          glowColor: 'bg-[#2EC4B6]/10',
        };
      case 'common':
      default:
        return {
          label: 'COMMON',
          badgeBg: 'bg-stone-100 text-stone-700 border-stone-200',
          ringColor: 'ring-stone-300',
          barBg: 'bg-stone-600',
          textAccent: 'text-stone-700',
          cardBg: 'bg-white',
          borderColor: 'border-stone-200/80',
          glowColor: 'bg-stone-200/40',
        };
    }
  };

  const handleEquipTitle = (title: string) => {
    onUpdateTitle(title);
    setJustEquippedTitle(title);
    setTimeout(() => {
      setJustEquippedTitle(null);
    }, 2000);
  };

  const filteredAchievements = achievements.filter((a) => {
    if (activeTabFilter === 'unlocked') return a.isUnlocked;
    if (activeTabFilter === 'hunting') return !a.isUnlocked;
    return true;
  });

  return (
    <div
      className="min-h-screen bg-[#FDFCF8] text-[#2D2926] pt-[calc(4.5rem+env(safe-area-inset-top,0px))] pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))] px-4 max-w-lg mx-auto flex flex-col gap-5"
      id="profile-container"
    >
      {/* ========================================================= */}
      {/* SECTION 1: TOP PROFILE CARD (STREAMLINED HIERARCHY)       */}
      {/* ========================================================= */}
      <section
        className="bg-white rounded-3xl p-6 shadow-[0_8px_30px_rgba(45,41,38,0.06)] border border-[#2D2926]/5 relative overflow-hidden"
        id="profile-identity-section"
      >
        {/* Subtle Ambient Warm Glow */}
        <div className="absolute -right-12 -top-12 w-40 h-40 bg-[#FF6B35]/10 rounded-full blur-3xl pointer-events-none" />

        {/* Auth Action Top Right */}
        <div className="absolute top-4 right-4 z-20">
          {isLoggedIn ? (
            <button
              type="button"
              onClick={onGoogleSignOut}
              className="text-[11px] font-heading font-semibold text-[#594139] bg-[#F4F4F0] hover:bg-[#EFEEEA] px-2.5 py-1 rounded-full border border-[#2D2926]/10 flex items-center gap-1 active:scale-95 transition-all"
            >
              <span className="material-symbols-outlined text-[14px]">logout</span>
              Đăng xuất
            </button>
          ) : (
            <button
              type="button"
              onClick={onOpenAuthModal || onGoogleSignIn}
              disabled={isSigningIn}
              className={`text-[11px] font-heading font-bold text-white bg-[#FF6B35] px-3 py-1 rounded-full shadow flex items-center gap-1.5 transition-all ${
                isSigningIn ? 'opacity-60 cursor-not-allowed' : 'hover:bg-[#FF6B35]/90 active:scale-95'
              }`}
            >
              {isSigningIn ? (
                <>
                  <span className="material-symbols-outlined text-[13px] animate-spin">progress_activity</span>
                  <span>Đang kết nối...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[14px]">login</span>
                  <span>Đăng nhập</span>
                </>
              )}
            </button>
          )}
        </div>

        <div className="flex flex-col items-center text-center relative z-10">
          {/* Avatar with Level Badge */}
          <div className="relative mb-3">
            <div className="w-20 h-20 rounded-full overflow-hidden border-4 border-white shadow-md ring-2 ring-[#FF6B35]/20">
              <img
                src={user.avatarUrl}
                alt={user.name}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-[#FF6B35] text-white font-heading text-[11px] font-bold px-2.5 py-0.5 rounded-full border-2 border-white shadow-sm whitespace-nowrap">
              Lv. {user.level}
            </div>
          </div>

          {/* User Name */}
          <h2 className="font-heading text-xl font-black text-[#2D2926] mt-1">
            {user.displayName || user.name}
          </h2>

          <div className="flex items-center gap-1.5 mt-1 flex-wrap justify-center">
            {user.username && (
              <span className="text-[11px] font-mono font-medium text-neutral-500 bg-[#F5F3ED] px-2 py-0.5 rounded-md">
                @{user.username}
              </span>
            )}
            <span className="text-[10px] font-heading font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-900 border border-amber-200/80 flex items-center gap-1">
              <span>🏆</span>
              <span>TOP 5% Thợ Săn</span>
            </span>
          </div>

          {/* Active Title Badge with switcher toggle */}
          <button
            type="button"
            onClick={() => setShowTitleSelector(!showTitleSelector)}
            className="inline-flex items-center gap-1.5 bg-[#FAF9F5] border border-[#2D2926]/10 text-[#2D2926] px-3.5 py-1.5 rounded-full text-xs font-heading font-bold mt-2.5 hover:bg-[#F4F4F0] active:scale-95 transition-all shadow-xs"
            title="Nhấn để đổi danh hiệu"
          >
            <span>{user.activeTitle}</span>
            <span className="material-symbols-outlined text-[14px] text-neutral-500">expand_more</span>
          </button>

          {/* Title Selector Modal / Dropdown */}
          {showTitleSelector && (
            <div className="mt-3 p-3 bg-[#FAF9F5] rounded-2xl border border-[#2D2926]/10 flex flex-col gap-1.5 w-full max-w-xs animate-fade-in text-left shadow-lg">
              <div className="flex justify-between items-center px-1">
                <span className="text-[11px] font-heading font-bold text-[#594139]">
                  Chọn danh hiệu hiển thị:
                </span>
                <button
                  type="button"
                  onClick={() => setShowTitleSelector(false)}
                  className="text-neutral-400 hover:text-neutral-600 text-xs font-bold"
                >
                  ✕
                </button>
              </div>
              <div className="flex flex-col gap-1 max-h-48 overflow-y-auto pr-1">
                {/* Available / Unlocked titles */}
                {achievements
                  .filter((a) => a.isUnlocked)
                  .map((a) => {
                    const fullTitle = `${a.emoji} ${a.title}`;
                    const isSelected = user.activeTitle === fullTitle || user.activeTitle === a.title;
                    return (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => {
                          handleEquipTitle(fullTitle);
                          setShowTitleSelector(false);
                        }}
                        className={`px-3 py-2 rounded-xl text-xs font-heading font-semibold text-left flex items-center justify-between transition-all ${
                          isSelected
                            ? 'bg-[#FF6B35] text-white font-bold shadow-sm'
                            : 'hover:bg-white text-[#2D2926] bg-[#F4F4F0]'
                        }`}
                      >
                        <span className="flex items-center gap-1.5">
                          <span>{a.emoji}</span>
                          <span>{a.title}</span>
                        </span>
                        {isSelected && <span className="text-[10px] font-black">✓ ĐANG ĐEO</span>}
                      </button>
                    );
                  })}
              </div>
            </div>
          )}

          {justEquippedTitle && (
            <div className="mt-2 text-[11px] font-heading font-bold text-[#006A62] bg-[#2EC4B6]/15 px-3 py-1 rounded-full animate-fade-in">
              ✦ Đã mang danh hiệu: {justEquippedTitle}
            </div>
          )}

          {/* Achievement Overall Progression Bar */}
          <div className="w-full space-y-1.5 mt-4 max-w-xs bg-[#FAF9F5] p-3 rounded-2xl border border-[#2D2926]/5">
            <div className="flex justify-between text-xs font-heading text-[#594139]">
              <span className="font-bold flex items-center gap-1">
                <span>🎖️</span>
                <span>Bộ Sưu Tập Danh Hiệu</span>
              </span>
              <span className="font-bold text-[#FF6B35]">
                {unlockedCount} / {totalCount} <span className="text-[#594139]/70 font-normal">({titlesPercent}%)</span>
              </span>
            </div>
            <div className="h-2 w-full bg-[#E9E8E4] rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#FF6B35] to-[#2EC4B6] rounded-full transition-all duration-700"
                style={{ width: `${titlesPercent}%` }}
              />
            </div>

            {/* Next Milestone Hint */}
            {nextChaseBadge && (
              <div className="flex items-center justify-between text-[10px] font-heading text-[#594139] pt-1">
                <span className="flex items-center gap-1 font-semibold">
                  <span>🔥 Danh hiệu tiếp theo:</span>
                  <span className="text-[#2D2926] font-bold">{nextChaseBadge.title}</span>
                </span>
                <span className="text-[#FF6B35] font-bold">
                  {nextChaseBadge.target && nextChaseBadge.current !== undefined
                    ? `Còn ${nextChaseBadge.target - nextChaseBadge.current} bước`
                    : 'Gần rồi'}
                </span>
              </div>
            )}
          </div>

          {/* Quick Trigger: Leaderboard Banner */}
          {onOpenLeaderboard && (
            <button
              type="button"
              onClick={onOpenLeaderboard}
              className="mt-3 w-full max-w-xs bg-gradient-to-r from-amber-500/15 via-[#FF6B35]/15 to-rose-500/15 hover:from-amber-500/25 hover:to-rose-500/25 border border-amber-400/30 rounded-xl p-2.5 flex items-center justify-between transition-all active:scale-[0.98] cursor-pointer"
              id="profile-open-leaderboard-btn"
            >
              <div className="flex items-center gap-2">
                <span className="text-lg">🏆</span>
                <div className="text-left">
                  <span className="text-[11px] font-heading font-black text-[#2D2926] block leading-tight">
                    Bảng Xếp Hạng Đua Top
                  </span>
                  <span className="text-[9px] text-[#8D7168]">Mùa 1: Thực Thần Hà Nội</span>
                </div>
              </div>
              <span className="text-xs font-heading font-black text-[#FF6B35] flex items-center gap-0.5">
                Xem Top →
              </span>
            </button>
          )}
        </div>
      </section>

      {/* ========================================================= */}
      {/* SECTION 2: NEXT CHASE (🎯 TIẾP THEO BẠN SĂN GÌ?)           */}
      {/* ========================================================= */}
      {nextChaseBadge && (
        <section
          className="bg-gradient-to-br from-[#2D2926] to-[#1F1C1A] text-white rounded-3xl p-5 shadow-[0_8px_30px_rgba(45,41,38,0.12)] relative overflow-hidden border border-white/10"
          id="profile-next-chase-section"
        >
          {/* Subtle Ambient Light */}
          <div className="absolute right-0 top-0 w-36 h-36 bg-[#FF6B35]/20 rounded-full blur-2xl pointer-events-none" />

          <div className="flex items-center justify-between mb-3 relative z-10">
            <span className="text-[11px] font-heading font-black tracking-wider text-[#FF6B35] uppercase flex items-center gap-1.5">
              <span>🎯</span>
              <span>Tiếp Theo Bạn Săn Gì?</span>
            </span>
            <span className="text-[10px] font-mono font-bold bg-white/10 text-white/80 px-2 py-0.5 rounded-full">
              Chỉ {nextChaseBadge.percentOwned || 7.8}% Thợ Săn sở hữu
            </span>
          </div>

          <div className="flex items-center justify-between gap-3 relative z-10">
            <div className="flex items-center gap-3">
              <div className="w-13 h-13 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center text-2xl shrink-0 shadow-inner">
                {nextChaseBadge.emoji}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-heading text-sm font-bold text-white">
                    {nextChaseBadge.title}
                  </h4>
                  <span
                    className={`text-[9px] font-heading font-extrabold px-1.5 py-0.2 rounded-md ${
                      nextChaseBadge.rarity === 'epic'
                        ? 'bg-[#FF6B35]/30 text-[#FFA07A] border border-[#FF6B35]/40'
                        : 'bg-white/20 text-white'
                    }`}
                  >
                    {nextChaseBadge.rarity.toUpperCase()}
                  </span>
                </div>
                <p className="text-[11px] text-white/70 mt-0.5 line-clamp-1">
                  {nextChaseBadge.hint || nextChaseBadge.description}
                </p>
              </div>
            </div>

            {onNavigateToExplore && (
              <button
                type="button"
                onClick={onNavigateToExplore}
                className="bg-[#FF6B35] hover:bg-[#FF6B35]/90 active:scale-95 text-white text-xs font-heading font-bold px-3 py-2 rounded-xl shadow-md flex items-center gap-1 shrink-0 transition-all"
              >
                <span>Săn ngay</span>
                <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
              </button>
            )}
          </div>

          {/* Progress bar */}
          <div className="mt-3.5 pt-3 border-t border-white/10 flex items-center justify-between gap-3 relative z-10">
            <div className="flex-1">
              <div className="h-1.5 w-full bg-white/15 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#FF6B35] to-[#FFA07A] rounded-full transition-all duration-700"
                  style={{
                    width: `${Math.min(
                      100,
                      Math.round(((nextChaseBadge.current || 0) / (nextChaseBadge.target || 1)) * 100)
                    )}%`,
                  }}
                />
              </div>
            </div>
            <span className="text-[11px] font-heading font-bold text-white/90 shrink-0">
              {nextChaseBadge.current || 0} / {nextChaseBadge.target || 1}
            </span>
          </div>
        </section>
      )}

      {/* ========================================================= */}
      {/* SECTION 3: 8 MVP ACHIEVEMENTS HUNT COLLECTION              */}
      {/* ========================================================= */}
      <section
        className="bg-white rounded-3xl p-5 shadow-[0_4px_20px_rgba(45,41,38,0.06)] border border-[#2D2926]/5 flex flex-col gap-4"
        id="profile-achievements-collection"
      >
        <div className="flex justify-between items-center">
          <div>
            <h3 className="font-heading text-sm font-bold text-[#2D2926] flex items-center gap-1.5">
              <span className="text-base">🏆</span>
              Danh Hiệu Thợ Săn BiteQuest
            </h3>
            <p className="text-[11px] text-[#594139]/70 mt-0.5">
              Khám phá, canh giờ vàng & chinh phục vị giác
            </p>
          </div>
          <span className="text-xs font-heading font-bold text-[#FF6B35] bg-[#FF6B35]/10 px-2.5 py-0.5 rounded-full shrink-0">
            {unlockedCount} / {totalCount} Đã Mở
          </span>
        </div>

        {/* Filter Filter Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-[#F4F4F0] rounded-2xl text-xs font-heading font-semibold text-[#594139]">
          <button
            type="button"
            onClick={() => setActiveTabFilter('all')}
            className={`flex-1 py-1.5 px-2 rounded-xl text-center transition-all ${
              activeTabFilter === 'all'
                ? 'bg-white text-[#2D2926] font-bold shadow-xs'
                : 'hover:text-[#2D2926]'
            }`}
          >
            Tất cả ({totalCount})
          </button>
          <button
            type="button"
            onClick={() => setActiveTabFilter('hunting')}
            className={`flex-1 py-1.5 px-2 rounded-xl text-center transition-all ${
              activeTabFilter === 'hunting'
                ? 'bg-white text-[#FF6B35] font-bold shadow-xs'
                : 'hover:text-[#2D2926]'
            }`}
          >
            Đang săn ({totalCount - unlockedCount})
          </button>
          <button
            type="button"
            onClick={() => setActiveTabFilter('unlocked')}
            className={`flex-1 py-1.5 px-2 rounded-xl text-center transition-all ${
              activeTabFilter === 'unlocked'
                ? 'bg-white text-[#006A62] font-bold shadow-xs'
                : 'hover:text-[#2D2926]'
            }`}
          >
            Đã mở ({unlockedCount})
          </button>
        </div>

        {/* 8 MVP Achievement Cards 2-Column Grid */}
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
          {filteredAchievements.map((badge) => {
            const rarityStyle = getRarityConfig(badge.rarity);
            const current = badge.current ?? (badge.isUnlocked ? 1 : 0);
            const target = badge.target ?? 1;
            const progressRatio = Math.min(100, Math.round((current / target) * 100));
            const isEquipped = user.activeTitle.includes(badge.title);

            return (
              <div
                key={badge.id}
                onClick={() => setSelectedBadge(badge)}
                className={`p-2.5 sm:p-3 rounded-2xl border transition-all cursor-pointer group hover:shadow-sm flex flex-col justify-between min-h-[170px] ${
                  badge.isUnlocked
                    ? `${rarityStyle.cardBg} ${rarityStyle.borderColor}`
                    : 'bg-[#FAF9F5] border-[#2D2926]/8 hover:border-[#FF6B35]/30 shadow-2xs'
                }`}
              >
                {/* Header: Rarity & Status */}
                <div className="flex items-center justify-between gap-1 mb-1.5">
                  <span
                    className={`text-[8px] font-heading font-black px-1.5 py-0.2 rounded-md border uppercase ${rarityStyle.badgeBg}`}
                  >
                    {rarityStyle.label}
                  </span>

                  {badge.isUnlocked ? (
                    isEquipped ? (
                      <span className="text-[8px] font-heading font-bold text-[#006A62] bg-[#2EC4B6]/15 px-1.5 py-0.2 rounded-full border border-[#2EC4B6]/30 flex items-center gap-0.5">
                        <span>✦</span>
                        <span>Đeo</span>
                      </span>
                    ) : (
                      <span className="text-[8px] font-heading font-bold text-[#006A62] bg-[#2EC4B6]/15 px-1.5 py-0.2 rounded-full">
                        ✓ Mở
                      </span>
                    )
                  ) : (
                    <span className="text-[8px] font-heading font-bold text-[#8D7168] bg-[#2D2926]/5 px-1.5 py-0.2 rounded-full">
                      🔒 Khóa
                    </span>
                  )}
                </div>

                {/* Body: Emoji + Title + Desc */}
                <div className="flex flex-col items-center text-center my-1">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0 transition-transform group-hover:scale-110 shadow-xs mb-1.5 ${
                      badge.isUnlocked
                        ? 'bg-white shadow-xs border border-[#2D2926]/5'
                        : 'bg-[#EAE9E4]/70 text-[#2D2926]/60 border border-[#2D2926]/10'
                    }`}
                  >
                    {badge.emoji}
                  </div>

                  <h4
                    className={`font-heading text-xs font-black leading-tight line-clamp-1 w-full ${
                      badge.isUnlocked ? 'text-[#2D2926]' : 'text-[#2D2926]/80'
                    }`}
                  >
                    {badge.title}
                  </h4>

                  <p className="text-[10px] text-[#594139] mt-0.5 line-clamp-1 w-full">
                    {badge.description}
                  </p>

                  <span className="text-[9px] text-[#8D7168] font-mono mt-0.5">
                    Chỉ {badge.percentOwned || 7.8}% sở hữu
                  </span>
                </div>

                {/* Footer: Progress & Action */}
                <div className="pt-2 border-t border-[#2D2926]/5 flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-[9px] font-heading">
                    <span className="text-[#594139] font-medium">Tiến độ</span>
                    <span className="font-bold text-[#FF6B35]">
                      {badge.isUnlocked ? '✓ Đã mở' : `${current}/${target}`}
                    </span>
                  </div>

                  <div className="h-1 w-full bg-[#E9E8E4] rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${rarityStyle.barBg}`}
                      style={{ width: `${progressRatio}%` }}
                    />
                  </div>

                  {badge.isUnlocked ? (
                    isEquipped ? (
                      <div className="w-full py-1 rounded-lg text-[10px] font-heading font-black text-center bg-amber-100 text-amber-900 border border-amber-300">
                        ✓ Đang đeo
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEquipTitle(`${badge.emoji} ${badge.title}`);
                        }}
                        className="w-full py-1 rounded-lg text-[10px] font-heading font-bold text-center bg-[#FF6B35] text-white shadow-2xs hover:bg-[#FF6B35]/90 active:scale-95 transition-all"
                      >
                        ⚡ Đeo danh hiệu
                      </button>
                    )
                  ) : (
                    <div className="text-[10px] font-heading font-bold text-[#FF6B35] flex items-center justify-center gap-0.5 py-0.5">
                      <span>Săn ngay</span>
                      <span className="material-symbols-outlined text-[12px]">chevron_right</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Selected Badge Detail Modal */}
        {selectedBadge && (
          <div
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in"
            onClick={() => setSelectedBadge(null)}
          >
            <div
              className="bg-white rounded-3xl p-5 max-w-sm w-full shadow-2xl border border-[#2D2926]/10 flex flex-col gap-3 relative animate-scale-up text-left"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close button */}
              <button
                type="button"
                onClick={() => setSelectedBadge(null)}
                className="absolute top-4 right-4 w-7 h-7 rounded-full bg-[#F4F4F0] hover:bg-[#EFEEEA] text-[#2D2926] flex items-center justify-center text-xs font-bold transition-all"
              >
                ✕
              </button>

              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-2xl bg-[#FAF9F5] border border-[#2D2926]/10 flex items-center justify-center text-3xl shrink-0 shadow-xs">
                  {selectedBadge.emoji}
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <h4 className="font-heading text-base font-black text-[#2D2926]">
                      {selectedBadge.title}
                    </h4>
                    <span
                      className={`text-[9px] font-heading font-extrabold px-1.5 py-0.2 rounded-md border ${
                        getRarityConfig(selectedBadge.rarity).badgeBg
                      }`}
                    >
                      {getRarityConfig(selectedBadge.rarity).label}
                    </span>
                  </div>
                  <span className="text-[11px] text-neutral-500 font-mono block mt-0.5">
                    Chỉ {selectedBadge.percentOwned || 7.8}% Thợ Săn sở hữu
                  </span>
                </div>
              </div>

              <div className="bg-[#FAF9F5] p-3.5 rounded-2xl border border-[#2D2926]/5 text-xs text-[#594139] leading-relaxed">
                <span className="font-heading font-bold text-[#2D2926] block mb-1">
                  Điều kiện mở khóa:
                </span>
                {selectedBadge.description}
                {selectedBadge.hint && !selectedBadge.isUnlocked && (
                  <p className="mt-2 text-[#FF6B35] font-semibold flex items-center gap-1">
                    <span>💡</span> {selectedBadge.hint}
                  </p>
                )}
              </div>

              {/* Progress */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-heading font-bold text-[#594139]">
                  <span>Tiến độ</span>
                  <span className="text-[#FF6B35]">
                    {selectedBadge.isUnlocked
                      ? '100% (Hoàn tất)'
                      : `${selectedBadge.current || 0} / ${selectedBadge.target || 1}`}
                  </span>
                </div>
                <div className="h-2 w-full bg-[#E9E8E4] rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      getRarityConfig(selectedBadge.rarity).barBg
                    }`}
                    style={{
                      width: selectedBadge.isUnlocked
                        ? '100%'
                        : `${Math.min(
                            100,
                            Math.round(
                              ((selectedBadge.current || 0) / (selectedBadge.target || 1)) * 100
                            )
                          )}%`,
                    }}
                  />
                </div>
              </div>

              {/* Action */}
              <div className="pt-2 flex flex-col gap-2">
                {selectedBadge.isUnlocked ? (
                  <button
                    type="button"
                    onClick={() => {
                      handleEquipTitle(`${selectedBadge.emoji} ${selectedBadge.title}`);
                      setSelectedBadge(null);
                    }}
                    className="w-full py-2.5 bg-[#2EC4B6] hover:bg-[#2EC4B6]/90 text-[#004D40] font-heading text-xs font-bold rounded-xl shadow-sm transition-all text-center flex items-center justify-center gap-1"
                  >
                    <span>✦</span>
                    <span>Đeo danh hiệu này trên hồ sơ</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedBadge(null);
                      onNavigateToExplore?.();
                    }}
                    className="w-full py-2.5 bg-[#FF6B35] hover:bg-[#FF6B35]/90 text-white font-heading text-xs font-bold rounded-xl shadow-md transition-all text-center flex items-center justify-center gap-1"
                  >
                    <span>Săn ngay trên bản đồ</span>
                    <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* ========================================================= */}
      {/* SECTION 4: PERSONALIZATION PREFERENCES & GU ẨM THỰC        */}
      {/* ========================================================= */}
      <section className="bg-white rounded-3xl p-5 shadow-[0_8px_30px_rgba(45,41,38,0.06)] border border-[#2D2926]/5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">✨</span>
            <h3 className="font-heading text-sm font-bold text-[#2D2926]">Gu ẩm thực & Phong cách</h3>
          </div>
          {onOpenPersonalization && (
            <button
              type="button"
              onClick={onOpenPersonalization}
              className="text-[11px] font-heading font-bold text-[#FF6B35] hover:underline flex items-center gap-0.5"
            >
              <span>Tuỳ chỉnh</span>
              <span className="material-symbols-outlined text-[13px]">edit</span>
            </button>
          )}
        </div>

        <div className="space-y-2.5">
          <div>
            <span className="text-[11px] font-heading font-semibold text-neutral-500 block mb-1.5">
              Món ăn yêu thích:
            </span>
            {user.foodPreferences && user.foodPreferences.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {user.foodPreferences.map((p) => (
                  <span
                    key={p}
                    className="px-2.5 py-1 bg-[#FF6B35]/10 text-[#FF6B35] text-xs font-heading font-bold rounded-xl border border-[#FF6B35]/20"
                  >
                    {p}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-neutral-400 font-sans italic">
                Chưa chọn gu món ăn. Nhấn "Tuỳ chỉnh" để thiết lập.
              </p>
            )}
          </div>

          <div>
            <span className="text-[11px] font-heading font-semibold text-neutral-500 block mb-1.5">
              Phong cách khám phá:
            </span>
            {user.explorationStyle ? (
              <span className="inline-block px-3 py-1 bg-[#2EC4B6]/15 text-[#006A62] text-xs font-heading font-bold rounded-xl">
                {user.explorationStyle}
              </span>
            ) : (
              <p className="text-xs text-neutral-400 font-sans italic">
                Chưa chọn phong cách.
              </p>
            )}
          </div>
        </div>
      </section>

      {/* ========================================================= */}
      {/* SECTION 5: EXPLORATION STATS                              */}
      {/* ========================================================= */}
      <section className="grid grid-cols-3 gap-2.5" id="profile-stats-grid">
        <div className="bg-white rounded-2xl p-3.5 shadow-[0_4px_16px_rgba(45,41,38,0.04)] border border-[#2D2926]/5 flex flex-col items-center justify-center text-center">
          <span className="text-2xl mb-1">🍽️</span>
          <span className="font-heading text-xl font-black text-[#FF6B35] leading-none">
            {user.stats.placesDiscovered}
          </span>
          <span className="text-[11px] font-heading font-medium text-[#594139] mt-1">
            Quán đã ăn
          </span>
        </div>

        <div className="bg-white rounded-2xl p-3.5 shadow-[0_4px_16px_rgba(45,41,38,0.04)] border border-[#2D2926]/5 flex flex-col items-center justify-center text-center">
          <span className="text-2xl mb-1">📓</span>
          <span className="font-heading text-xl font-black text-[#00A7CB] leading-none">
            {user.stats.passportsCompleted}
          </span>
          <span className="text-[11px] font-heading font-medium text-[#594139] mt-1">
            Hành trình xong
          </span>
        </div>

        <div className="bg-white rounded-2xl p-3.5 shadow-[0_4px_16px_rgba(45,41,38,0.04)] border border-[#2D2926]/5 flex flex-col items-center justify-center text-center">
          <span className="text-2xl mb-1">🥇</span>
          <span className="font-heading text-xl font-black text-[#2EC4B6] leading-none">
            {user.stats.firstBitesCount}
          </span>
          <span className="text-[11px] font-heading font-medium text-[#594139] mt-1">
            First Bites
          </span>
        </div>
      </section>

      {/* ========================================================= */}
      {/* SECTION 6: ACTIVE PASSPORT PREVIEW                        */}
      {/* ========================================================= */}
      <section className="bg-white rounded-3xl p-5 shadow-[0_4px_20px_rgba(45,41,38,0.06)] border border-[#2D2926]/5 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="font-heading text-sm font-bold text-[#2D2926] flex items-center gap-2">
            <span className="material-symbols-outlined text-[#FF6B35] text-[18px]">menu_book</span>
            Hành Trình Khu Vực Đang Mở
          </h3>
          {onNavigateToPassport && (
            <button
              type="button"
              onClick={onNavigateToPassport}
              className="text-xs font-heading font-bold text-[#FF6B35] hover:underline flex items-center gap-0.5"
            >
              <span>Xem chi tiết</span>
              <span className="material-symbols-outlined text-[14px]">chevron_right</span>
            </button>
          )}
        </div>

        <div className="bg-[#FAF9F5] p-3.5 rounded-2xl border border-[#2D2926]/5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-[#FF6B35]/15 flex items-center justify-center text-xl shrink-0">
              🏮
            </div>
            <div>
              <h4 className="font-heading text-xs font-bold text-[#2D2926]">
                Hành trình Cầu Giấy
              </h4>
              <p className="text-[11px] text-[#594139]">
                4 / 6 thử thách hoàn tất
              </p>
            </div>
          </div>

          <div className="w-20">
            <div className="flex justify-end text-[10px] font-heading font-bold text-[#2EC4B6] mb-1">
              66%
            </div>
            <div className="h-1.5 w-full bg-[#E9E8E4] rounded-full overflow-hidden">
              <div className="h-full bg-[#2EC4B6] rounded-full" style={{ width: '66%' }} />
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================= */}
      {/* SECTION 7: COMMUNITY CONTRIBUTION                        */}
      {/* ========================================================= */}
      <section className="bg-white rounded-3xl p-5 shadow-[0_4px_20px_rgba(45,41,38,0.06)] border border-[#2D2926]/5 flex flex-col gap-3">
        <h3 className="font-heading text-sm font-bold text-[#2D2926] flex items-center gap-2">
          <span className="material-symbols-outlined text-[#2EC4B6] text-[18px]">verified</span>
          Đóng Góp Cộng Đồng & Quán Ngõ
        </h3>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="bg-[#FAF9F5] p-3 rounded-2xl border border-[#2D2926]/5">
            <span className="text-[10px] font-heading font-bold uppercase text-[#594139]/70 block">
              Quán ngõ đề xuất
            </span>
            <span className="font-heading text-lg font-black text-[#2D2926] block mt-0.5">
              1 quán
            </span>
            <span className="text-[10px] text-[#006A62] font-semibold">Đã được cộng đồng duyệt</span>
          </div>

          <div className="bg-[#FAF9F5] p-3 rounded-2xl border border-[#2D2926]/5">
            <span className="text-[10px] font-heading font-bold uppercase text-[#594139]/70 block">
              Xác minh độc lập
            </span>
            <span className="font-heading text-lg font-black text-[#2D2926] block mt-0.5">
              {user.stats.firstBitesCount} lượt
            </span>
            <span className="text-[10px] text-[#FF6B35] font-semibold">Scout Verifier chuẩn</span>
          </div>
        </div>
      </section>

      {/* ========================================================= */}
      {/* SECTION 8: QUICK ACTIONS & PREFERENCES                    */}
      {/* ========================================================= */}
      <section className="bg-white rounded-3xl p-4 shadow-[0_4px_20px_rgba(45,41,38,0.06)] border border-[#2D2926]/5 flex flex-col divide-y divide-[#2D2926]/5">
        {onOpenBiteBot && (
          <button
            type="button"
            onClick={onOpenBiteBot}
            className="w-full py-3 px-2 flex items-center justify-between text-left hover:bg-[#FF6B35]/5 rounded-xl transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#FF6B35] to-[#FFA07A] flex items-center justify-center text-white text-xs shadow-xs">
                ✨
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-heading text-xs font-bold text-[#FF6B35]">BiteBot - Trợ Lý Ẩm Thực AI</span>
                  <span className="bg-[#2EC4B6]/20 text-[#006A62] text-[9px] font-heading font-black px-1.5 py-0.2 rounded-full">Gemini 3.7</span>
                </div>
                <p className="text-[11px] text-[#8D7168] mt-0.5">Tư vấn món ngon, quán cafe, ngân sách thông minh</p>
              </div>
            </div>
            <span className="material-symbols-outlined text-[#FF6B35] text-[18px] group-hover:translate-x-0.5 transition-transform">chevron_right</span>
          </button>
        )}

        {onNavigateToFriends && (
          <button
            type="button"
            onClick={onNavigateToFriends}
            className="w-full py-3 px-2 flex items-center justify-between text-left hover:bg-[#FAF9F5] rounded-xl transition-all"
          >
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-[#FF6B35] text-[20px]">history</span>
              <span className="font-heading text-xs font-bold text-[#2D2926]">Lịch Sử Dấu Bite Của Bạn</span>
            </div>
            <span className="material-symbols-outlined text-[#594139]/50 text-[18px]">chevron_right</span>
          </button>
        )}

        {onOpenKnowledge && (
          <button
            type="button"
            onClick={onOpenKnowledge}
            className="w-full py-3 px-2 flex items-center justify-between text-left hover:bg-[#FAF9F5] rounded-xl transition-all"
          >
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-[#2EC4B6] text-[20px]">quiz</span>
              <span className="font-heading text-xs font-bold text-[#2D2926]">Thử Thách Tri Thức Ẩm Thực</span>
            </div>
            <span className="material-symbols-outlined text-[#594139]/50 text-[18px]">chevron_right</span>
          </button>
        )}

        {onOpenAbout && (
          <button
            type="button"
            onClick={onOpenAbout}
            className="w-full py-3 px-2 flex items-center justify-between text-left hover:bg-[#FAF9F5] rounded-xl transition-all"
          >
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-[#594139] text-[20px]">info</span>
              <span className="font-heading text-xs font-bold text-[#2D2926]">Về BiteQuest Vietnam</span>
            </div>
            <span className="material-symbols-outlined text-[#594139]/50 text-[18px]">chevron_right</span>
          </button>
        )}

        {onOpenJudgeDev && (
          <button
            type="button"
            onClick={onOpenJudgeDev}
            className="w-full py-3 px-2 flex items-center justify-between text-left hover:bg-[#FAF9F5] rounded-xl transition-all"
          >
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-[#006A62] text-[20px]">terminal</span>
              <div className="flex items-center gap-2">
                <span className="font-heading text-xs font-bold text-[#006A62]">Judge / Developer Console</span>
                <span className="bg-[#2EC4B6]/20 text-[#006A62] text-[9px] px-1.5 py-0.2 rounded font-mono font-bold">DEV</span>
              </div>
            </div>
            <span className="material-symbols-outlined text-[#594139]/50 text-[18px]">chevron_right</span>
          </button>
        )}
      </section>
    </div>
  );
};

