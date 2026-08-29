import React, { useState } from 'react';
import { DistrictPassport, User } from '../types';
import { KnowledgeTrackId, KNOWLEDGE_TRACKS, META_KNOWLEDGE_TITLE } from '../data/knowledgeQuestions';

interface PassportViewProps {
  passport: DistrictPassport;
  user?: User;
  onNavigateToExplore: () => void;
  onNavigateToCamera: () => void;
  onOpenKnowledgeQuest?: (trackId: KnowledgeTrackId) => void;
}

const DISTRICT_PASSPORTS: Record<string, DistrictPassport> = {
  cau_giay: {
    id: 'cau_giay',
    districtName: 'Cầu Giấy',
    subtitle: 'Khám phá thiên đường ẩm thực sinh viên & ngõ phố 😋',
    coverImage: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=800&auto=format&fit=crop&q=80',
    levelTitle: 'Thực thần Cầu Giấy',
    currentLevel: 12,
    xp: 780,
    maxXp: 1000,
    challenges: [
      {
        id: 'cg_1',
        title: 'Một quán bún cá / bún đậu',
        icon: '🍜',
        category: 'noodles',
        type: 'category',
        isCompleted: true,
        completedAt: 'Hoàn thành lúc 08:30 sáng nay',
        rewardXp: 50,
      },
      {
        id: 'cg_2',
        title: 'Cơm tấm / Cơm niêu ngõ',
        icon: '🍛',
        category: 'rice',
        type: 'category',
        isCompleted: true,
        completedAt: 'Hoàn thành ngày 12/05',
        rewardXp: 50,
      },
      {
        id: 'cg_3',
        title: 'Quán cà phê ngõ Tô Hiệu',
        icon: '☕',
        category: 'coffee',
        type: 'category',
        isCompleted: true,
        completedAt: 'Hoàn thành ngày 10/05',
        rewardXp: 50,
      },
      {
        id: 'cg_4',
        title: 'Chè bưởi / Tào phớ Xuân Thủy',
        icon: '🍮',
        category: 'dessert',
        type: 'category',
        isCompleted: true,
        completedAt: 'Hoàn thành ngày 08/05',
        rewardXp: 50,
      },
      {
        id: 'cg_5',
        title: 'Quán ăn sâu ngõ Trần Quốc Hoàn',
        icon: '🛵',
        type: 'alley',
        isCompleted: false,
        rewardXp: 50,
      },
      {
        id: 'cg_6',
        title: 'Phát hiện một quán mới ở Cầu Giấy',
        icon: '✨',
        type: 'new_spot',
        isCompleted: false,
        rewardXp: 100,
      },
    ],
  },
  dong_da: {
    id: 'dong_da',
    districtName: 'Đống Đa',
    subtitle: 'Thiên đường ăn vặt Chùa Láng & phố Ốc Đặng Văn Ngữ 🦪',
    coverImage: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&auto=format&fit=crop&q=80',
    levelTitle: 'Chiến thần Chùa Láng',
    currentLevel: 8,
    xp: 520,
    maxXp: 800,
    challenges: [
      {
        id: 'dd_1',
        title: 'Ốc luộc / Ốc hương Đặng Văn Ngữ',
        icon: '🦪',
        category: 'street_food',
        type: 'category',
        isCompleted: true,
        completedAt: 'Hoàn thành ngày 14/05',
        rewardXp: 50,
      },
      {
        id: 'dd_2',
        title: 'Bánh mì nướng muối ớt Chùa Láng',
        icon: '🥖',
        category: 'street_food',
        type: 'category',
        isCompleted: true,
        completedAt: 'Hoàn thành ngày 11/05',
        rewardXp: 50,
      },
      {
        id: 'dd_3',
        title: 'Cà phê ban công Hồ Đắc Di',
        icon: '☕',
        category: 'coffee',
        type: 'category',
        isCompleted: true,
        completedAt: 'Hoàn thành ngày 09/05',
        rewardXp: 50,
      },
      {
        id: 'dd_4',
        title: 'Nem chua rán ngõ Tôn Thất Tùng',
        icon: '🍢',
        category: 'street_food',
        type: 'category',
        isCompleted: true,
        completedAt: 'Hoàn thành ngày 04/05',
        rewardXp: 50,
      },
      {
        id: 'dd_5',
        title: 'Mì vằn thắn Khâm Thiên',
        icon: '🍜',
        category: 'noodles',
        type: 'category',
        isCompleted: false,
        rewardXp: 50,
      },
      {
        id: 'dd_6',
        title: 'First Bite quán mới Đống Đa',
        icon: '✨',
        type: 'new_spot',
        isCompleted: false,
        rewardXp: 100,
      },
    ],
  },
  ba_dinh: {
    id: 'ba_dinh',
    districtName: 'Ba Đình',
    subtitle: 'Nét thanh lịch Trúc Bạch, Phở cuốn & Quán xưa Quán Thánh ✨',
    coverImage: 'https://images.unsplash.com/photo-1541544741938-0af808871cc0?w=800&auto=format&fit=crop&q=80',
    levelTitle: 'Người sành Ba Đình',
    currentLevel: 5,
    xp: 290,
    maxXp: 600,
    challenges: [
      {
        id: 'bd_1',
        title: 'Phở cuốn / Phở chiên phồng Ngũ Xã',
        icon: '🌯',
        category: 'noodles',
        type: 'category',
        isCompleted: true,
        completedAt: 'Hoàn thành ngày 15/05',
        rewardXp: 50,
      },
      {
        id: 'bd_2',
        title: 'Cà phê view Trúc Bạch ngắm hoàng hôn',
        icon: '☕',
        category: 'coffee',
        type: 'category',
        isCompleted: true,
        completedAt: 'Hoàn thành ngày 07/05',
        rewardXp: 50,
      },
      {
        id: 'bd_3',
        title: 'Cháo sườn sụn Đội Cấn',
        icon: '🥣',
        category: 'street_food',
        type: 'category',
        isCompleted: false,
        rewardXp: 50,
      },
      {
        id: 'bd_4',
        title: 'Bún chả gia truyền Kim Mã',
        icon: '🥓',
        category: 'noodles',
        type: 'category',
        isCompleted: false,
        rewardXp: 50,
      },
      {
        id: 'bd_5',
        title: 'Quán trà cổ điển ngõ Vạn Bảo',
        icon: '🍵',
        category: 'coffee',
        type: 'alley',
        isCompleted: false,
        rewardXp: 50,
      },
      {
        id: 'bd_6',
        title: 'First Bite quán mới Ba Đình',
        icon: '✨',
        type: 'new_spot',
        isCompleted: false,
        rewardXp: 100,
      },
    ],
  },
  hoan_kiem: {
    id: 'hoan_kiem',
    districtName: 'Hoàn Kiếm',
    subtitle: 'Tinh hoa 36 Phố Phường cổ & Hương vị Phở Bát Đàn trứ danh 🏮',
    coverImage: 'https://images.unsplash.com/photo-1582878826629-29b7ad1cdc43?w=800&auto=format&fit=crop&q=80',
    levelTitle: 'Thổ Địa Phố Cổ',
    currentLevel: 10,
    xp: 680,
    maxXp: 900,
    challenges: [
      {
        id: 'hk_1',
        title: 'Phở bò gia truyền Bát Đàn',
        icon: '🍜',
        category: 'noodles',
        type: 'category',
        isCompleted: true,
        completedAt: 'Hoàn thành ngày 13/05',
        rewardXp: 50,
      },
      {
        id: 'hk_2',
        title: 'Cà phê trứng Giảng phố Nguyễn Hữu Huân',
        icon: '☕',
        category: 'coffee',
        type: 'category',
        isCompleted: true,
        completedAt: 'Hoàn thành ngày 10/05',
        rewardXp: 50,
      },
      {
        id: 'hk_3',
        title: 'Bún đậu mắm tôm ngõ Tràng Tiền',
        icon: '🥢',
        category: 'noodles',
        type: 'alley',
        isCompleted: true,
        completedAt: 'Hoàn thành ngày 05/05',
        rewardXp: 50,
      },
      {
        id: 'hk_4',
        title: 'Kem Tràng Tiền dạo Hồ Gươm',
        icon: '🍦',
        category: 'dessert',
        type: 'category',
        isCompleted: true,
        completedAt: 'Hoàn thành ngày 01/05',
        rewardXp: 50,
      },
      {
        id: 'hk_5',
        title: 'Nộm bò khô phố Đinh Tiên Hoàng',
        icon: '🥗',
        category: 'street_food',
        type: 'category',
        isCompleted: false,
        rewardXp: 50,
      },
      {
        id: 'hk_6',
        title: 'First Bite quán mới Hoàn Kiếm',
        icon: '✨',
        type: 'new_spot',
        isCompleted: false,
        rewardXp: 100,
      },
    ],
  },
  tay_ho: {
    id: 'tay_ho',
    districtName: 'Tây Hồ',
    subtitle: 'Gió lộng Hồ Tây, Bánh tôm Thanh Niên & Cà phê hoàng hôn 🌅',
    coverImage: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=800&auto=format&fit=crop&q=80',
    levelTitle: 'Tín đồ Hồ Tây',
    currentLevel: 7,
    xp: 410,
    maxXp: 700,
    challenges: [
      {
        id: 'th_1',
        title: 'Bánh tôm đường Thanh Niên',
        icon: '🍤',
        category: 'street_food',
        type: 'category',
        isCompleted: true,
        completedAt: 'Hoàn thành ngày 12/05',
        rewardXp: 50,
      },
      {
        id: 'th_2',
        title: 'Cà phê ngắm hoàng hôn Quảng Bá',
        icon: '☕',
        category: 'coffee',
        type: 'category',
        isCompleted: true,
        completedAt: 'Hoàn thành ngày 08/05',
        rewardXp: 50,
      },
      {
        id: 'th_3',
        title: 'Bún ốc nguội Tây Hồ',
        icon: '🍜',
        category: 'noodles',
        type: 'category',
        isCompleted: false,
        rewardXp: 50,
      },
      {
        id: 'th_4',
        title: 'Bánh rán mặn Võng Thị',
        icon: '🥟',
        category: 'street_food',
        type: 'alley',
        isCompleted: false,
        rewardXp: 50,
      },
      {
        id: 'th_5',
        title: 'Craft Beer & Pizza Âu Cơ',
        icon: '🍕',
        category: 'burger_western',
        type: 'category',
        isCompleted: false,
        rewardXp: 50,
      },
      {
        id: 'th_6',
        title: 'First Bite quán mới Tây Hồ',
        icon: '✨',
        type: 'new_spot',
        isCompleted: false,
        rewardXp: 100,
      },
    ],
  },
};

export const PassportView: React.FC<PassportViewProps> = ({
  passport: initialPassport,
  user,
  onNavigateToExplore,
  onNavigateToCamera,
  onOpenKnowledgeQuest,
}) => {
  const [selectedDistrict, setSelectedDistrict] = useState<string>('cau_giay');

  const activePassport =
    selectedDistrict === 'cau_giay' && initialPassport
      ? initialPassport
      : DISTRICT_PASSPORTS[selectedDistrict] || initialPassport;

  const completedCount = activePassport.challenges.filter((c) => c.isCompleted).length;
  const totalCount = activePassport.challenges.length;
  const progressPercent = Math.min(100, Math.round((activePassport.xp / activePassport.maxXp) * 100));

  const smartBiterProgress = user?.knowledgeProgress?.smartBiter;
  const biteGuardianProgress = user?.knowledgeProgress?.biteGuardian;
  const isBothCompleted = smartBiterProgress?.completed && biteGuardianProgress?.completed;

  const districtOptions = [
    { key: 'cau_giay', label: 'Cầu Giấy', count: `${completedCount}/${totalCount}` },
    { key: 'dong_da', label: 'Đống Đa', count: '4/6' },
    { key: 'ba_dinh', label: 'Ba Đình', count: '2/6' },
    { key: 'hoan_kiem', label: 'Hoàn Kiếm', count: '4/6' },
    { key: 'tay_ho', label: 'Tây Hồ', count: '2/6' },
  ];

  return (
    <div
      className="min-h-screen bg-[#FDFCF8] text-[#2D2926] pt-[calc(4.5rem+env(safe-area-inset-top,0px))] pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))] px-4 max-w-lg mx-auto flex flex-col gap-6"
      id="passport-container"
    >
      {/* District Switcher Tabs */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
        {districtOptions.map((opt) => (
          <button
            key={opt.key}
            type="button"
            onClick={() => setSelectedDistrict(opt.key)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-heading font-bold whitespace-nowrap transition-all cursor-pointer ${
              selectedDistrict === opt.key
                ? 'bg-[#FF6B35] text-white shadow-sm scale-102'
                : 'bg-[#F4F4F0] text-[#594139] hover:bg-[#E9E8E4]'
            }`}
          >
            {opt.label} ({opt.key === selectedDistrict ? `${completedCount}/${totalCount}` : opt.count})
          </button>
        ))}
      </div>

      {/* Passport Header Card */}
      <section className="bg-white rounded-3xl p-5 shadow-[0_8px_30px_rgba(45,41,38,0.06)] border border-[#2D2926]/5 relative overflow-hidden">
        {/* Cover illustration / Photo */}
        <div className="aspect-[16/9] w-full rounded-2xl overflow-hidden bg-[#E9E8E4] relative shadow-inner mb-4">
          <img
            src={activePassport.coverImage}
            alt={activePassport.districtName}
            className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#2D2926]/75 via-transparent to-transparent flex items-end p-3.5">
            <div className="flex items-center gap-1.5 text-white font-heading text-xs font-bold drop-shadow-sm">
              <span className="material-symbols-outlined text-[16px] text-[#FF6B35] fill">location_on</span>
              <span>{activePassport.districtName}, Hà Nội</span>
            </div>
          </div>
        </div>

        {/* Passport Tag & Title */}
        <div className="flex flex-col gap-2">
          <div className="inline-flex items-center gap-1 bg-[#2EC4B6]/15 text-[#006A62] px-3 py-1 rounded-full text-xs font-heading font-bold w-fit">
            <span>🗺️</span> Hành trình khu vực
          </div>

          <div>
            <h2 className="font-heading text-2xl font-black text-[#2D2926]">
              Hành trình {activePassport.districtName}
            </h2>
            <p className="text-xs text-[#594139] flex items-center gap-1 mt-0.5">
              <span>{activePassport.subtitle}</span>
            </p>
          </div>

          {/* Level Progression Box */}
          <div className="bg-[#F4F4F0] p-3.5 rounded-2xl flex flex-col gap-2.5 mt-2 border border-[#2D2926]/5">
            <div className="flex justify-between items-end">
              <div className="flex items-baseline gap-2">
                <span className="font-heading text-lg font-black text-[#FF6B35]">
                  Lv. {activePassport.currentLevel}
                </span>
                <span className="font-heading text-[11px] font-bold text-[#594139] uppercase tracking-wider">
                  {activePassport.levelTitle}
                </span>
              </div>
              <span className="font-heading text-xs font-bold text-[#2D2926]">
                {activePassport.xp} <span className="text-[#594139]/70 font-normal">/ {activePassport.maxXp} XP</span>
              </span>
            </div>

            {/* Progress bar */}
            <div className="h-3 w-full bg-[#E9E8E4] rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#FF6B35] to-[#ff8c5a] rounded-full transition-all duration-700"
                style={{ width: `${progressPercent}%` }}
              ></div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================= */}
      {/* 2. KNOWLEDGE QUESTS & SKILL BADGES (BITEQUEST GAMIFIED)   */}
      {/* ========================================================= */}
      <section className="bg-white rounded-3xl p-5 shadow-[0_4px_20px_rgba(45,41,38,0.06)] border border-[#2D2926]/5 flex flex-col gap-3.5">
        <div className="flex justify-between items-center px-1">
          <div className="flex items-center gap-2">
            <span className="text-lg">💡</span>
            <div>
              <h3 className="font-heading text-sm font-bold text-[#2D2926] leading-tight">
                Kiến thức khám phá
              </h3>
              <p className="text-[10px] text-[#594139]">
                Tình huống thực tế & Mở khóa Huy hiệu Kỹ Năng
              </p>
            </div>
          </div>

          {isBothCompleted && (
            <span className="bg-[#FF6B35]/15 text-[#FF6B35] px-2.5 py-0.5 rounded-full text-[10px] font-heading font-extrabold flex items-center gap-1">
              <span>🏆</span> Sành Sỏi
            </span>
          )}
        </div>

        {/* 2 Knowledge Tracks Grid */}
        <div className="grid grid-cols-1 gap-3">
          {/* Track 1: Smart Biter / Ăn Tỉnh Táo */}
          <div
            onClick={() => onOpenKnowledgeQuest?.('smart_biter')}
            className="bg-[#FAF9F5] hover:bg-[#F4F4F0] p-4 rounded-2xl border border-[#2D2926]/8 flex items-center justify-between gap-3 cursor-pointer active:scale-98 transition-all group shadow-sm"
            id="quest-track-smart-biter"
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0 transition-transform group-hover:scale-105 shadow-sm ${
                  smartBiterProgress?.completed
                    ? 'bg-[#2EC4B6]/20 border border-[#2EC4B6]/30'
                    : 'bg-white border border-[#2D2926]/10'
                }`}
              >
                <span>������️</span>
              </div>

              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-heading font-extrabold text-[#FF6B35] tracking-wider uppercase">
                    SMART BITER
                  </span>
                  {smartBiterProgress?.completed ? (
                    <span className="bg-[#2EC4B6]/20 text-[#006A62] text-[9px] font-heading font-bold px-1.5 py-0.2 rounded-full">
                      ✓ Đã đạt {smartBiterProgress.bestScore}/5
                    </span>
                  ) : (
                    <span className="bg-[#594139]/10 text-[#594139] text-[9px] font-heading font-medium px-1.5 py-0.2 rounded-full">
                      {smartBiterProgress?.bestScore ? `${smartBiterProgress.bestScore}/5` : '0/5'}
                    </span>
                  )}
                </div>
                <h4 className="font-heading text-xs font-bold text-[#2D2926]">
                  Ăn Tỉnh Táo
                </h4>
                <p className="text-[10px] text-[#594139] line-clamp-1">
                  Minh bạch giá cả, đối chiếu hóa đơn & bằng chứng thực tế
                </p>
              </div>
            </div>

            <div className="flex-shrink-0 text-right">
              <span
                className={`px-3 py-1 rounded-full text-[11px] font-heading font-bold transition-colors inline-block ${
                  smartBiterProgress?.completed
                    ? 'bg-[#2EC4B6] text-white shadow-sm'
                    : 'bg-[#FF6B35] text-white shadow-sm'
                }`}
              >
                {smartBiterProgress?.completed ? 'Luyện tập' : 'Bắt đầu'}
              </span>
            </div>
          </div>

          {/* Track 2: Bite Guardian / Người Khám Phá Có Trách Nhiệm */}
          <div
            onClick={() => onOpenKnowledgeQuest?.('bite_guardian')}
            className="bg-[#FAF9F5] hover:bg-[#F4F4F0] p-4 rounded-2xl border border-[#2D2926]/8 flex items-center justify-between gap-3 cursor-pointer active:scale-98 transition-all group shadow-sm"
            id="quest-track-bite-guardian"
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0 transition-transform group-hover:scale-105 shadow-sm ${
                  biteGuardianProgress?.completed
                    ? 'bg-[#2EC4B6]/20 border border-[#2EC4B6]/30'
                    : 'bg-white border border-[#2D2926]/10'
                }`}
              >
                <span>🧭</span>
              </div>

              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-heading font-extrabold text-[#00A7CB] tracking-wider uppercase">
                    BITE GUARDIAN
                  </span>
                  {biteGuardianProgress?.completed ? (
                    <span className="bg-[#2EC4B6]/20 text-[#006A62] text-[9px] font-heading font-bold px-1.5 py-0.2 rounded-full">
                      ✓ Đã đạt {biteGuardianProgress.bestScore}/5
                    </span>
                  ) : (
                    <span className="bg-[#594139]/10 text-[#594139] text-[9px] font-heading font-medium px-1.5 py-0.2 rounded-full">
                      {biteGuardianProgress?.bestScore ? `${biteGuardianProgress.bestScore}/5` : '0/5'}
                    </span>
                  )}
                </div>
                <h4 className="font-heading text-xs font-bold text-[#2D2926]">
                  Người Khám Phá Có Trách Nhiệm
                </h4>
                <p className="text-[10px] text-[#594139] line-clamp-1">
                  Xác minh độc lập, tôn trọng quyền riêng tư & an toàn cộng đồng
                </p>
              </div>
            </div>

            <div className="flex-shrink-0 text-right">
              <span
                className={`px-3 py-1 rounded-full text-[11px] font-heading font-bold transition-colors inline-block ${
                  biteGuardianProgress?.completed
                    ? 'bg-[#2EC4B6] text-white shadow-sm'
                    : 'bg-[#FF6B35] text-white shadow-sm'
                }`}
              >
                {biteGuardianProgress?.completed ? 'Luyện tập' : 'Bắt đầu'}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Challenges Section */}
      <section className="flex flex-col gap-3">
        <div className="flex justify-between items-center px-1">
          <h3 className="font-heading text-base font-bold text-[#2D2926]">Thử thách thực địa</h3>
          <span className="bg-[#FF6B35]/15 text-[#FF6B35] px-3 py-1 rounded-full text-xs font-heading font-bold">
            {completedCount} / {totalCount} thử thách
          </span>
        </div>

        <div className="flex flex-col gap-3">
          {activePassport.challenges.map((ch) => (
            <div
              key={ch.id}
              onClick={() => {
                if (!ch.isCompleted) {
                  onNavigateToCamera();
                }
              }}
              className={`bg-white rounded-2xl p-3.5 flex items-center gap-3.5 border transition-all ${
                ch.isCompleted
                  ? 'border-l-4 border-l-[#2EC4B6] border-[#2D2926]/5 shadow-sm opacity-90'
                  : 'border-l-4 border-l-[#E1BFB5] border-[#2D2926]/5 shadow-sm hover:border-l-[#FF6B35] cursor-pointer hover:shadow-md active:scale-98'
              }`}
            >
              {/* Checkmark or circle */}
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                  ch.isCompleted
                    ? 'bg-[#2EC4B6]/20 text-[#006A62]'
                    : 'bg-[#F4F4F0] text-[#594139]/60'
                }`}
              >
                {ch.isCompleted ? (
                  <span className="material-symbols-outlined text-[20px] fill text-[#2EC4B6]">
                    check_circle
                  </span>
                ) : (
                  <span className="material-symbols-outlined text-[20px]">
                    radio_button_unchecked
                  </span>
                )}
              </div>

              {/* Title & info */}
              <div className="flex-grow">
                <h4
                  className={`font-heading text-xs font-bold ${
                    ch.isCompleted
                      ? 'text-[#2D2926] line-through opacity-70'
                      : 'text-[#2D2926]'
                  }`}
                >
                  {ch.title}
                </h4>
                <p className="text-[11px] text-[#594139]/80">
                  {ch.isCompleted ? ch.completedAt : `Thưởng +${ch.rewardXp} XP`}
                </p>
              </div>

              {/* Food Emoji Icon */}
              <div className={`text-2xl flex-shrink-0 ${ch.isCompleted ? '' : 'grayscale opacity-75'}`}>
                {ch.icon}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Button */}
      <div className="mt-2">
        <button
          onClick={onNavigateToCamera}
          className="w-full bg-[#FF6B35] hover:bg-[#FF6B35]/90 text-white py-3.5 rounded-full font-heading text-sm font-bold shadow-lg shadow-[#FF6B35]/30 flex items-center justify-center gap-2 active:scale-98 transition-transform"
          id="btn-passport-unlock-next"
        >
          <span>Đi mở khóa tiếp</span>
          <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
        </button>
      </div>
    </div>
  );
};

