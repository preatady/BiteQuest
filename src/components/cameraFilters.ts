import React from 'react';
import { Place } from '../types';

export type FilterId = 'locket_skin' | 'original' | 'warm_bite' | 'fresh' | 'night_bite' | 'vintage';

export type AspectRatioId = '1:1' | '3:4' | '9:16' | '4:3';

export interface AspectRatioOption {
  id: AspectRatioId;
  label: string;
  subLabelVi: string;
  subLabelEn: string;
  ratio: number; // width / height
  cssAspect: string;
}

export const ASPECT_RATIOS: AspectRatioOption[] = [
  {
    id: '1:1',
    label: '1:1',
    subLabelVi: 'Vuông Locket',
    subLabelEn: 'Square Locket',
    ratio: 1,
    cssAspect: 'aspect-square',
  },
  {
    id: '3:4',
    label: '3:4',
    subLabelVi: 'Chuẩn máy ảnh',
    subLabelEn: 'Standard 3:4',
    ratio: 3 / 4,
    cssAspect: 'aspect-[3/4]',
  },
  {
    id: '9:16',
    label: '9:16',
    subLabelVi: 'Toàn màn hình',
    subLabelEn: 'Full Screen',
    ratio: 9 / 16,
    cssAspect: 'aspect-[9/16]',
  },
  {
    id: '4:3',
    label: '4:3',
    subLabelVi: 'Ngang phong cảnh',
    subLabelEn: 'Landscape',
    ratio: 4 / 3,
    cssAspect: 'aspect-[4/3]',
  },
];

export interface FilterPreset {
  id: FilterId;
  name: string;
  emoji: string;
  cssFilter: string;
  description: string;
}

export const CAMERA_FILTERS: FilterPreset[] = [
  {
    id: 'locket_skin',
    name: 'Nịnh Da',
    emoji: '💖',
    cssFilter: 'contrast(1.03) brightness(1.04) saturate(1.08) sepia(0.04) hue-rotate(-1deg)',
    description: 'Sáng hồng tự nhiên, trong trẻo, mịn & nét',
  },
  {
    id: 'original',
    name: 'Mộc',
    emoji: '📸',
    cssFilter: 'none',
    description: 'Chân thực không chỉnh màu',
  },
  {
    id: 'warm_bite',
    name: 'Ấm Ngon',
    emoji: '🍲',
    cssFilter: 'sepia(0.14) saturate(1.22) contrast(1.05) brightness(1.03)',
    description: 'Tôn màu đồ ăn & da ấm áp',
  },
  {
    id: 'fresh',
    name: 'Trong Trẻo',
    emoji: '🌿',
    cssFilter: 'brightness(1.06) contrast(1.06) saturate(1.12)',
    description: 'Tone sáng trong, tự nhiên',
  },
  {
    id: 'night_bite',
    name: 'Đêm Phố',
    emoji: '🌙',
    cssFilter: 'contrast(1.10) brightness(1.07) saturate(1.06)',
    description: 'Sáng rõ nét ban đêm',
  },
  {
    id: 'vintage',
    name: 'Vintage Film',
    emoji: '🎞️',
    cssFilter: 'contrast(1.08) brightness(1.02) saturate(0.92) sepia(0.20)',
    description: 'Hoài niệm nhẹ nhàng',
  },
];

export interface ContextualSticker {
  id: string;
  label: string;
  iconName: string;
  category: 'location' | 'milestone' | 'dish' | 'vibe';
  badgeStyle: string;
}

export function getStickersList(
  venueTitle: string | undefined,
  district: string,
  isGalleryUpload: boolean
): ContextualSticker[] {
  return [
    {
      id: 'location',
      label: venueTitle ? `📍 ${venueTitle}` : `📍 ${district}`,
      iconName: 'MapPin',
      category: 'location',
      badgeStyle: 'bg-black/75 text-white border-white/30 backdrop-blur-md',
    },
    {
      id: 'verified',
      label: isGalleryUpload ? '📸 Gallery Bite' : '✨ Verified Bite',
      iconName: isGalleryUpload ? 'Image' : 'CheckCircle2',
      category: 'milestone',
      badgeStyle: isGalleryUpload
        ? 'bg-[#FF6B35]/90 text-white border-[#FF6B35] shadow-md'
        : 'bg-[#2EC4B6]/95 text-white border-[#2EC4B6] shadow-md',
    },
    {
      id: 'pho_hunt',
      label: '🍜 Phở & Bún Hunt',
      iconName: 'Soup',
      category: 'dish',
      badgeStyle: 'bg-[#FF6B35]/90 text-white border-white/20 backdrop-blur-md',
    },
    {
      id: 'first_bite',
      label: '🥇 First Bite',
      iconName: 'Award',
      category: 'milestone',
      badgeStyle: 'bg-[#FFD166] text-[#2D2926] border-[#FFD166] font-bold shadow-md',
    },
    {
      id: 'coffee_run',
      label: '☕ Coffee Run',
      iconName: 'Coffee',
      category: 'vibe',
      badgeStyle: 'bg-[#594139]/90 text-[#FDFCF8] border-white/20 backdrop-blur-md',
    },
    {
      id: 'late_night',
      label: '🔥 Late Night Bite',
      iconName: 'Flame',
      category: 'vibe',
      badgeStyle: 'bg-[#BA1A1A]/90 text-white border-white/20 backdrop-blur-md',
    },
    {
      id: 'mlem',
      label: '😋 Mlem Mlem',
      iconName: 'Smile',
      category: 'vibe',
      badgeStyle: 'bg-white/95 text-[#2D2926] border-white/40 shadow-md',
    },
  ];
}
