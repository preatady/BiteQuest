import React, { useState } from 'react';
import { User, AchievementBadge } from '../types';

interface ProfileViewProps {
  user: User;
  achievements: AchievementBadge[];
  onUpdateTitle: (title: string) => void;
  onNavigateToPassport?: () => void;
  onNavigateToFriends?: () => void;
  onOpenKnowledge?: () => void;
  onOpenAbout?: () => void;
  onOpenJudgeDev?: () => void;
  onOpenAuthModal?: () => void;
  onOpenPersonalization?: () => void;
  onGoogleSignIn?: () => void;
  onGoogleSignOut?: () => void;
  isLoggedIn?: boolean;
  isSigningIn?: boolean;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  user,
  achievements,
  onUpdateTitle,
  onNavigateToPassport,
  onNavigateToFriends,
  onOpenKnowledge,
  onOpenAbout,
  onOpenJudgeDev,
  onOpenAuthModal,
  onOpenPersonalization,
  onGoogleSignIn,
  onGoogleSignOut,
  isLoggedIn = false,
  isSigningIn = false,
}) => {
  const [showTitleSelector, setShowTitleSelector] = useState(false);
  const [selectedBadge, setSelectedBadge] = useState<AchievementBadge | null>(null);

  const expPercent = Math.min(100, Math.round((user.xp / user.nextLevelXp) * 100));
  const unlockedCount = achievements.filter((a) => a.isUnlocked).length;

  return (
    <div
      className="min-h-screen bg-[#FDFCF8] text-[#2D2926] pt-[calc(4.5rem+env(safe-area-inset-top,0px))] pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))] px-4 max-w-lg mx-auto flex flex-col gap-5"
      id="profile-container"
    >
      {/* ========================================================= */}
      {/* SECTION 1: IDENTITY & PLAYER PROGRESS                     */}
      {/* ========================================================= */}
      <section
        className="bg-white rounded-3xl p-6 shadow-[0_8px_30px_rgba(45,41,38,0.06)] border border-[#2D2926]/5 relative overflow-hidden"
        id="profile-identity-section"
      >
        {/* Ambient background glow */}
        <div className="absolute -right-12 -top-12 w-44 h-44 bg-[#FF6B35]/15 rounded-full blur-3xl pointer-events-none" />

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
            <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-white shadow-lg ring-2 ring-[#FF6B35]/30">
              <img
                src={user.avatarUrl}
                alt={user.name}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-[#FF6B35] text-white font-heading text-xs font-bold px-3 py-0.5 rounded-full border-2 border-white shadow-md whitespace-nowrap">
              Lv. {user.level}
            </div>
          </div>

          {/* User Name & Handle */}
          <h2 className="font-heading text-2xl font-black text-[#2D2926] mt-1">
            {user.displayName || user.name}
          </h2>

          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap justify-center">
            {user.username && (
              <span className="text-xs font-mono font-medium text-neutral-500 bg-[#F5F3ED] px-2 py-0.5 rounded-md">
                @{user.username}
              </span>
            )}
            <span className={`text-[10px] font-heading font-bold px-2 py-0.5 rounded-full ${
              user.isGuest
                ? 'bg-amber-100 text-amber-800'
                : user.authProvider === 'google'
                ? 'bg-blue-100 text-blue-800'
                : 'bg-emerald-100 text-emerald-800'
            }`}>
              {user.isGuest ? '🎭 Khách Ẩm Thực' : user.authProvider === 'google' ? 'Google' : 'Thành viên'}
            </span>
          </div>

          {/* Guest upgrade prompt */}
          {user.isGuest && (
            <button
              type="button"
              onClick={onOpenAuthModal}
              className="mt-2.5 px-3 py-1 bg-[#FF6B35]/10 hover:bg-[#FF6B35]/20 text-[#FF6B35] text-xs font-heading font-bold rounded-full border border-[#FF6B35]/30 flex items-center gap-1 active:scale-95 transition-all"
            >
              <span className="material-symbols-outlined text-[14px]">upgrade</span>
              <span>Nâng cấp lên tài khoản chính thức</span>
            </button>
          )}

          {/* Title tag with switcher modal */}
          <button
            type="button"
            onClick={() => setShowTitleSelector(!showTitleSelector)}
            className="inline-flex items-center gap-1.5 bg-[#2EC4B6]/15 text-[#006A62] px-3.5 py-1 rounded-full text-xs font-heading font-bold mt-2 hover:bg-[#2EC4B6]/25 active:scale-95 transition-all"
            title="Nhấn để đổi danh hiệu"
          >
            <span>{user.activeTitle}</span>
            <span className="material-symbols-outlined text-[14px]">expand_more</span>
          </button>

          {/* Title Selector Dropdown */}
          {showTitleSelector && (
            <div className="mt-3 p-2.5 bg-[#F4F4F0] rounded-2xl border border-[#2D2926]/10 flex flex-col gap-1 w-full max-w-xs animate-fade-in text-left">
              <span className="text-[11px] font-heading font-bold text-[#594139] px-2 py-1">
                Chọn danh hiệu hiển thị:
              </span>
              {user.availableTitles.map((title) => (
                <button
                  key={title}
                  type="button"
                  onClick={() => {
                    onUpdateTitle(title);
                    setShowTitleSelector(false);
                  }}
                  className={`px-3 py-2 rounded-xl text-xs font-heading font-semibold text-left transition-all ${
                    user.activeTitle === title
                      ? 'bg-[#FF6B35] text-white font-bold shadow-sm'
                      : 'hover:bg-white text-[#2D2926]'
                  }`}
                >
                  {title}
                </button>
              ))}
            </div>
          )}

          {/* EXP Progress Bar */}
          <div className="w-full space-y-1.5 mt-4 max-w-xs">
            <div className="flex justify-between text-xs font-heading text-[#594139]">
              <span className="font-bold">Điểm Kinh Nghiệm (XP)</span>
              <span className="font-bold text-[#FF6B35]">
                {user.xp} <span className="text-[#594139]/70 font-normal">/ {user.nextLevelXp}</span>
              </span>
            </div>
            <div className="h-2.5 w-full bg-[#E9E8E4] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#FF6B35] rounded-full transition-all duration-700"
                style={{ width: `${expPercent}%` }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================= */}
      {/* SECTION 1.5: PERSONALIZATION PREFERENCES & GU ẨM THỰC      */}
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
      {/* SECTION 2: EXPLORATION STATS                              */}
      {/* ========================================================= */}
      <section className="grid grid-cols-3 gap-2.5" id="profile-stats-grid">
        {/* Stat 1: Places Discovered */}
        <div className="bg-white rounded-2xl p-3.5 shadow-[0_4px_16px_rgba(45,41,38,0.04)] border border-[#2D2926]/5 flex flex-col items-center justify-center text-center">
          <span className="text-2xl mb-1">🍽️</span>
          <span className="font-heading text-xl font-black text-[#FF6B35] leading-none">
            {user.stats.placesDiscovered}
          </span>
          <span className="text-[11px] font-heading font-medium text-[#594139] mt-1">
            Quán đã ăn
          </span>
        </div>

        {/* Stat 2: Passports Completed */}
        <div className="bg-white rounded-2xl p-3.5 shadow-[0_4px_16px_rgba(45,41,38,0.04)] border border-[#2D2926]/5 flex flex-col items-center justify-center text-center">
          <span className="text-2xl mb-1">📓</span>
          <span className="font-heading text-xl font-black text-[#00A7CB] leading-none">
            {user.stats.passportsCompleted}
          </span>
          <span className="text-[11px] font-heading font-medium text-[#594139] mt-1">
            Hành trình xong
          </span>
        </div>

        {/* Stat 3: First Bites Count */}
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
      {/* SECTION 3: ACTIVE PASSPORT PREVIEW                        */}
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
      {/* SECTION 4: ACHIEVEMENTS COLLECTION                        */}
      {/* ========================================================= */}
      <section className="bg-white rounded-3xl p-5 shadow-[0_4px_20px_rgba(45,41,38,0.06)] border border-[#2D2926]/5">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-heading text-sm font-bold text-[#2D2926] flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[#FF6B35] text-[18px]">
              workspace_premium
            </span>
            Bộ Sưu Tập Huy Hiệu
          </h3>
          <span className="text-xs font-heading font-bold text-[#FF6B35] bg-[#FF6B35]/10 px-2.5 py-0.5 rounded-full">
            {unlockedCount} / {achievements.length} Đã Mở
          </span>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {achievements.map((badge) => (
            <div
              key={badge.id}
              onClick={() => setSelectedBadge(badge)}
              className="flex flex-col items-center text-center cursor-pointer group active:scale-95 transition-all"
            >
              <div
                className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-1.5 shadow-sm transition-transform group-hover:scale-105 ${
                  badge.isUnlocked
                    ? badge.id === 'badge_first_scout'
                      ? 'bg-[#F4F4F0] border-2 border-[#2EC4B6]/40'
                      : badge.id === 'badge_smart_biter' || badge.id === 'badge_bite_guardian'
                      ? 'bg-[#2EC4B6]/15 border border-[#2EC4B6]/30'
                      : 'bg-[#F4F4F0] border border-[#2D2926]/5'
                    : 'bg-[#E9E8E4] grayscale opacity-40'
                }`}
              >
                <span className="text-2xl">{badge.emoji}</span>
              </div>
              <span className="font-heading text-[11px] font-bold text-[#2D2926] line-clamp-1">
                {badge.title}
              </span>
              <span className="text-[9px] text-[#594139]/70 font-medium">
                {badge.isUnlocked ? '✓ Đã đạt' : 'Khóa'}
              </span>
            </div>
          ))}
        </div>

        {/* Selected Badge Detail Modal */}
        {selectedBadge && (
          <div className="mt-4 p-3.5 bg-[#FAF9F5] rounded-2xl text-xs flex flex-col gap-1.5 border border-[#2D2926]/10 animate-fade-in">
            <div className="flex justify-between items-center">
              <span className="font-heading font-bold text-[#2D2926] flex items-center gap-1.5 text-sm">
                <span>{selectedBadge.emoji}</span> {selectedBadge.title}
              </span>
              <button
                type="button"
                onClick={() => setSelectedBadge(null)}
                className="w-6 h-6 rounded-full bg-[#EAE9E4] text-[#2D2926] flex items-center justify-center text-xs font-bold"
              >
                ✕
              </button>
            </div>
            <p className="text-[#594139] leading-relaxed">{selectedBadge.description}</p>
            {selectedBadge.isUnlocked ? (
              <span className="text-[10px] text-[#006A62] bg-[#2EC4B6]/15 px-2 py-0.5 rounded-full font-bold self-start mt-0.5">
                ✓ Đã mở khóa ngày {selectedBadge.unlockedAt}
              </span>
            ) : (
              <span className="text-[10px] text-[#FF6B35] font-bold self-start mt-0.5">
                Chưa mở khóa
              </span>
            )}
          </div>
        )}
      </section>

      {/* ========================================================= */}
      {/* SECTION 5: COMMUNITY CONTRIBUTION                        */}
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
      {/* SECTION 6: QUICK ACTIONS & PREFERENCES                    */}
      {/* ========================================================= */}
      <section className="bg-white rounded-3xl p-4 shadow-[0_4px_20px_rgba(45,41,38,0.06)] border border-[#2D2926]/5 flex flex-col divide-y divide-[#2D2926]/5">
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
