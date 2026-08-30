import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { User, LeaderboardUser, LeaderboardTier } from '../types';
import { SAMPLE_FOODIE_PROFILES, INITIAL_USER, EMPTY_USER } from '../data/seedData';
import { useLanguage } from '../context/LanguageContext';

interface LeaderboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  isLoggedIn: boolean;
  onOpenAuthModal: () => void;
  onSwitchUser?: (newUser: User) => void;
  onNavigateToPassport?: () => void;
}

type TabFilter = 'season1' | 'district' | 'weekly';

export const LeaderboardModal: React.FC<LeaderboardModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  isLoggedIn,
  onOpenAuthModal,
  onSwitchUser,
  onNavigateToPassport,
}) => {
  const { isVi } = useLanguage();
  const [filter, setFilter] = useState<TabFilter>('season1');
  const [showAccountSwitcher, setShowAccountSwitcher] = useState(false);
  const [customIdInput, setCustomIdInput] = useState('');
  const [customNameInput, setCustomNameInput] = useState('');

  // Calculate dynamic leaderboard list merging seeded hunters + current user
  const leaderboardList: LeaderboardUser[] = useMemo(() => {
    // Collect all candidates
    const rawUsers: Array<{
      id: string;
      username: string;
      name: string;
      avatarUrl: string;
      activeTitle: string;
      xp: number;
      level: number;
      verifiedBitesCount: number;
      firstBitesCount: number;
      badgesCount: number;
      districtName: string;
      isCurrentUser: boolean;
    }> = [];

    // Current user
    const currentUsername = currentUser.username || (currentUser.email ? currentUser.email.split('@')[0] : currentUser.id);
    const currentUserDiscovered = currentUser.stats?.placesDiscovered || 0;
    const currentUserFirstBites = currentUser.stats?.firstBitesCount || 0;
    const currentUserBadges = (currentUser.availableTitles?.length || 1) + (currentUser.knowledgeProgress?.smartBiter?.completed ? 1 : 0);

    rawUsers.push({
      id: currentUser.id,
      username: currentUsername,
      name: currentUser.displayName || currentUser.name || (isVi ? 'Thợ Săn Ẩm Thực' : 'Food Hunter'),
      avatarUrl: currentUser.avatarUrl,
      activeTitle: currentUser.activeTitle || (isVi ? '🥢 Tân Binh Vị Giác' : '🥢 Taste Rookie'),
      xp: currentUser.xp,
      level: currentUser.level || 1,
      verifiedBitesCount: currentUserDiscovered,
      firstBitesCount: currentUserFirstBites,
      badgesCount: currentUserBadges,
      districtName: isVi ? 'Cầu Giấy' : 'Cau Giay',
      isCurrentUser: true,
    });

    // Sample foodies (filter out if same ID as current user)
    SAMPLE_FOODIE_PROFILES.forEach((f) => {
      if (f.id !== currentUser.id && f.username !== currentUser.username) {
        rawUsers.push({
          id: f.id,
          username: f.username || f.id,
          name: f.name,
          avatarUrl: f.avatarUrl,
          activeTitle: f.activeTitle,
          xp: f.xp,
          level: f.level,
          verifiedBitesCount: f.stats.placesDiscovered,
          firstBitesCount: f.stats.firstBitesCount,
          badgesCount: f.availableTitles.length + 2,
          districtName: f.districtProgress[0]?.districtName || (isVi ? 'Hà Nội' : 'Hanoi'),
          isCurrentUser: false,
        });
      }
    });

    // Sort descending by XP
    rawUsers.sort((a, b) => b.xp - a.xp);

    // Assign rank and tiers
    return rawUsers.map((u, index) => {
      const rank = index + 1;
      let tier: LeaderboardTier = 'bronze';
      if (rank === 1) tier = 'diamond';
      else if (rank <= 3) tier = 'platinum';
      else if (rank <= 5) tier = 'gold';
      else if (rank <= 10) tier = 'silver';

      return {
        rank,
        userId: u.id,
        username: u.username,
        displayName: u.name,
        avatarUrl: u.avatarUrl,
        activeTitle: u.activeTitle,
        xp: u.xp,
        level: u.level,
        verifiedBitesCount: u.verifiedBitesCount,
        firstBitesCount: u.firstBitesCount,
        badgesCount: u.badgesCount,
        districtName: u.districtName,
        isCurrentUser: u.isCurrentUser,
        tier,
        trend: rank <= 3 ? 'up' : 'same',
      };
    });
  }, [currentUser, isVi]);

  const currentUserRankInfo = leaderboardList.find((u) => u.isCurrentUser) || {
    rank: 4,
    tier: 'gold' as LeaderboardTier,
    xp: currentUser.xp,
  };

  const topThree = leaderboardList.slice(0, 3);
  const remainingList = leaderboardList.slice(3);

  // Handle Quick User Switching
  const handleSelectQuickAccount = (profile: User) => {
    if (onSwitchUser) {
      onSwitchUser(profile);
      setShowAccountSwitcher(false);
    }
  };

  const handleCreateCustomAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customIdInput.trim()) return;

    const cleanUsername = customIdInput.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
    const cleanDisplayName = customNameInput.trim() || cleanUsername;

    const newCustomUser: User = {
      id: `user_${cleanUsername}`,
      uid: `user_${cleanUsername}`,
      username: cleanUsername,
      name: cleanDisplayName,
      displayName: cleanDisplayName,
      avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${cleanUsername}`,
      activeTitle: isVi ? '🥢 Tân Binh Vị Giác' : '🥢 Taste Rookie',
      availableTitles: isVi ? ['🥢 Tân Binh Vị Giác', '🗺️ Kẻ Lang Thang'] : ['🥢 Taste Rookie', '🗺️ Wanderer'],
      level: 3,
      xp: 250,
      nextLevelXp: 500,
      stats: {
        placesDiscovered: 5,
        passportsCompleted: 0,
        firstBitesCount: 0,
      },
      districtProgress: [
        { districtId: 'cau_giay', districtName: isVi ? 'Cầu Giấy' : 'Cau Giay', completed: 1, total: 6 },
      ],
      knowledgeProgress: {
        smartBiter: { completed: false, bestScore: 0 },
        biteGuardian: { completed: false, bestScore: 0 },
      },
    };

    if (onSwitchUser) {
      onSwitchUser(newCustomUser);
      setShowAccountSwitcher(false);
      setCustomIdInput('');
      setCustomNameInput('');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/70 backdrop-blur-sm animate-fade-in select-none">
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 15 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="bg-[#1C1A18] text-[#FDFCF8] w-full max-w-lg rounded-2xl border border-[#3A3530] shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
      >
        {/* Header */}
        <div className="relative px-5 py-4 bg-gradient-to-b from-[#2A2420] to-[#1C1A18] border-b border-[#3A3530] flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-orange-950/40 text-xl">
              🏆
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <h2 className="text-base font-bold tracking-tight text-white">{isVi ? 'Đua Top Thực Thần' : 'Gourmet Leaderboard'}</h2>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-orange-500/20 text-orange-400 border border-orange-500/30">
                  {isVi ? 'Mùa 1' : 'Season 1'}
                </span>
              </div>
              <p className="text-xs text-neutral-400">{isVi ? 'Bảng xếp hạng ẩm thực thời gian thực' : 'Real-time foodie leaderboard & ranking'}</p>
            </div>
          </div>

          <div className="flex items-center space-x-1.5">
            <button
              onClick={() => setShowAccountSwitcher(!showAccountSwitcher)}
              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-[#2D2824] hover:bg-[#3D3732] text-amber-300 border border-amber-500/20 transition-all flex items-center space-x-1"
              title={isVi ? 'Chuyển đổi tài khoản đua top' : 'Switch test hunter account'}
            >
              <span>👤 {isVi ? 'Đổi ID' : 'Switch ID'}</span>
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-[#2D2824] hover:bg-[#3D3732] text-neutral-400 hover:text-white flex items-center justify-center transition-all"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Account Switcher Drawer / Popup */}
        <AnimatePresence>
          {showAccountSwitcher && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="bg-[#24201D] border-b border-amber-500/30 px-4 py-3 overflow-hidden text-xs"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-amber-400 uppercase tracking-wider text-[11px]">
                  ⚡ {isVi ? 'Chọn tài khoản đua top thử nghiệm' : 'Select test hunter profile'}
                </span>
                <button
                  onClick={() => setShowAccountSwitcher(false)}
                  className="text-neutral-400 hover:text-white text-[11px]"
                >
                  {isVi ? 'Đóng' : 'Close'}
                </button>
              </div>

              {/* Preset accounts */}
              <div className="grid grid-cols-2 gap-2 mb-3">
                <button
                  onClick={() => handleSelectQuickAccount(INITIAL_USER)}
                  className={`p-2 rounded-lg border text-left flex items-center space-x-2 transition-all ${
                    currentUser.id === INITIAL_USER.id
                      ? 'bg-amber-500/20 border-amber-500/60 text-white'
                      : 'bg-[#1C1A18] border-[#3A3530] text-neutral-300 hover:border-amber-500/40'
                  }`}
                >
                  <img src={INITIAL_USER.avatarUrl} alt="Tuấn Anh" className="w-7 h-7 rounded-full object-cover" />
                  <div className="truncate">
                    <p className="font-bold text-[11px] truncate">{INITIAL_USER.name} (Rank 4)</p>
                    <p className="text-[10px] text-neutral-400">@{INITIAL_USER.username} • {INITIAL_USER.xp} XP</p>
                  </div>
                </button>

                {SAMPLE_FOODIE_PROFILES.map((profile) => (
                  <button
                    key={profile.id}
                    onClick={() => handleSelectQuickAccount(profile)}
                    className={`p-2 rounded-lg border text-left flex items-center space-x-2 transition-all ${
                      currentUser.id === profile.id
                        ? 'bg-amber-500/20 border-amber-500/60 text-white'
                        : 'bg-[#1C1A18] border-[#3A3530] text-neutral-300 hover:border-amber-500/40'
                    }`}
                  >
                    <img src={profile.avatarUrl} alt={profile.name} className="w-7 h-7 rounded-full object-cover" />
                    <div className="truncate">
                      <p className="font-bold text-[11px] truncate">{profile.name}</p>
                      <p className="text-[10px] text-neutral-400">@{profile.username} • {profile.xp} XP</p>
                    </div>
                  </button>
                ))}
              </div>

              {/* Create new custom ID */}
              <form onSubmit={handleCreateCustomAccount} className="pt-2 border-t border-[#3A3530]/60 flex items-center space-x-1.5">
                <input
                  type="text"
                  placeholder={isVi ? 'Nhập ID mới (vd: my_foodie_id)...' : 'Enter new ID (e.g. my_foodie_id)...'}
                  value={customIdInput}
                  onChange={(e) => setCustomIdInput(e.target.value)}
                  className="flex-1 bg-[#161412] border border-[#3A3530] rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500"
                />
                <button
                  type="submit"
                  disabled={!customIdInput.trim()}
                  className="px-3 py-1.5 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white font-bold rounded-lg transition-all"
                >
                  {isVi ? 'Tạo ID' : 'Create'}
                </button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Season Status & Time Filter Tabs */}
        <div className="px-5 pt-3 pb-2 flex items-center justify-between border-b border-[#2C2723]">
          <div className="flex space-x-1 bg-[#28231F] p-1 rounded-xl">
            <button
              onClick={() => setFilter('season1')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                filter === 'season1'
                  ? 'bg-orange-500 text-white shadow-sm'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              {isVi ? 'Mùa 1 (Toàn Quốc)' : 'Season 1 (National)'}
            </button>
            <button
              onClick={() => setFilter('district')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                filter === 'district'
                  ? 'bg-orange-500 text-white shadow-sm'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              {isVi ? 'Cầu Giấy' : 'Cau Giay'}
            </button>
            <button
              onClick={() => setFilter('weekly')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                filter === 'weekly'
                  ? 'bg-orange-500 text-white shadow-sm'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              {isVi ? 'Tuần Này' : 'This Week'}
            </button>
          </div>

          <div className="flex items-center space-x-1 text-xs text-amber-400 font-medium">
            <span>⏳ {isVi ? 'Còn 14 ngày' : '14 days left'}</span>
          </div>
        </div>

        {/* Scrollable Leaderboard Area */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Top 3 Podium (1st, 2nd, 3rd) */}
          <div className="grid grid-cols-3 gap-2.5 pt-4 pb-2 items-end">
            {/* Rank 2 (Silver) */}
            {topThree[1] && (
              <div className="flex flex-col items-center">
                <div className="relative mb-1.5">
                  <img
                    src={topThree[1].avatarUrl}
                    alt={topThree[1].displayName}
                    className="w-14 h-14 rounded-full object-cover border-2 border-slate-300 shadow-md shadow-slate-900/50"
                  />
                  <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-slate-300 text-slate-950 font-black text-xs flex items-center justify-center shadow">
                    2
                  </span>
                </div>
                <p className="font-bold text-xs text-white text-center truncate max-w-full">
                  {topThree[1].displayName}
                </p>
                <p className="text-[10px] text-neutral-400 truncate max-w-full">
                  @{topThree[1].username}
                </p>
                <div className="mt-1.5 px-2 py-0.5 rounded-full bg-slate-400/20 text-slate-300 font-bold text-[11px] border border-slate-400/30">
                  {topThree[1].xp} XP
                </div>
                <div className="h-16 w-full bg-gradient-to-t from-slate-700/40 to-slate-600/10 rounded-t-xl mt-2 border-t-2 border-slate-400/50 flex items-center justify-center text-xs font-bold text-slate-300">
                  🥈 {isVi ? 'Top 2' : '2nd Place'}
                </div>
              </div>
            )}

            {/* Rank 1 (Gold / Diamond) */}
            {topThree[0] && (
              <div className="flex flex-col items-center -mt-3">
                <div className="relative mb-1.5">
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-xl animate-bounce">
                    👑
                  </div>
                  <img
                    src={topThree[0].avatarUrl}
                    alt={topThree[0].displayName}
                    className="w-18 h-18 rounded-full object-cover border-3 border-amber-400 shadow-xl shadow-amber-950/60 ring-4 ring-amber-500/20"
                  />
                  <span className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-gradient-to-r from-amber-400 to-yellow-500 text-amber-950 font-black text-sm flex items-center justify-center shadow-lg">
                    1
                  </span>
                </div>
                <p className="font-bold text-sm text-amber-200 text-center truncate max-w-full">
                  {topThree[0].displayName}
                </p>
                <p className="text-[10px] text-amber-400/80 truncate max-w-full">
                  @{topThree[0].username}
                </p>
                <div className="mt-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/30 text-amber-300 font-extrabold text-xs border border-amber-400/40 shadow-sm">
                  {topThree[0].xp} XP
                </div>
                <div className="h-24 w-full bg-gradient-to-t from-amber-600/40 to-amber-500/10 rounded-t-xl mt-2 border-t-2 border-amber-400/80 flex items-center justify-center text-xs font-extrabold text-amber-300">
                  🥇 {isVi ? 'Quán Quân' : 'Champion'}
                </div>
              </div>
            )}

            {/* Rank 3 (Bronze) */}
            {topThree[2] && (
              <div className="flex flex-col items-center">
                <div className="relative mb-1.5">
                  <img
                    src={topThree[2].avatarUrl}
                    alt={topThree[2].displayName}
                    className="w-14 h-14 rounded-full object-cover border-2 border-amber-700 shadow-md shadow-amber-950/50"
                  />
                  <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-amber-700 text-amber-100 font-black text-xs flex items-center justify-center shadow">
                    3
                  </span>
                </div>
                <p className="font-bold text-xs text-white text-center truncate max-w-full">
                  {topThree[2].displayName}
                </p>
                <p className="text-[10px] text-neutral-400 truncate max-w-full">
                  @{topThree[2].username}
                </p>
                <div className="mt-1.5 px-2 py-0.5 rounded-full bg-amber-800/30 text-amber-400 font-bold text-[11px] border border-amber-700/40">
                  {topThree[2].xp} XP
                </div>
                <div className="h-12 w-full bg-gradient-to-t from-amber-900/40 to-amber-800/10 rounded-t-xl mt-2 border-t-2 border-amber-700/50 flex items-center justify-center text-xs font-bold text-amber-400">
                  🥉 {isVi ? 'Top 3' : '3rd Place'}
                </div>
              </div>
            )}
          </div>

          {/* Ranks 4+ List */}
          <div className="space-y-2 pt-2">
            <p className="text-xs font-bold uppercase tracking-wider text-neutral-400 px-1">
              {isVi ? 'Top Thợ Săn Đang Đua Hạng' : 'Hunters In The Race'}
            </p>

            {remainingList.map((hunter) => (
              <div
                key={hunter.userId}
                className={`p-3 rounded-xl border flex items-center justify-between transition-all ${
                  hunter.isCurrentUser
                    ? 'bg-gradient-to-r from-orange-950/50 via-[#2A221C] to-orange-950/30 border-orange-500/60 ring-1 ring-orange-500/30'
                    : 'bg-[#24201D] border-[#36302B] hover:border-neutral-500/40'
                }`}
              >
                <div className="flex items-center space-x-3 min-w-0">
                  <div className="w-7 text-center font-extrabold text-sm text-neutral-400">
                    #{hunter.rank}
                  </div>

                  <div className="relative">
                    <img
                      src={hunter.avatarUrl}
                      alt={hunter.displayName}
                      className="w-10 h-10 rounded-full object-cover border border-[#4A423A]"
                    />
                    {hunter.isCurrentUser && (
                      <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-[#1C1A18]" />
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center space-x-1.5">
                      <p className="font-bold text-xs text-white truncate">{hunter.displayName}</p>
                      {hunter.isCurrentUser && (
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-orange-500 text-white">
                          {isVi ? 'BẠN' : 'YOU'}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center space-x-2 text-[10px] text-neutral-400">
                      <span>@{hunter.username}</span>
                      <span>•</span>
                      <span className="text-amber-400 truncate">{hunter.activeTitle}</span>
                    </div>
                  </div>
                </div>

                <div className="text-right pl-2 shrink-0">
                  <p className="text-xs font-black text-amber-300">{hunter.xp} XP</p>
                  <p className="text-[10px] text-neutral-400">
                    {hunter.verifiedBitesCount} check-in
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Current User Live Sticky Bar */}
        <div className="p-4 bg-gradient-to-t from-[#141210] to-[#1E1B18] border-t border-[#3A3530] flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500/20 border border-orange-500/40 flex flex-col items-center justify-center text-orange-400">
              <span className="text-[9px] font-black uppercase leading-none">{isVi ? 'Hạng' : 'Rank'}</span>
              <span className="text-sm font-extrabold leading-tight">#{currentUserRankInfo.rank}</span>
            </div>

            <div>
              <div className="flex items-center space-x-1.5">
                <span className="text-xs font-bold text-white">
                  {currentUser.displayName || currentUser.name}
                </span>
                <span className="text-[10px] text-neutral-400">
                  (@{currentUser.username || (currentUser.email ? currentUser.email.split('@')[0] : currentUser.id)})
                </span>
              </div>
              <p className="text-[11px] text-amber-400 font-medium">
                {currentUser.xp} XP • {currentUser.activeTitle}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {!isLoggedIn ? (
              <button
                onClick={() => {
                  onClose();
                  onOpenAuthModal();
                }}
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-400 hover:to-amber-500 text-white shadow-md transition-all"
              >
                {isVi ? 'Đăng nhập đua top' : 'Login to compete'}
              </button>
            ) : (
              <button
                onClick={() => {
                  onClose();
                  if (onNavigateToPassport) onNavigateToPassport();
                }}
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#2C2621] hover:bg-[#3C342D] border border-amber-500/30 text-amber-300 transition-all"
              >
                {isVi ? 'Nhận thêm XP 🎯' : 'Earn more XP 🎯'}
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};
