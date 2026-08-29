import React, { useState, useMemo } from 'react';
import { DistrictPassport, User } from '../types';
import { KnowledgeTrackId, KNOWLEDGE_TRACKS } from '../data/knowledgeQuestions';

export type TitleRarity = 'legendary' | 'epic' | 'rare' | 'special';

export interface HonorTitleItem {
  id: string;
  titleName: string;
  shortTag: string;
  rarity: TitleRarity;
  rarityLabel: string;
  emoji: string;
  districtId?: string;
  districtName?: string;
  categoryDesc: string;
  conditionDesc: string;
  rewardXp: number;
  fomoStat: string; // e.g. "Chỉ 2.1% Thợ Săn đạt được"
  completed: boolean;
  progressCurrent: number;
  progressTotal: number;
  unlockedDate?: string;
  perks: string[];
}

interface PassportViewProps {
  passport: DistrictPassport;
  user?: User;
  onNavigateToExplore: () => void;
  onNavigateToCamera: () => void;
  onOpenKnowledgeQuest?: (trackId: KnowledgeTrackId) => void;
  onUpdateTitle?: (title: string) => void;
  onOpenLeaderboard?: () => void;
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
    levelTitle: 'Bậc Thầy Ba Đình',
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
    levelTitle: 'Tín Đồ Hồ Tây',
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
  onUpdateTitle,
  onOpenLeaderboard,
}) => {
  const [selectedDistrict, setSelectedDistrict] = useState<string>('cau_giay');
  const [viewTab, setViewTab] = useState<'titles' | 'challenges' | 'knowledge'>('titles');
  const [titleFilter, setTitleFilter] = useState<'all' | 'unlocked' | 'locked' | 'legendary'>('all');
  const [selectedTitleModal, setSelectedTitleModal] = useState<HonorTitleItem | null>(null);
  const [equippedToast, setEquippedToast] = useState<string | null>(null);

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

  // Build Comprehensive List of Honor Titles (Hệ thống Danh Hiệu Danh Vọng)
  const honorTitles: HonorTitleItem[] = useMemo(() => {
    // Dynamic truthful calculation from actual user object
    const cauGiayCompleted = user?.districtProgress?.find((d) => d.districtId === 'cau_giay')?.completed ?? completedCount;
    const dongDaCompleted = user?.districtProgress?.find((d) => d.districtId === 'dong_da')?.completed || 0;
    const hoanKiemCompleted = user?.districtProgress?.find((d) => d.districtId === 'hoan_kiem')?.completed || 0;
    const tayHoCompleted = user?.districtProgress?.find((d) => d.districtId === 'tay_ho')?.completed || 0;
    const baDinhCompleted = user?.districtProgress?.find((d) => d.districtId === 'ba_dinh')?.completed || 0;

    const isCauGiayDone = cauGiayCompleted >= 4 || Boolean(user?.availableTitles?.includes('👑 Thực Thần Cầu Giấy'));
    const isDongDaDone = dongDaCompleted >= 4 || Boolean(user?.availableTitles?.includes('🦪 Chiến Thần Chùa Láng'));
    const isHoanKiemDone = hoanKiemCompleted >= 5 || Boolean(user?.availableTitles?.includes('🏮 Thổ Địa Phố Cổ'));
    const isTayHoDone = tayHoCompleted >= 4 || Boolean(user?.availableTitles?.includes('🌅 Tín Đồ Hoàng Hôn Hồ Tây'));
    const isBaDinhDone = baDinhCompleted >= 4 || Boolean(user?.availableTitles?.includes('🏛️ Bậc Thầy Tinh Hoa Ba Đình'));

    const isSmartBiterDone = Boolean(smartBiterProgress?.completed) || Boolean(user?.availableTitles?.includes('🛡️ Smart Biter Tinh Anh'));
    const isBiteGuardianDone = Boolean(biteGuardianProgress?.completed) || Boolean(user?.availableTitles?.includes('🧭 Bite Guardian Tối Cao'));
    const firstBites = user?.stats?.firstBitesCount || 0;
    const isFirstScoutDone = firstBites >= 1 || Boolean(user?.availableTitles?.includes('⚡ First Bite Tiên Phong'));

    const placesDiscovered = user?.stats?.placesDiscovered || 0;
    const isNightOwlDone = placesDiscovered >= 10 || Boolean(user?.availableTitles?.includes('🌙 Kẻ Săn Đêm'));
    const isNgoMasterDone = placesDiscovered >= 6 || Boolean(user?.availableTitles?.includes('🛵 Trùm Quán Ngõ Sâu'));
    const isNoodleMasterDone = placesDiscovered >= 4 || Boolean(user?.availableTitles?.includes('🍜 Bậc Thầy Bún Phở'));
    const isCoffeeDone = placesDiscovered >= 5 || Boolean(user?.availableTitles?.includes('☕ Tri Kỷ Cà Phê'));

    return [
      {
        id: 'title_cau_giay',
        titleName: 'Thực Thần Cầu Giấy',
        shortTag: 'Cầu Giấy Master',
        rarity: 'legendary',
        rarityLabel: 'HUYỀN THOẠI',
        emoji: '👑',
        districtId: 'cau_giay',
        districtName: 'Cầu Giấy',
        categoryDesc: 'Bá chủ ẩm thực ngõ phố & khu sinh viên',
        conditionDesc: 'Hoàn thành từ 4/6 nhiệm vụ ẩm thực tại Cầu Giấy',
        rewardXp: 300,
        fomoStat: 'Chỉ 3.2% Thợ Săn mở khóa',
        completed: isCauGiayDone,
        progressCurrent: Math.min(6, cauGiayCompleted),
        progressTotal: 6,
        unlockedDate: isCauGiayDone ? '15/05/2026' : undefined,
        perks: ['Khung Avatar Vàng Hoàng Kim', 'Hào quang Thực Thần trên Bản Đồ', '+300 XP'],
      },
      {
        id: 'title_dong_da',
        titleName: 'Chiến Thần Chùa Láng',
        shortTag: 'Đống Đa Slayer',
        rarity: 'epic',
        rarityLabel: 'SỬ THI',
        emoji: '🦪',
        districtId: 'dong_da',
        districtName: 'Đống Đa',
        categoryDesc: 'Đệ nhất sành ốc Đặng Văn Ngữ & ăn vặt Chùa Láng',
        conditionDesc: 'Chinh phục 4/6 điểm check-in tại quận Đống Đa',
        rewardXp: 200,
        fomoStat: 'Chỉ 7.8% Thợ Săn sở hữu',
        completed: isDongDaDone,
        progressCurrent: Math.min(6, dongDaCompleted),
        progressTotal: 6,
        unlockedDate: isDongDaDone ? '14/05/2026' : undefined,
        perks: ['Danh hiệu hiển thị bảng tin Bạn Bè', 'Badge Ốc Hoàng Gia', '+200 XP'],
      },
      {
        id: 'title_hoan_kiem',
        titleName: 'Thổ Địa Phố Cổ',
        shortTag: 'Old Quarter Legend',
        rarity: 'legendary',
        rarityLabel: 'HUYỀN THOẠI',
        emoji: '🏮',
        districtId: 'hoan_kiem',
        districtName: 'Hoàn Kiếm',
        categoryDesc: 'Tinh hoa 36 Phố Phường & Cà phê Trứng cổ điển',
        conditionDesc: 'Hoàn thành từ 5/6 thử thách ẩm thực Phố Cổ',
        rewardXp: 350,
        fomoStat: 'Chỉ 1.9% Thợ Săn đạt được',
        completed: isHoanKiemDone,
        progressCurrent: Math.min(6, hoanKiemCompleted),
        progressTotal: 6,
        unlockedDate: isHoanKiemDone ? '18/05/2026' : undefined,
        perks: ['Huy hiệu Đèn Lồng Cổ Điển', 'Ưu tiên hiển thị trên Radar Fomo', '+350 XP'],
      },
      {
        id: 'title_tay_ho',
        titleName: 'Tín Đồ Hoàng Hôn Hồ Tây',
        shortTag: 'West Lake VIP',
        rarity: 'epic',
        rarityLabel: 'SỬ THI',
        emoji: '🌅',
        districtId: 'tay_ho',
        districtName: 'Tây Hồ',
        categoryDesc: 'Sành sỏi cà phê view hồ & ẩm thực đường Thanh Niên',
        conditionDesc: 'Chinh phục 4/6 điểm check-in Tây Hồ',
        rewardXp: 200,
        fomoStat: 'Chỉ 6.4% Thợ Săn đạt được',
        completed: isTayHoDone,
        progressCurrent: Math.min(6, tayHoCompleted),
        progressTotal: 6,
        unlockedDate: isTayHoDone ? '19/05/2026' : undefined,
        perks: ['Khung Avatar Hoàng Hôn Tây Hồ', '+200 XP'],
      },
      {
        id: 'title_ba_dinh',
        titleName: 'Bậc Thầy Tinh Hoa Ba Đình',
        shortTag: 'Ba Dinh Master',
        rarity: 'rare',
        rarityLabel: 'HIẾM',
        emoji: '🏛️',
        districtId: 'ba_dinh',
        districtName: 'Ba Đình',
        categoryDesc: 'Nét thanh lịch Trúc Bạch & Phở cuốn Ngũ Xã trứ danh',
        conditionDesc: 'Chinh phục 4/6 thử thách ẩm thực Ba Đình',
        rewardXp: 150,
        fomoStat: 'Chỉ 12.5% Thợ Săn đạt được',
        completed: isBaDinhDone,
        progressCurrent: Math.min(6, baDinhCompleted),
        progressTotal: 6,
        unlockedDate: isBaDinhDone ? '20/05/2026' : undefined,
        perks: ['Huy hiệu Thanh Lịch Hà Thành', '+150 XP'],
      },
      {
        id: 'title_smart_biter',
        titleName: 'Smart Biter Tinh Anh',
        shortTag: 'Thánh Săn Giá Thật',
        rarity: 'epic',
        rarityLabel: 'SỬ THI',
        emoji: '🛡️',
        categoryDesc: 'Minh bạch giá cả, đối chiếu hóa đơn & bằng chứng chuẩn',
        conditionDesc: 'Vượt qua 5/5 câu hỏi thử thách kỹ năng Smart Biter',
        rewardXp: 200,
        fomoStat: 'Chỉ 5.1% người đạt điểm tuyệt đối',
        completed: isSmartBiterDone,
        progressCurrent: isSmartBiterDone ? 5 : (smartBiterProgress?.bestScore || 0),
        progressTotal: 5,
        unlockedDate: isSmartBiterDone ? '16/05/2026' : undefined,
        perks: ['Tích xanh Xác Minh Thông Minh', 'Tăng 20% uy tín đánh giá', '+200 XP'],
      },
      {
        id: 'title_bite_guardian',
        titleName: 'Bite Guardian Tối Cao',
        shortTag: 'Người Gác Đền Vị Giác',
        rarity: 'epic',
        rarityLabel: 'SỬ THI',
        emoji: '🧭',
        categoryDesc: 'Bảo vệ cộng đồng ẩm thực, review công tâm & chuẩn mực',
        conditionDesc: 'Vượt qua 5/5 tình huống đạo đức & trách nhiệm ẩm thực',
        rewardXp: 200,
        fomoStat: 'Chỉ 4.8% Thợ Săn bảo vệ thành công',
        completed: isBiteGuardianDone,
        progressCurrent: isBiteGuardianDone ? 5 : (biteGuardianProgress?.bestScore || 0),
        progressTotal: 5,
        unlockedDate: isBiteGuardianDone ? '17/05/2026' : undefined,
        perks: ['Huy hiệu Người Gác Đền 🧭', 'Quyền đề xuất quán ẩn nhanh', '+200 XP'],
      },
      {
        id: 'title_first_scout',
        titleName: 'First Bite Tiên Phong',
        shortTag: 'Pioneer Scout',
        rarity: 'legendary',
        rarityLabel: 'HUYỀN THOẠI',
        emoji: '⚡',
        categoryDesc: 'Người đầu tiên khám phá và xác minh quán ăn ẩn chưa ai biết',
        conditionDesc: 'Khai phá thành công ít nhất 1 First Bite trong thành phố',
        rewardXp: 300,
        fomoStat: 'Chỉ 1.2% Thợ Săn Tiên Phong',
        completed: isFirstScoutDone,
        progressCurrent: firstBites,
        progressTotal: 1,
        unlockedDate: isFirstScoutDone ? '10/05/2026' : undefined,
        perks: ['Vinh danh tên vĩnh viễn trên trang quán', 'Hiệu ứng Tia Sét Vàng', '+300 XP'],
      },
      {
        id: 'title_night_owl',
        titleName: 'Thần Sấm Ăn Đêm',
        shortTag: 'Midnight Gourmet',
        rarity: 'rare',
        rarityLabel: 'HIẾM',
        emoji: '🌙',
        categoryDesc: 'Chuyên gia săn lùng những quán đêm nóng hổi sau 22:00',
        conditionDesc: 'Check-in 3 lần tại các quán mở khuya sau 22h',
        rewardXp: 120,
        fomoStat: 'Chỉ 14.3% Cú Đêm đạt được',
        completed: isNightOwlDone,
        progressCurrent: isNightOwlDone ? 3 : Math.min(2, Math.floor(placesDiscovered / 4)),
        progressTotal: 3,
        unlockedDate: isNightOwlDone ? '18/05/2026' : undefined,
        perks: ['Biểu tượng Trăng Khuyết phát sáng', '+120 XP'],
      },
      {
        id: 'title_ngo_master',
        titleName: 'Trùm Quán Ngõ Sâu',
        shortTag: 'Alley Dominator',
        rarity: 'rare',
        rarityLabel: 'HIẾM',
        emoji: '🛵',
        categoryDesc: 'Luồn lách mọi ngõ ngách ngóc ngách không sợ lạc lối',
        conditionDesc: 'Khám phá 5 quán ăn nằm sâu trong ngõ hẻm Hà Nội',
        rewardXp: 150,
        fomoStat: 'Chỉ 9.6% Thợ Săn làm được',
        completed: isNgoMasterDone,
        progressCurrent: isNgoMasterDone ? 5 : Math.min(4, Math.floor(placesDiscovered / 2)),
        progressTotal: 5,
        unlockedDate: isNgoMasterDone ? '12/05/2026' : undefined,
        perks: ['Huy hiệu Xe Máy Luồn Ngõ 🛵', '+150 XP'],
      },
      {
        id: 'title_noodle_master',
        titleName: 'Bậc Thầy Bún Phở',
        shortTag: 'Noodle Sovereign',
        rarity: 'special',
        rarityLabel: 'ĐẶC SẮC',
        emoji: '🍜',
        categoryDesc: 'Sành từng sợi bún giòn, nước dùng thanh ngọt chuẩn vị',
        conditionDesc: 'Thưởng thức 5 loại bún / phở / mì truyền thống khác nhau',
        rewardXp: 100,
        fomoStat: '24.1% người chơi đã mở',
        completed: isNoodleMasterDone,
        progressCurrent: isNoodleMasterDone ? 5 : Math.min(4, placesDiscovered),
        progressTotal: 5,
        unlockedDate: isNoodleMasterDone ? '09/05/2026' : undefined,
        perks: ['Huy hiệu Bát Phở Bốc Khói 🍜', '+100 XP'],
      },
      {
        id: 'title_coffee_connoisseur',
        titleName: 'Tri Kỷ Cà Phê',
        shortTag: 'Specialty Master',
        rarity: 'special',
        rarityLabel: 'ĐẶC SẮC',
        emoji: '☕',
        categoryDesc: 'Gu cà phê tinh tế từ Pour-over, Cà phê trứng đến Cold brew',
        conditionDesc: 'Check-in 5 quán café specialty hoặc view ban công',
        rewardXp: 100,
        fomoStat: '18.9% người chơi sở hữu',
        completed: isCoffeeDone,
        progressCurrent: isCoffeeDone ? 5 : Math.min(4, Math.floor(placesDiscovered / 2)),
        progressTotal: 5,
        unlockedDate: isCoffeeDone ? '11/05/2026' : undefined,
        perks: ['Huy hiệu Tách Cà Phê Hoàng Gia', '+100 XP'],
      },
    ];
  }, [
    completedCount,
    smartBiterProgress,
    biteGuardianProgress,
    user?.stats?.firstBitesCount,
    user?.stats?.placesDiscovered,
    user?.districtProgress,
    user?.availableTitles,
  ]);

  const totalTitlesCount = honorTitles.length;
  const unlockedTitlesCount = honorTitles.filter((t) => t.completed).length;

  // Filtered titles
  const filteredTitles = useMemo(() => {
    if (titleFilter === 'unlocked') return honorTitles.filter((t) => t.completed);
    if (titleFilter === 'locked') return honorTitles.filter((t) => !t.completed);
    if (titleFilter === 'legendary') return honorTitles.filter((t) => t.rarity === 'legendary');
    return honorTitles;
  }, [honorTitles, titleFilter]);

  const handleEquipTitle = (title: HonorTitleItem) => {
    if (!title.completed) return;
    if (onUpdateTitle) {
      onUpdateTitle(title.titleName);
    }
    setEquippedToast(`Đã trang bị danh hiệu "${title.titleName}" vào hồ sơ! ✨`);
    setTimeout(() => {
      setEquippedToast(null);
    }, 3000);
  };

  const districtOptions = [
    { key: 'cau_giay', label: 'Cầu Giấy', count: `${completedCount}/${totalCount}` },
    { key: 'dong_da', label: 'Đống Đa', count: '4/6' },
    { key: 'ba_dinh', label: 'Ba Đình', count: '2/6' },
    { key: 'hoan_kiem', label: 'Hoàn Kiếm', count: '4/6' },
    { key: 'tay_ho', label: 'Tây Hồ', count: '2/6' },
  ];

  return (
    <div
      className="min-h-screen bg-[#FDFCF8] text-[#2D2926] pt-[calc(4.5rem+env(safe-area-inset-top,0px))] pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))] px-3.5 sm:px-4 max-w-xl mx-auto flex flex-col gap-5"
      id="passport-container"
    >
      {/* Toast Notification when Equipping */}
      {equippedToast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-[#2D2926]/95 text-white px-4 py-2.5 rounded-full shadow-2xl backdrop-blur-md text-xs font-heading font-bold flex items-center gap-2 border border-white/10 animate-bounce">
          <span className="text-[#FF6B35] text-sm">👑</span>
          <span>{equippedToast}</span>
        </div>
      )}

      {/* ========================================================= */}
      {/* 1. TOP PRESTIGE HEADER & FOMO RACE TICKER (COMPACT RECT)   */}
      {/* ========================================================= */}
      <section className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-br from-[#2D2926] via-[#38302C] to-[#1F1C1A] text-white p-3.5 sm:p-4 shadow-[0_8px_24px_rgba(45,41,38,0.2)] border border-amber-500/20">
        {/* Subtle glowing ambient lights */}
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-[#FF6B35]/25 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-[#2EC4B6]/15 rounded-full blur-2xl pointer-events-none" />

        {/* Row 1: Season live ticker & XP stats pill */}
        <div className="flex items-center justify-between gap-2 mb-2.5 relative z-10">
          <button
            type="button"
            onClick={onOpenLeaderboard}
            className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 active:scale-95 transition-all backdrop-blur-md px-2.5 py-0.5 rounded-full text-[10px] font-heading font-extrabold text-amber-300 border border-amber-400/30 cursor-pointer shadow-xs"
            id="passport-open-leaderboard-btn"
          >
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-400"></span>
            </span>
            <span>MÙA 1: ĐUA TOP THỰC THẦN</span>
            <span className="text-amber-200/80 font-normal">|</span>
            <span className="text-amber-200 font-bold">🔥 BẢNG VÀNG</span>
            <span className="text-[9px]">→</span>
          </button>

          <div className="bg-white/10 backdrop-blur-md px-2.5 py-0.5 rounded-full border border-white/10 text-[10px] font-heading font-bold text-amber-300 flex items-center gap-1">
            <span>⚡</span>
            <span className="text-white">{user?.xp || 780} XP</span>
          </div>
        </div>

        {/* Row 2: User Rank & Active Title in sleek horizontal arrangement */}
        <div className="flex items-center justify-between gap-3 relative z-10 py-0.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={onOpenLeaderboard}
              className="relative shrink-0 text-left cursor-pointer group"
              title="Xem Bảng xếp hạng Thực Thần"
            >
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-br from-amber-400 via-[#FF6B35] to-rose-500 p-0.5 shadow-md flex items-center justify-center transition-transform group-hover:scale-105">
                <div className="w-full h-full bg-[#2D2926] rounded-[10px] flex items-center justify-center text-xl">
                  {user?.activeTitle?.includes('👑') ? '👑' : user?.activeTitle?.includes('🛡️') ? '🛡️' : '🏆'}
                </div>
              </div>
              <span className="absolute -bottom-1 -right-1 bg-gradient-to-r from-amber-400 to-[#FF6B35] text-[#2D2926] text-[8px] font-heading font-black px-1 py-0.2 rounded-full shadow-xs">
                TOP 5%
              </span>
            </button>

            <div className="min-w-0">
              <span className="text-[9px] font-heading font-bold text-amber-300/80 uppercase tracking-wider block leading-none mb-1">
                Danh Hiệu Đang Mang
              </span>
              <h2 className="font-heading text-sm sm:text-base font-black tracking-tight text-white truncate">
                {user?.activeTitle || 'Bite Scout Mới'}
              </h2>
            </div>
          </div>

          <div className="text-right shrink-0">
            <span className="text-[10px] font-heading font-bold text-white/70 block">
              Đã mở <strong className="text-amber-300 font-black">{unlockedTitlesCount}</strong>/{totalTitlesCount}
            </span>
            <span className="text-[9px] font-mono text-emerald-400 font-bold">
              +{Math.round((unlockedTitlesCount / totalTitlesCount) * 100)}% danh vọng
            </span>
          </div>
        </div>

        {/* Row 3: Compact Progress bar */}
        <div className="mt-2.5 pt-2 border-t border-white/10 flex items-center justify-between gap-2.5 relative z-10">
          <div className="flex-1">
            <div className="h-1.5 w-full bg-white/15 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-amber-400 via-[#FF6B35] to-[#2EC4B6] rounded-full transition-all duration-700 shadow-xs"
                style={{ width: `${(unlockedTitlesCount / totalTitlesCount) * 100}%` }}
              />
            </div>
          </div>
          <span className="text-[10px] font-heading font-bold text-amber-300 shrink-0">
            {Math.round((unlockedTitlesCount / totalTitlesCount) * 100)}% HOÀN THÀNH
          </span>
        </div>
      </section>

      {/* ========================================================= */}
      {/* 2. MAIN SEGMENT SELECTOR: LƯỚI DANH HIỆU vs THỰC ĐỊA     */}
      {/* ========================================================= */}
      <div className="flex bg-[#F4F4F0] p-1 rounded-2xl border border-[#2D2926]/8 shadow-2xs">
        <button
          type="button"
          onClick={() => setViewTab('titles')}
          className={`flex-1 py-2 rounded-xl text-xs font-heading font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            viewTab === 'titles'
              ? 'bg-gradient-to-r from-amber-400 to-[#FF6B35] text-white shadow-sm shadow-amber-500/20 scale-[1.01]'
              : 'text-[#594139] hover:text-[#2D2926]'
          }`}
          id="tab-titles-grid"
        >
          <span className="text-sm">🏆</span>
          <span>Lưới Danh Hiệu ({unlockedTitlesCount}/{totalTitlesCount})</span>
        </button>

        <button
          type="button"
          onClick={() => setViewTab('challenges')}
          className={`flex-1 py-2 rounded-xl text-xs font-heading font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            viewTab === 'challenges'
              ? 'bg-[#2D2926] text-white shadow-sm scale-[1.01]'
              : 'text-[#594139] hover:text-[#2D2926]'
          }`}
          id="tab-district-challenges"
        >
          <span className="text-sm">🗺️</span>
          <span>Nhiệm Vụ Quận</span>
        </button>

        <button
          type="button"
          onClick={() => setViewTab('knowledge')}
          className={`flex-1 py-2 rounded-xl text-xs font-heading font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            viewTab === 'knowledge'
              ? 'bg-[#2EC4B6] text-white shadow-sm scale-[1.01]'
              : 'text-[#594139] hover:text-[#2D2926]'
          }`}
          id="tab-knowledge-tracks"
        >
          <span className="text-sm">💡</span>
          <span>Kỹ Năng ({isBothCompleted ? '2/2' : '1/2'})</span>
        </button>
      </div>

      {/* ========================================================= */}
      {/* 3. VIEW 1: LƯỚI CÁC DANH HIỆU VINH QUANG (SMART 2-COL GRID)*/}
      {/* ========================================================= */}
      {viewTab === 'titles' && (
        <section className="flex flex-col gap-3 animate-fade-in" id="titles-grid-section">
          {/* Filter Bar & Live FOMO notice */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar py-0.5">
              {[
                { key: 'all', label: `Tất cả (${totalTitlesCount})` },
                { key: 'unlocked', label: `Đã mở (${unlockedTitlesCount}) ✨` },
                { key: 'locked', label: `Đang săn (${totalTitlesCount - unlockedTitlesCount}) 🔒` },
                { key: 'legendary', label: `👑 Huyền Thoại` },
              ].map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setTitleFilter(f.key as any)}
                  className={`px-2.5 py-1 rounded-full text-[10px] font-heading font-bold whitespace-nowrap transition-all cursor-pointer ${
                    titleFilter === f.key
                      ? 'bg-[#2D2926] text-white shadow-xs'
                      : 'bg-white text-[#594139] border border-[#2D2926]/10 hover:bg-[#F4F4F0]'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <span className="text-[10px] font-heading text-[#FF6B35] font-bold">
              ⚡ Chạm để xem chi tiết
            </span>
          </div>

          {/* THE SMART 2-COLUMN GAMIFIED COMPACT GRID */}
          <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
            {filteredTitles.map((title) => {
              const isEquipped = user?.activeTitle === title.titleName;
              const isLegendary = title.rarity === 'legendary';
              const isEpic = title.rarity === 'epic';

              return (
                <div
                  key={title.id}
                  onClick={() => setSelectedTitleModal(title)}
                  className={`relative rounded-2xl p-2.5 sm:p-3 transition-all duration-300 cursor-pointer flex flex-col justify-between min-h-[175px] overflow-hidden group active:scale-[0.98] ${
                    title.completed
                      ? isLegendary
                        ? 'bg-gradient-to-br from-[#FFFDF5] via-white to-[#FFF6E5] border border-amber-400/80 shadow-[0_4px_16px_rgba(245,158,11,0.15)] hover:shadow-md'
                        : isEpic
                        ? 'bg-gradient-to-br from-[#FAF5FF] via-white to-[#F0FDFA] border border-purple-400/60 shadow-[0_4px_16px_rgba(168,85,247,0.12)] hover:shadow-md'
                        : 'bg-white border border-[#2EC4B6]/50 shadow-[0_4px_16px_rgba(46,196,182,0.1)] hover:shadow-md'
                      : 'bg-[#FAF9F5] border border-[#2D2926]/8 hover:border-[#FF6B35]/30 shadow-2xs'
                  }`}
                  id={`title-card-${title.id}`}
                >
                  {/* Top Line: Rarity & Status */}
                  <div className="flex items-center justify-between gap-1 mb-1.5 relative z-10">
                    <span
                      className={`text-[8px] font-heading font-black tracking-wider px-1.5 py-0.2 rounded-md uppercase flex items-center gap-0.5 ${
                        isLegendary
                          ? 'bg-amber-500/15 text-amber-800 border border-amber-300'
                          : isEpic
                          ? 'bg-purple-500/15 text-purple-800 border border-purple-300'
                          : title.rarity === 'rare'
                          ? 'bg-[#2EC4B6]/15 text-[#006A62] border border-[#2EC4B6]/30'
                          : 'bg-stone-100 text-stone-700 border border-stone-200'
                      }`}
                    >
                      {title.rarityLabel}
                    </span>

                    {title.completed ? (
                      isEquipped ? (
                        <span className="bg-amber-500 text-white text-[8px] font-heading font-black px-1.5 py-0.2 rounded-full flex items-center gap-0.5">
                          <span>👑</span> DÙNG
                        </span>
                      ) : (
                        <span className="text-[#006A62] text-[8px] font-heading font-extrabold bg-[#2EC4B6]/15 px-1.5 py-0.2 rounded-full">
                          ✓ MỞ
                        </span>
                      )
                    ) : (
                      <span className="text-[#8D7168] text-[8px] font-heading font-bold bg-[#2D2926]/5 px-1.5 py-0.2 rounded-full">
                        🔒 KHÓA
                      </span>
                    )}
                  </div>

                  {/* Icon & Title Info */}
                  <div className="flex flex-col items-center text-center my-1 relative z-10">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0 transition-transform group-hover:scale-110 shadow-xs mb-1.5 ${
                        title.completed
                          ? isLegendary
                            ? 'bg-gradient-to-br from-amber-100 to-amber-200 border border-amber-400/50'
                            : 'bg-white border border-[#2D2926]/10'
                          : 'bg-[#EAE9E4]/70 grayscale opacity-70 border border-[#2D2926]/5'
                      }`}
                    >
                      <span>{title.emoji}</span>
                    </div>

                    <h3
                      className={`font-heading text-xs font-black leading-tight line-clamp-1 w-full ${
                        title.completed ? 'text-[#2D2926]' : 'text-[#594139]'
                      }`}
                    >
                      {title.titleName}
                    </h3>
                    <p className="text-[10px] text-[#594139]/80 line-clamp-1 mt-0.5 w-full">
                      {title.categoryDesc}
                    </p>
                    <span className="text-[9px] text-[#8D7168] font-mono mt-0.5">
                      {title.fomoStat}
                    </span>
                  </div>

                  {/* Bottom: Progress Bar & Mini Action */}
                  <div className="pt-2 border-t border-[#2D2926]/5 flex flex-col gap-1.5 relative z-10">
                    <div className="flex items-center justify-between text-[9px] font-heading">
                      <span className="text-amber-700 font-bold">
                        +{title.rewardXp} XP
                      </span>
                      <span
                        className={`font-bold ${
                          title.completed ? 'text-[#2EC4B6]' : 'text-[#FF6B35]'
                        }`}
                      >
                        {title.completed
                          ? '✓ Đã đạt'
                          : `${title.progressCurrent}/${title.progressTotal}`}
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="h-1 w-full bg-[#E9E8E4] rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          title.completed
                            ? 'bg-[#2EC4B6]'
                            : 'bg-gradient-to-r from-[#FF6B35] to-amber-400'
                        }`}
                        style={{
                          width: `${Math.min(
                            100,
                            (title.progressCurrent / title.progressTotal) * 100
                          )}%`,
                        }}
                      />
                    </div>

                    {/* Action Button */}
                    {title.completed ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEquipTitle(title);
                        }}
                        className={`w-full py-1 rounded-lg text-[10px] font-heading font-bold transition-all cursor-pointer text-center ${
                          isEquipped
                            ? 'bg-amber-100 text-amber-900 border border-amber-300 font-black'
                            : 'bg-[#FF6B35] hover:bg-[#FF6B35]/90 text-white shadow-2xs active:scale-95'
                        }`}
                      >
                        {isEquipped ? '✓ Đang dùng' : '⚡ Trang bị'}
                      </button>
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
        </section>
      )}

      {/* ========================================================= */}
      {/* 4. VIEW 2: NHIỆM VỤ QUẬN & ROADMAP THỰC ĐỊA              */}
      {/* ========================================================= */}
      {viewTab === 'challenges' && (
        <section className="flex flex-col gap-5 animate-fade-in" id="district-challenges-section">
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

          {/* District Header Card */}
          <div className="bg-white rounded-3xl p-5 shadow-[0_8px_30px_rgba(45,41,38,0.06)] border border-[#2D2926]/5 relative overflow-hidden">
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
                <h2 className="font-heading text-xl font-black text-[#2D2926]">
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
          </div>

          {/* Challenges Section */}
          <div className="flex flex-col gap-3">
            <div className="flex justify-between items-center px-1">
              <h3 className="font-heading text-base font-bold text-[#2D2926]">Thử thách thực địa</h3>
              <span className="bg-[#FF6B35]/15 text-[#FF6B35] px-3 py-1 rounded-full text-xs font-heading font-bold">
                {completedCount} / {totalCount} hoàn thành
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
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
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

                  <div className="flex-1 min-w-0">
                    <h4
                      className={`font-heading text-xs font-bold ${
                        ch.isCompleted
                          ? 'text-[#2D2926] line-through opacity-70'
                          : 'text-[#2D2926]'
                      }`}
                    >
                      {ch.title}
                    </h4>
                    <p className="text-[11px] text-[#594139]/80 truncate">
                      {ch.isCompleted ? ch.completedAt : `Thưởng +${ch.rewardXp} XP • Nhấn để check-in`}
                    </p>
                  </div>

                  <div className={`text-2xl shrink-0 ${ch.isCompleted ? '' : 'grayscale opacity-75'}`}>
                    {ch.icon}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* CTA Button */}
          <div className="mt-1">
            <button
              onClick={onNavigateToCamera}
              className="w-full bg-[#FF6B35] hover:bg-[#FF6B35]/90 text-white py-3.5 rounded-full font-heading text-sm font-bold shadow-lg shadow-[#FF6B35]/30 flex items-center justify-center gap-2 active:scale-98 transition-transform cursor-pointer"
              id="btn-passport-unlock-next"
            >
              <span>Đi mở khóa thử thách tiếp theo</span>
              <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
            </button>
          </div>
        </section>
      )}

      {/* ========================================================= */}
      {/* 5. VIEW 3: KIẾN THỨC KHÁM PHÁ (KNOWLEDGE TRACKS)          */}
      {/* ========================================================= */}
      {viewTab === 'knowledge' && (
        <section className="bg-white rounded-3xl p-5 shadow-[0_8px_30px_rgba(45,41,38,0.06)] border border-[#2D2926]/5 flex flex-col gap-4 animate-fade-in">
          <div className="flex justify-between items-center px-0.5">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#FF6B35]/12 text-[#FF6B35] flex items-center justify-center text-base shrink-0 shadow-2xs">
                <span>💡</span>
              </div>
              <div>
                <h3 className="font-heading text-sm font-bold text-[#2D2926] leading-tight">
                  Kiến thức khám phá
                </h3>
                <p className="text-[11px] text-[#594139]">
                  Tình huống thực tế & Mở khóa Huy hiệu Kỹ Năng
                </p>
              </div>
            </div>

            {isBothCompleted ? (
              <span className="bg-[#FF6B35]/15 text-[#FF6B35] px-2.5 py-1 rounded-full text-[10px] font-heading font-extrabold flex items-center gap-1 shrink-0">
                <span>🏆</span> Sành Sỏi
              </span>
            ) : (
              <span className="bg-[#2EC4B6]/12 text-[#006A62] px-2.5 py-0.5 rounded-full text-[10px] font-heading font-bold shrink-0">
                +100 XP / Track
              </span>
            )}
          </div>

          <div className="flex flex-col gap-3">
            {/* Track 1: Smart Biter / Ăn Tỉnh Táo */}
            <div
              onClick={() => onOpenKnowledgeQuest?.('smart_biter')}
              className="bg-[#FAF9F5] hover:bg-[#F4F4F0] p-4 rounded-2xl border border-[#2D2926]/8 flex items-center justify-between gap-3 cursor-pointer active:scale-98 transition-all group shadow-2xs hover:shadow-xs"
              id="quest-track-smart-biter"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shrink-0 transition-transform group-hover:scale-105 shadow-xs ${
                    smartBiterProgress?.completed
                      ? 'bg-[#2EC4B6]/20 border border-[#2EC4B6]/30'
                      : 'bg-white border border-[#2D2926]/10'
                  }`}
                >
                  <span>🛡️</span>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                    <span className="text-[10px] font-heading font-extrabold text-[#FF6B35] tracking-wider uppercase">
                      SMART BITER
                    </span>
                    {smartBiterProgress?.completed ? (
                      <span className="bg-[#2EC4B6]/20 text-[#006A62] text-[9px] font-heading font-black px-1.5 py-0.2 rounded-full">
                        Đã mở khóa ✨
                      </span>
                    ) : (
                      <span className="bg-[#594139]/10 text-[#594139] text-[9px] font-heading font-medium px-1.5 py-0.2 rounded-full">
                        {smartBiterProgress?.bestScore ? `${smartBiterProgress.bestScore}/5` : 'Chưa mở'}
                      </span>
                    )}
                  </div>
                  <h4 className="font-heading text-xs font-bold text-[#2D2926] truncate">
                    Ăn Tỉnh Táo
                  </h4>
                  <p className="text-[11px] text-[#594139] line-clamp-1 mt-0.5">
                    Minh bạch giá cả, đối chiếu hóa đơn & bằng chứng thực tế
                  </p>
                </div>
              </div>

              <div className="shrink-0 text-right">
                <span
                  className={`px-3 py-1.5 rounded-full text-xs font-heading font-bold transition-all inline-flex items-center gap-1 ${
                    smartBiterProgress?.completed
                      ? 'bg-[#2EC4B6] text-white shadow-xs'
                      : 'bg-[#FF6B35] text-white shadow-xs'
                  }`}
                >
                  <span>{smartBiterProgress?.completed ? 'Luyện tập' : 'Bắt đầu'}</span>
                  <span className="material-symbols-outlined text-[14px]">
                    {smartBiterProgress?.completed ? 'refresh' : 'arrow_forward'}
                  </span>
                </span>
              </div>
            </div>

            {/* Track 2: Bite Guardian / Người Khám Phá Có Trách Nhiệm */}
            <div
              onClick={() => onOpenKnowledgeQuest?.('bite_guardian')}
              className="bg-[#FAF9F5] hover:bg-[#F4F4F0] p-4 rounded-2xl border border-[#2D2926]/8 flex items-center justify-between gap-3 cursor-pointer active:scale-98 transition-all group shadow-2xs hover:shadow-xs"
              id="quest-track-bite-guardian"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shrink-0 transition-transform group-hover:scale-105 shadow-xs ${
                    biteGuardianProgress?.completed
                      ? 'bg-[#2EC4B6]/20 border border-[#2EC4B6]/30'
                      : 'bg-white border border-[#2D2926]/10'
                  }`}
                >
                  <span>🧭</span>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                    <span className="text-[10px] font-heading font-extrabold text-[#00A7CB] tracking-wider uppercase">
                      BITE GUARDIAN
                    </span>
                    {biteGuardianProgress?.completed ? (
                      <span className="bg-[#2EC4B6]/20 text-[#006A62] text-[9px] font-heading font-black px-1.5 py-0.2 rounded-full">
                        Đã mở khóa ✨
                      </span>
                    ) : (
                      <span className="bg-[#594139]/10 text-[#594139] text-[9px] font-heading font-medium px-1.5 py-0.2 rounded-full">
                        {biteGuardianProgress?.bestScore ? `${biteGuardianProgress.bestScore}/5` : 'Chưa mở'}
                      </span>
                    )}
                  </div>
                  <h4 className="font-heading text-xs font-bold text-[#2D2926] truncate">
                    Người Khám Phá Có Trách Nhiệm
                  </h4>
                  <p className="text-[11px] text-[#594139] line-clamp-1 mt-0.5">
                    Xác minh độc lập, tôn trọng quyền riêng tư & an toàn cộng đồng
                  </p>
                </div>
              </div>

              <div className="shrink-0 text-right">
                <span
                  className={`px-3 py-1.5 rounded-full text-xs font-heading font-bold transition-all inline-flex items-center gap-1 ${
                    biteGuardianProgress?.completed
                      ? 'bg-[#2EC4B6] text-white shadow-xs'
                      : 'bg-[#FF6B35] text-white shadow-xs'
                  }`}
                >
                  <span>{biteGuardianProgress?.completed ? 'Luyện tập' : 'Bắt đầu'}</span>
                  <span className="material-symbols-outlined text-[14px]">
                    {biteGuardianProgress?.completed ? 'refresh' : 'arrow_forward'}
                  </span>
                </span>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ========================================================= */}
      {/* 6. MODAL VINH DANH CHI TIẾT DANH HIỆU (TITLE SHOWCASE)    */}
      {/* ========================================================= */}
      {selectedTitleModal && (
        <div
          className="fixed inset-0 z-50 bg-[#2D2926]/70 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setSelectedTitleModal(null)}
          id="title-detail-modal"
        >
          <div
            className="w-full max-w-sm bg-gradient-to-b from-[#FFFDF8] to-[#FAF9F5] rounded-3xl p-6 border border-amber-500/30 shadow-[0_16px_48px_rgba(45,41,38,0.35)] relative overflow-hidden text-center flex flex-col items-center gap-4 animate-scale-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              type="button"
              onClick={() => setSelectedTitleModal(null)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-[#FAF9F5] hover:bg-[#F4F4F0] text-[#594139] flex items-center justify-center transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>

            {/* Glowing Big Trophy 3D Icon */}
            <div className="relative mt-2">
              <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-amber-300 via-[#FF6B35] to-purple-600 p-1 shadow-xl shadow-amber-500/25 flex items-center justify-center animate-bounce-subtle">
                <div className="w-full h-full bg-[#2D2926] rounded-[22px] flex items-center justify-center text-4xl">
                  {selectedTitleModal.emoji}
                </div>
              </div>
              <span className="absolute -bottom-2 -right-2 bg-gradient-to-r from-amber-400 to-[#FF6B35] text-[#2D2926] text-[10px] font-heading font-black px-2 py-0.5 rounded-full shadow-xs">
                {selectedTitleModal.rarityLabel}
              </span>
            </div>

            {/* Title Info */}
            <div className="space-y-1">
              <span className="text-[11px] font-heading font-extrabold text-[#FF6B35] tracking-widest uppercase">
                {selectedTitleModal.shortTag}
              </span>
              <h3 className="font-heading text-xl font-black text-[#2D2926]">
                {selectedTitleModal.titleName}
              </h3>
              <p className="text-xs text-[#594139] max-w-xs">
                {selectedTitleModal.categoryDesc}
              </p>
            </div>

            {/* FOMO Stat Callout */}
            <div className="w-full bg-[#2D2926]/5 rounded-2xl p-3 flex items-center justify-around text-center border border-[#2D2926]/8">
              <div>
                <span className="text-[10px] font-heading text-[#8D7168] block">Độ Hiếm</span>
                <span className="font-heading text-xs font-black text-amber-600">
                  {selectedTitleModal.fomoStat}
                </span>
              </div>
              <div className="h-6 w-px bg-[#2D2926]/10" />
              <div>
                <span className="text-[10px] font-heading text-[#8D7168] block">Thưởng XP</span>
                <span className="font-heading text-xs font-black text-[#2EC4B6]">
                  +{selectedTitleModal.rewardXp} XP
                </span>
              </div>
            </div>

            {/* Unlock Condition Box */}
            <div className="w-full bg-white rounded-2xl p-3.5 text-left border border-[#2D2926]/8 space-y-2">
              <span className="text-[11px] font-heading font-bold text-[#2D2926] block">
                Điều kiện mở khóa:
              </span>
              <p className="text-xs text-[#594139]">
                {selectedTitleModal.conditionDesc}
              </p>

              {/* Progress */}
              <div className="pt-1.5 space-y-1">
                <div className="flex justify-between text-[10px] font-heading font-bold">
                  <span className="text-[#8D7168]">Tiến trình hiện tại:</span>
                  <span className={selectedTitleModal.completed ? 'text-[#2EC4B6]' : 'text-[#FF6B35]'}>
                    {selectedTitleModal.completed ? 'ĐÃ HOÀN TẤT ✨' : `${selectedTitleModal.progressCurrent}/${selectedTitleModal.progressTotal}`}
                  </span>
                </div>
                <div className="h-2 w-full bg-[#E9E8E4] rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      selectedTitleModal.completed ? 'bg-[#2EC4B6]' : 'bg-[#FF6B35]'
                    }`}
                    style={{
                      width: `${Math.min(100, (selectedTitleModal.progressCurrent / selectedTitleModal.progressTotal) * 100)}%`,
                    }}
                  />
                </div>
              </div>

              {/* Perks List */}
              <div className="pt-2 border-t border-[#2D2926]/8">
                <span className="text-[10px] font-heading font-bold text-[#8D7168] block mb-1">
                  Đặc quyền khi sở hữu:
                </span>
                <ul className="text-[11px] text-[#594139] space-y-1">
                  {selectedTitleModal.perks.map((perk, i) => (
                    <li key={i} className="flex items-center gap-1.5">
                      <span className="text-[#FF6B35] text-xs">✦</span>
                      <span>{perk}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="w-full flex gap-2">
              {selectedTitleModal.completed ? (
                <button
                  type="button"
                  onClick={() => {
                    handleEquipTitle(selectedTitleModal);
                    setSelectedTitleModal(null);
                  }}
                  className="w-full bg-gradient-to-r from-amber-500 to-[#FF6B35] hover:opacity-95 text-white py-3 rounded-2xl font-heading text-xs font-black shadow-lg shadow-amber-500/25 flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-all"
                >
                  <span className="text-sm">👑</span>
                  <span>
                    {user?.activeTitle === selectedTitleModal.titleName
                      ? 'Đang sử dụng danh hiệu này'
                      : 'Trang bị làm danh hiệu chính'}
                  </span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedTitleModal(null);
                    onNavigateToCamera();
                  }}
                  className="w-full bg-[#FF6B35] hover:bg-[#FF6B35]/90 text-white py-3 rounded-2xl font-heading text-xs font-black shadow-lg shadow-[#FF6B35]/30 flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-all"
                >
                  <span className="text-sm">🚀</span>
                  <span>Bắt đầu săn danh hiệu ngay!</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
