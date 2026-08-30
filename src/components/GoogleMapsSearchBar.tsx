import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { getDistance } from 'geolib';
import { Place } from '../types';
import { UnifiedPlace } from '../services/maps/types';
import {
  CANONICAL_CATEGORIES,
  classifyVenue,
  normalizeCategory,
  normalizeVietnameseText,
  getVenueSearchRelevance,
} from '../services/maps/categoryNormalizer';
import {
  parseSearchIntentWithGemini,
  filterPlacesBySearchIntent,
  SearchIntent,
  isNaturalLanguageQuery,
  localIntentParser,
} from '../services/searchIntentService';
import {
  getSmartTypeaheadSuggestions,
  executeSmartSearch,
  SmartDecisionState,
} from '../services/smartSearchDecisionEngine';
import {
  TrafficRouteResult,
  analyzeTrafficRoutes,
} from '../services/maps/trafficSmartRoutingService';
import { generateLocalExplanationFallback } from '../services/decisionExplanationService';
import { SmartDecisionCard } from './SmartDecisionCard';
import { useLanguage } from '../context/LanguageContext';

export { parseSearchIntentWithGemini };

export interface SearchResultItem {
  id: string;
  type: 'venue' | 'district' | 'dish' | 'recent';
  title: string;
  subtitle?: string;
  category?: string;
  categoryGlyph?: string;
  latitude?: number;
  longitude?: number;
  zoom?: number;
  venue?: Place | UnifiedPlace;
  distanceMeters?: number;
}

interface GoogleMapsSearchBarProps {
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  places: Array<Place | UnifiedPlace>;
  currentLocation?: { latitude: number; longitude: number } | null;
  onSelectVenue: (venue: Place | UnifiedPlace) => void;
  onSelectLocation: (coords: { latitude: number; longitude: number }, zoom?: number) => void;
  onSelectCategory?: (category: string) => void;
  onOpenFilter?: () => void;
  onOpenBiteBot?: () => void;
  onOpenTraffic?: () => void;
  onOpenComparator?: (initialVenues?: (Place | UnifiedPlace)[]) => void;
  onOpenRoulette?: () => void;
  onOpenMenu?: () => void;
  onOpenNotifications?: () => void;
  userXp?: number;
  isLoading?: boolean;
}

// Popular Vietnamese cities, districts, foodie streets and landmarks for instant teleportation
export const VIETNAM_DISCOVERY_LOCATIONS: Array<{
  name: string;
  alias: string[];
  district: string;
  latitude: number;
  longitude: number;
  zoom: number;
  glyph: string;
  description: string;
}> = [
  // --- HÀ NỘI ---
  {
    name: 'Phố Cổ & Hồ Gươm',
    alias: ['hoan kiem', 'pho co', 'ho guom', 'ta hien', 'trang tien', 'dong xuan', 'hang buom', 'ha noi'],
    district: 'Hoàn Kiếm, Hà Nội',
    latitude: 21.0333,
    longitude: 105.8520,
    zoom: 15.5,
    glyph: '🏮',
    description: 'Thiên đường ẩm thực phố cổ, bún chả, cà phê trứng',
  },
  {
    name: 'Quận Cầu Giấy & Nghĩa Tân',
    alias: ['cau giay', 'nghia tan', 'duy tan', 'xuan thuy', 'tran thai tong', 'ho tung mau'],
    district: 'Cầu Giấy, Hà Nội',
    latitude: 21.0362,
    longitude: 105.7905,
    zoom: 15,
    glyph: '🍜',
    description: 'Khu ẩm thực sinh viên & văn phòng, bánh mì chảo, bún cá',
  },
  {
    name: 'Hồ Tây & Quảng An',
    alias: ['tay ho', 'ho tay', 'quang an', 'to ngoc van', 'yen phu', 'phu tay ho'],
    district: 'Tây Hồ, Hà Nội',
    latitude: 21.0583,
    longitude: 105.8239,
    zoom: 14.5,
    glyph: '🌅',
    description: 'Quán cà phê view hồ, bánh tôm, ốc nóng ven hồ',
  },
  {
    name: 'Quận Ba Đình & Giảng Võ',
    alias: ['ba dinh', 'giang vo', 'kim ma', 'doi can', 'quan thanh'],
    district: 'Ba Đình, Hà Nội',
    latitude: 21.0345,
    longitude: 105.8217,
    zoom: 15,
    glyph: '🍲',
    description: 'Phở cuốn Ngũ Xã, chè Giảng Võ, bún thang truyền thống',
  },
  {
    name: 'Quận Đống Đa & Chùa Láng',
    alias: ['dong da', 'chua lang', 'thai ha', 'xa dan', 'ton that tung', 'o cho dua'],
    district: 'Đống Đa, Hà Nội',
    latitude: 21.0181,
    longitude: 105.8260,
    zoom: 15,
    glyph: '🍢',
    description: 'Lẩu ốc, nem nướng, trà sữa Chùa Láng',
  },
  {
    name: 'Quận Hai Bà Trưng & Bách Kinh Xây',
    alias: ['hai ba trung', 'bach khoa', 'kinh te', 'xay dung', 'ba trieu', 'pho hue', 'mai hac de'],
    district: 'Hai Bà Trưng, Hà Nội',
    latitude: 21.0089,
    longitude: 105.8530,
    zoom: 15,
    glyph: '🍗',
    description: 'Thiên đường ăn vặt sinh viên, lẩu nướng vỉa hè',
  },
  {
    name: 'Quận Thanh Xuân & Nguyễn Trãi',
    alias: ['thanh xuan', 'nguyen trai', 'khuat duy tien', 'nga tu so', 'vu tong phan'],
    district: 'Thanh Xuân, Hà Nội',
    latitude: 20.9984,
    longitude: 105.8058,
    zoom: 14.5,
    glyph: '🥞',
    description: 'Bún đậu mắm tôm, bánh tráng cuốn thịt heo, lẩu bò',
  },
  {
    name: 'Quận Hà Đông & Văn Quán',
    alias: ['ha dong', 'van quan', 'mo lao', 'quang trung', 'to hieu'],
    district: 'Hà Đông, Hà Nội',
    latitude: 20.9723,
    longitude: 105.7770,
    zoom: 14.5,
    glyph: '☕',
    description: 'Cà phê bờ hồ Văn Quán, dê núi, gà nướng lu',
  },
  {
    name: 'Quận Nam Từ Liêm & Mỹ Đình',
    alias: ['nam tu liem', 'my dinh', 'me tri', 'le duc tho', 'svd my dinh'],
    district: 'Nam Từ Liêm, Hà Nội',
    latitude: 21.0189,
    longitude: 105.7663,
    zoom: 14.5,
    glyph: '🍖',
    description: 'Ẩm thực Hàn Quốc Mễ Trì, nướng ngói, bia hơi',
  },
  {
    name: 'Quận Bắc Từ Liêm & Nhổn',
    alias: ['bac tu liem', 'nhon', 'co nhue', 'cau dien', 'pham van dong'],
    district: 'Bắc Từ Liêm, Hà Nội',
    latitude: 21.0601,
    longitude: 105.7634,
    zoom: 14,
    glyph: '🥘',
    description: 'Ẩm thực bình dân, lẩu ếch măng cay',
  },
  {
    name: 'Quận Long Biên & Ngọc Lâm',
    alias: ['long bien', 'ngoc lam', 'bo de', 'nguyen van cu', 'cau chuong duong'],
    district: 'Long Biên, Hà Nội',
    latitude: 21.0450,
    longitude: 105.8850,
    zoom: 14.5,
    glyph: '🥟',
    description: 'Phố ăn đêm Ngọc Lâm, miến lươn, bánh mì cay',
  },

  // --- TP. HỒ CHÍ MINH (SÀI GÒN) ---
  {
    name: 'Trung Tâm Sài Gòn & Quận 1',
    alias: ['sai gon', 'tphcm', 'ho chi minh', 'quan 1', 'ben thanh', 'bui vien', 'nguyen hue', 'le thanh ton'],
    district: 'Quận 1, TP.HCM',
    latitude: 10.7769,
    longitude: 106.7009,
    zoom: 15,
    glyph: '🏙️',
    description: 'Bánh mì Huỳnh Hoa, ốc Đào, cà phê bệt Bến Thành',
  },
  {
    name: 'Quận 3 & Hồ Con Rùa',
    alias: ['quan 3', 'ho con rua', 'pasteur', 'vo thi sau', 'nguyen thong', 'cheo leo'],
    district: 'Quận 3, TP.HCM',
    latitude: 10.7845,
    longitude: 106.6912,
    zoom: 15,
    glyph: '☕',
    description: 'Phở Hòa Pasteur, cà phê vợt Cheo Leo, bánh xèo',
  },
  {
    name: 'Chợ Lớn & Quận 5 (Ẩm Thực Hoa)',
    alias: ['cho lon', 'quan 5', 'nguyen trai', 'hai thuong lan ong', 'chau van liem'],
    district: 'Quận 5, TP.HCM',
    latitude: 10.7540,
    longitude: 106.6660,
    zoom: 15,
    glyph: '🥟',
    description: 'Phở Lệ, sủi cảo Hà Tôn Quyền, hủ tiếu sa tế Chợ Lớn',
  },
  {
    name: 'Phú Nhuận & Phố Ẩm Thực Phan Xích Long',
    alias: ['phu nhuan', 'phan xich long', 'dang van ngu', 'hoang van thu', 'ba ghien'],
    district: 'Phú Nhuận, TP.HCM',
    latitude: 10.7960,
    longitude: 106.6850,
    zoom: 15,
    glyph: '🍖',
    description: 'Cơm tấm Ba Ghiền, thiên đường lẩu nướng Phan Xích Long',
  },

  // --- ĐÀ NẴNG ---
  {
    name: 'Đà Nẵng (Cầu Rồng & Hải Châu)',
    alias: ['da nang', 'danang', 'cau rong', 'hai chau', 'bach dang', 'nguyen tri phuong', 'my khe'],
    district: 'Hải Châu, Đà Nẵng',
    latitude: 16.0645,
    longitude: 108.2215,
    zoom: 14.5,
    glyph: '🌉',
    description: 'Mì Quảng Bà Mua, bánh tráng thịt heo Trần, bánh xèo Bà Dưỡng',
  },
  {
    name: 'Sơn Trà & Bán Đảo Biển',
    alias: ['son tra', 'hai san nam danh', 'tho quang', 'vo nguyen giap'],
    district: 'Sơn Trà, Đà Nẵng',
    latitude: 16.0965,
    longitude: 108.2430,
    zoom: 14,
    glyph: '🦀',
    description: 'Hải sản Năm Đảnh tươi sống, quán nhậu ven biển',
  },

  // --- HỘI AN ---
  {
    name: 'Phố Cổ Hội An',
    alias: ['hoi an', 'hoian', 'quang nam', 'chua cau', 'phan chu trinh', 'tran phu', 'an bang'],
    district: 'Phố Cổ Hội An, Quảng Nam',
    latitude: 15.8775,
    longitude: 108.3295,
    zoom: 15.5,
    glyph: '🏮',
    description: 'Cao lầu Thanh, cơm gà Bà Buội, bánh mì Phượng, nước Mót',
  },

  // --- HUẾ ---
  {
    name: 'Cố Đô Huế & Sông Hương',
    alias: ['hue', 'thua thien hue', 'dai noi', 'song huong', 'con hen', 'vỹ dạ', 'nguyen hue'],
    district: 'TP. Huế',
    latitude: 16.4675,
    longitude: 107.5905,
    zoom: 14.5,
    glyph: '👑',
    description: 'Bún bò Mụ Rơi, cơm hến Hoa Đông, cà phê muối Cố Đô',
  },

  // --- HẢI PHÒNG ---
  {
    name: 'Hải Phòng (Đất Cảng & Food Tour)',
    alias: ['hai phong', 'haiphong', 'dat cang', 'cau dat', 'dinh tien hoang', 'tam bac'],
    district: 'Ngô Quyền / Hồng Bàng, Hải Phòng',
    latitude: 20.8580,
    longitude: 106.6850,
    zoom: 15,
    glyph: '🚢',
    description: 'Bánh đa cua bể Bà Cụ, bánh mì cay, cà phê cốt dừa',
  },

  // --- ĐÀ LẠT ---
  {
    name: 'Đà Lạt (Xứ Sở Sương Mù)',
    alias: ['da lat', 'dalat', 'lam dong', 'ho xuan huong', 'cho da lat', 'tang bat ho', 'ba toa'],
    district: 'TP. Đà Lạt, Lâm Đồng',
    latitude: 11.9404,
    longitude: 108.4380,
    zoom: 14.5,
    glyph: '🌲',
    description: 'Lẩu gà lá é Tao Ngộ, bánh ướt lòng gà Trang, lẩu bò Ba Toa, kem bơ',
  },

  // --- NHA TRANG ---
  {
    name: 'Nha Trang (Phố Biển)',
    alias: ['nha trang', 'nhatrang', 'khanh hoa', 'tran phu', 'thap ba', 'hon chong'],
    district: 'TP. Nha Trang, Khánh Hòa',
    latitude: 12.2470,
    longitude: 109.1910,
    zoom: 14.5,
    glyph: '🏖️',
    description: 'Bún cá sứa Năm Beo, nem nướng Đặng Văn Quyên, hải sản tươi',
  },

  // --- CẦN THƠ ---
  {
    name: 'Cần Thơ (Thủ Phủ Miền Tây)',
    alias: ['can tho', 'cantho', 'ninh kieu', 'cai rang', 'tay do', 'cho noi'],
    district: 'Ninh Kiều / Cái Răng, Cần Thơ',
    latitude: 10.0340,
    longitude: 105.7850,
    zoom: 14,
    glyph: '🛶',
    description: 'Bánh xèo Bảy Tới, nem nướng Cái Răng, lẩu mắm Dạ Lý',
  },

  // --- VŨNG TÀU ---
  {
    name: 'Vũng Tàu (Bãi Sau & Bãi Trước)',
    alias: ['vung tau', 'vungtau', 'ba ria', 'bai sau', 'bai truoc', 'nguyen truong to'],
    district: 'TP. Vũng Tàu',
    latitude: 10.3470,
    longitude: 107.0780,
    zoom: 14.5,
    glyph: '🌊',
    description: 'Bánh khọt Gốc Vú Sữa, bánh bông lan trứng muối, lẩu cá đuối',
  },

  // --- NINH BÌNH ---
  {
    name: 'Ninh Bình (Tràng An & Cố Đô)',
    alias: ['ninh binh', 'ninhbinh', 'trang an', 'tam coc', 'hoa lu'],
    district: 'TP. Ninh Bình',
    latitude: 20.2560,
    longitude: 105.9750,
    zoom: 14,
    glyph: '⛰️',
    description: 'Đặc sản thịt dê núi Đức Dê, cơm cháy ruốc giòn rụm',
  },

  // --- SA PA ---
  {
    name: 'Sa Pa (Phố Núi Hoàng Liên Sơn)',
    alias: ['sa pa', 'sapa', 'lao cai', 'fansipan', 'cat cat', 'ham rong'],
    district: 'Sa Pa, Lào Cai',
    latitude: 22.3350,
    longitude: 103.8410,
    zoom: 14.5,
    glyph: '🏔️',
    description: 'Lẩu cá hồi Quán A Phủ, thắng cố, gà đen nướng mắc khén',
  },
];

// Backwards compatibility alias
export const HANOI_DISCOVERY_LOCATIONS = VIETNAM_DISCOVERY_LOCATIONS;

export interface MockIntentResult {
  category: 'cafe' | 'hotpot' | 'noodle' | 'bbq' | 'fast_food' | 'rice' | 'all';
  tag?: 'quiet' | 'dry_route' | 'aesthetic' | 'tasty_noodles' | 'spicy_noodle' | 'crispy_fast_food' | 'grilled_bbq' | 'hearty_rice' | string;
  targetTime?: number | null;
  cleanKeyword?: string;
}

/**
 * Instant Mock Intent Search Analyzer (Client-side NLP Fallback)
 * Analyzes natural language search query instantly on client-side with 0ms latency.
 */
export function mockAnalyzeIntent(query: string): MockIntentResult {
  const parsed = localIntentParser(query);
  const raw = (query || '').toLowerCase().trim();
  const norm = normalizeVietnameseText(raw);
  if (!raw) return { category: 'all', targetTime: null, cleanKeyword: '' };

  // 1. Cơm
  if (parsed.category === 'rice' || raw.includes('cơm') || norm.includes('com') || raw.includes('rice')) {
    return {
      category: 'rice',
      tag: 'hearty_rice',
      targetTime: parsed.targetTime,
      cleanKeyword: parsed.cleanKeyword,
    };
  }

  // 2. Mì cay, mì, bún, phở, miến, hủ tiếu, ramen
  if (
    parsed.category === 'noodle' ||
    raw.includes('mì cay') ||
    norm.includes('mi cay') ||
    raw.includes('mì') ||
    norm.includes('mi ') ||
    norm.endsWith('mi') ||
    raw.includes('bún') ||
    norm.includes('bun') ||
    raw.includes('phở') ||
    norm.includes('pho') ||
    raw.includes('hủ tiếu') ||
    norm.includes('hu tieu') ||
    raw.includes('miến') ||
    norm.includes('mien') ||
    raw.includes('ramen')
  ) {
    return {
      category: 'noodle',
      tag: raw.includes('mì cay') || norm.includes('mi cay') ? 'spicy_noodle' : 'tasty_noodles',
      targetTime: parsed.targetTime,
      cleanKeyword: parsed.cleanKeyword,
    };
  }

  // 3. If query includes "học" or "làm việc" or "yên tĩnh"
  if (
    raw.includes('học') ||
    norm.includes('hoc') ||
    raw.includes('làm việc') ||
    norm.includes('lam viec') ||
    raw.includes('yên tĩnh') ||
    norm.includes('yen tinh')
  ) {
    return {
      category: 'cafe',
      tag: 'quiet',
      targetTime: parsed.targetTime,
      cleanKeyword: parsed.cleanKeyword,
    };
  }

  // 4. Cafe / Cà phê / Trà
  if (
    parsed.category === 'cafe_drink' ||
    raw.includes('cafe') ||
    raw.includes('cà phê') ||
    norm.includes('ca phe') ||
    raw.includes('coffee') ||
    raw.includes('trà') ||
    norm.includes('tra ') ||
    norm.endsWith('tra') ||
    raw.includes('tea')
  ) {
    return {
      category: 'cafe',
      tag: 'quiet',
      targetTime: parsed.targetTime,
      cleanKeyword: parsed.cleanKeyword,
    };
  }

  // 5. If query includes "lẩu" or "nóng" or "tránh ngập"
  if (
    parsed.category === 'hotpot' ||
    raw.includes('lẩu') ||
    norm.includes('lau') ||
    raw.includes('nóng') ||
    norm.includes('nong') ||
    raw.includes('tránh ngập') ||
    norm.includes('tranh ngap') ||
    raw.includes('hotpot')
  ) {
    return {
      category: 'hotpot',
      tag: 'dry_route',
      targetTime: parsed.targetTime,
      cleanKeyword: parsed.cleanKeyword,
    };
  }

  // 6. If query includes "chill" or "hẹn hò"
  if (
    raw.includes('chill') ||
    raw.includes('hẹn hò') ||
    norm.includes('hen ho') ||
    raw.includes('view đẹp') ||
    norm.includes('view dep')
  ) {
    return {
      category: 'cafe',
      tag: 'aesthetic',
      targetTime: parsed.targetTime,
      cleanKeyword: parsed.cleanKeyword,
    };
  }

  // 7. Nướng / BBQ
  if (raw.includes('nướng') || norm.includes('nuong') || raw.includes('bbq')) {
    return {
      category: 'bbq',
      tag: 'grilled_bbq',
      targetTime: parsed.targetTime,
      cleanKeyword: parsed.cleanKeyword,
    };
  }

  // 8. Bánh mì / Ăn nhanh
  if (raw.includes('bánh mì') || norm.includes('banh mi') || raw.includes('burger') || raw.includes('fast food')) {
    return {
      category: 'fast_food',
      tag: 'crispy_fast_food',
      targetTime: parsed.targetTime,
      cleanKeyword: parsed.cleanKeyword,
    };
  }

  // Default
  return {
    category: 'all',
    targetTime: parsed.targetTime,
    cleanKeyword: parsed.cleanKeyword,
  };
}

// Popular culinary dishes and categories for quick filtering
const POPULAR_DISHES = [
  { title: 'Phở Bò & Phở Gà', category: 'PHO', glyph: '🍜' },
  { title: 'Bún Chả, Bún Đậu & Mì', category: 'NOODLE', glyph: '🥗' },
  { title: 'Cà Phê Trứng & Trà Quán', category: 'CAFE_DRINK', glyph: '☕' },
  { title: 'Bánh Mì & Ăn Nhanh', category: 'FAST_FOOD', glyph: '🥖' },
  { title: 'Lẩu Nóng & BBQ Nướng', category: 'HOTPOT', glyph: '🍲' },
  { title: 'Chè & Tráng Miệng', category: 'BAKERY_DESSERT', glyph: '🍧' },
  { title: 'Cơm Tấm & Cơm Niêu', category: 'RICE', glyph: '🍚' },
  { title: 'Bia Hơi & Quán Nhậu', category: 'BAR_BEER', glyph: '🍺' },
  { title: 'Quán Chay Thanh Tịnh', category: 'VEGETARIAN', glyph: '🌱' },
];

const RECENT_SEARCHES_KEY = 'bitequest_recent_searches_v2';

export const GoogleMapsSearchBar: React.FC<GoogleMapsSearchBarProps> = ({
  searchQuery,
  onSearchQueryChange,
  places,
  currentLocation,
  onSelectVenue,
  onSelectLocation,
  onSelectCategory,
  onOpenFilter,
  onOpenBiteBot,
  onOpenTraffic,
  onOpenComparator,
  onOpenRoulette,
  onOpenMenu,
  onOpenNotifications,
  userXp,
  isLoading = false,
}) => {
  const { isVi } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const [parsedIntent, setParsedIntent] = useState<SearchIntent | null>(null);
  const [smartDecision, setSmartDecision] = useState<SmartDecisionState | null>(null);
  const [isExecutingDecision, setIsExecutingDecision] = useState<boolean>(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isTopCardCollapsed, setIsTopCardCollapsed] = useState<boolean>(false);
  const [expandedVenueId, setExpandedVenueId] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);

  // Reset expanded sub-cards and top collapse when search query changes
  useEffect(() => {
    setExpandedVenueId(null);
    setIsTopCardCollapsed(false);
  }, [searchQuery]);

  // Synchronous mock intent analysis for immediate instant UI update
  const instantMockIntent = useMemo(() => mockAnalyzeIntent(searchQuery), [searchQuery]);

  // Smart Typeahead Auto-complete Suggestions (for rich natural language queries)
  const typeaheadSuggestions = useMemo(() => getSmartTypeaheadSuggestions(searchQuery), [searchQuery]);

  // Helper to build real explainable routing decision state for any venue in the list
  const getVenueDecisionState = (item: SearchResultItem): SmartDecisionState | null => {
    if (!item.venue) return null;
    const v = item.venue;
    const localIntent = localIntentParser(searchQuery);
    const dayType = new Date().getDay() === 0 || new Date().getDay() === 6 ? 'weekend' : 'weekday';
    const targetHour = localIntent.targetTime ?? new Date().getHours();

    // Check if it already exists in smartDecision.allRoutes
    const existingRoute = smartDecision?.allRoutes?.find((r) => r.place.id === v.id);

    const currentRoute: TrafficRouteResult = existingRoute || analyzeTrafficRoutes({
      userLocation: currentLocation || { latitude: 21.0278, longitude: 105.8342 },
      targetHour,
      dayType,
      places: [v as Place],
    })[0];

    const distKm = Number((currentRoute.distanceMeters / 1000).toFixed(1)) || 0.8;
    const durationMins = currentRoute.estimatedDurationMinutes;

    const optionPayload = {
      name: v.name,
      durationMins,
      distanceKm: distKm,
      trafficLevel: currentRoute.trafficLevel === 'smooth' ? ('Low' as const) : currentRoute.trafficLevel === 'moderate' ? ('Moderate' as const) : ('High' as const),
      floodRisk: currentRoute.weatherFlood?.routeFloodRisk === 'high_flood' ? ('High' as const) : ('Low' as const),
      address: v.address || v.district || '',
      category: v.category || '',
    };

    const explanation = generateLocalExplanationFallback(
      [optionPayload],
      optionPayload,
      {
        rawQuery: searchQuery,
        targetHour,
        timeLabel: localIntent.timeLabel,
        timeContext: localIntent.timeContext,
        dayType,
        dishCategory: localIntent.category,
        isDifferent: false,
      }
    );

    return {
      bestRoute: currentRoute,
      closestRoute: currentRoute,
      isDifferent: false,
      explanation,
      rawQuery: searchQuery,
      evaluatedPlacesCount: 1,
      allRoutes: smartDecision?.allRoutes || [currentRoute],
    };
  };

  // Execute real decision engine pipeline (Intent -> Filter -> Traffic Routing -> Gemini Reasoning)
  const runDecisionEngine = async (queryText: string) => {
    const trimmed = queryText.trim();
    if (!trimmed || trimmed.length < 3) {
      setSmartDecision(null);
      return;
    }

    // Only run smart decision engine if matched a smart intent scenario
    const intent = mockAnalyzeIntent(trimmed);
    if (intent.category === 'all') {
      setSmartDecision(null);
      return;
    }

    setIsExecutingDecision(true);
    try {
      const decision = await executeSmartSearch({
        query: trimmed,
        places: places as Place[],
        userLocation: currentLocation,
      });
      setSmartDecision(decision);
    } catch {
      setSmartDecision(null);
    } finally {
      setIsExecutingDecision(false);
    }
  };

  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(RECENT_SEARCHES_KEY);
      return saved ? JSON.parse(saved) : ['Phở Bò', 'Cà Phê Trứng', 'Cầu Giấy', 'Hồ Tây'];
    } catch {
      return ['Phở Bò', 'Cà Phê Trứng', 'Cầu Giấy'];
    }
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Voice Search / Speech Recognition handler
  const handleToggleVoiceSearch = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setSpeechError('Trình duyệt chưa hỗ trợ tìm kiếm bằng giọng nói.');
      setTimeout(() => setSpeechError(null), 3000);
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'vi-VN';
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onstart = () => {
        setIsListening(true);
        setSpeechError(null);
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          onSearchQueryChange(transcript);
          saveRecentSearch(transcript);
          setIsOpen(true);
        }
        setIsListening(false);
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition error:', event.error);
        if (event.error !== 'no-speech') {
          setSpeechError('Không nhận diện được giọng nói. Vui lòng thử lại!');
          setTimeout(() => setSpeechError(null), 3000);
        }
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.warn('Failed to start speech recognition', err);
      setIsListening(false);
    }
  };

  // Save query to recent searches
  const saveRecentSearch = (query: string) => {
    const trimmed = query.trim();
    if (!trimmed) return;
    setRecentSearches((prev) => {
      const next = [trimmed, ...prev.filter((item) => item.toLowerCase() !== trimmed.toLowerCase())].slice(0, 6);
      try {
        localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const removeRecentSearch = (e: React.MouseEvent, query: string) => {
    e.stopPropagation();
    setRecentSearches((prev) => {
      const next = prev.filter((item) => item !== query);
      try {
        localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Compute matched items for autocomplete
  const normalizedQuery = searchQuery.trim().toLowerCase();

  const computedSearchResults = useMemo(() => {
    if (!normalizedQuery) {
      return [];
    }

    const results: SearchResultItem[] = [];
    const qRaw = searchQuery.trim().toLowerCase();
    const qNorm = normalizeVietnameseText(qRaw);

    // 1. Match Districts & Landmarks
    for (const loc of VIETNAM_DISCOVERY_LOCATIONS) {
      const matchName = loc.name.toLowerCase().includes(qRaw) || normalizeVietnameseText(loc.name).includes(qNorm);
      const matchDistrict = loc.district.toLowerCase().includes(qRaw) || normalizeVietnameseText(loc.district).includes(qNorm);
      const matchAlias = loc.alias.some((a) => a.includes(qNorm) || qNorm.includes(a));

      if (matchName || matchDistrict || matchAlias) {
        results.push({
          id: `loc_${loc.district}_${loc.name}`,
          type: 'district',
          title: loc.name,
          subtitle: `${loc.district} • ${loc.description}`,
          categoryGlyph: loc.glyph,
          latitude: loc.latitude,
          longitude: loc.longitude,
          zoom: loc.zoom,
        });
      }
    }

    // 2. Match Dishes & Categories
    for (const dish of POPULAR_DISHES) {
      const matchTitle = dish.title.toLowerCase().includes(qRaw) || normalizeVietnameseText(dish.title).includes(qNorm);
      const matchCategory = dish.category.toLowerCase().includes(qNorm);
      if (matchTitle || matchCategory) {
        results.push({
          id: `dish_${dish.category}_${dish.title}`,
          type: 'dish',
          title: dish.title,
          subtitle: 'Danh mục món ăn phổ biến',
          category: dish.category,
          categoryGlyph: dish.glyph,
        });
      }
    }

    // 3. Match Specific Venues with Deduplication & Smart Relevance Scoring
    const venueCandidates: Array<{
      item: SearchResultItem;
      score: number;
      dist: number;
      normName: string;
      latKey: number;
      lngKey: number;
    }> = [];

    // 3a. Instant Mock Intent Filter (0ms Latency - Emergency Demo Hack)
    if (instantMockIntent.category !== 'all') {
      const isCafe = instantMockIntent.category === 'cafe';
      const isHotpot = instantMockIntent.category === 'hotpot';
      const isNoodle = instantMockIntent.category === 'noodle';
      const isBbq = instantMockIntent.category === 'bbq';
      const isFastFood = instantMockIntent.category === 'fast_food';
      const isRice = instantMockIntent.category === 'rice';

      const mockMatches = places.filter((p) => {
        if (!p || typeof p.latitude !== 'number' || typeof p.longitude !== 'number') return false;
        const norm = normalizeCategory(p);
        const name = (p.name || '').toLowerCase();
        const catLabel = (p.categoryLabel || '').toLowerCase();

        if (isRice) {
          return (
            norm === 'RICE' ||
            catLabel.includes('cơm') ||
            catLabel.includes('rice') ||
            name.includes('cơm') ||
            name.includes('com') ||
            name.includes('rice')
          );
        }

        if (isNoodle) {
          return (
            norm === 'NOODLE' ||
            norm === 'PHO' ||
            catLabel.includes('mì') ||
            catLabel.includes('bún') ||
            catLabel.includes('phở') ||
            catLabel.includes('noodle') ||
            name.includes('mì') ||
            name.includes('bún') ||
            name.includes('phở') ||
            name.includes('cay') ||
            name.includes('ramen')
          );
        }

        if (isCafe) {
          return (
            norm === 'CAFE_DRINK' ||
            catLabel.includes('cà phê') ||
            catLabel.includes('cafe') ||
            catLabel.includes('trà') ||
            catLabel.includes('coffee') ||
            name.includes('cafe') ||
            name.includes('cà phê') ||
            name.includes('trà') ||
            name.includes('coffee') ||
            name.includes('blackbird') ||
            name.includes('aha') ||
            name.includes('highlands') ||
            name.includes('all day')
          );
        }

        if (isHotpot) {
          return (
            norm === 'HOTPOT' ||
            catLabel.includes('lẩu') ||
            catLabel.includes('hotpot') ||
            name.includes('lẩu') ||
            name.includes('hotpot') ||
            name.includes('manwah') ||
            name.includes('kichi') ||
            name.includes('haidilao') ||
            name.includes('555')
          );
        }

        if (isBbq) {
          return (
            norm === 'BBQ' ||
            catLabel.includes('nướng') ||
            catLabel.includes('bbq') ||
            name.includes('nướng') ||
            name.includes('bbq')
          );
        }

        if (isFastFood) {
          return (
            norm === 'FAST_FOOD' ||
            catLabel.includes('bánh mì') ||
            catLabel.includes('burger') ||
            name.includes('bánh mì') ||
            name.includes('burger')
          );
        }

        return false;
      });

      for (const p of mockMatches) {
        const classification = classifyVenue({
          name: p.name,
          category: p.category,
          categoryLabel: p.categoryLabel,
        });
        const catMeta = CANONICAL_CATEGORIES[classification.category] || CANONICAL_CATEGORIES.RESTAURANT;

        let distanceMeters: number | undefined;
        if (currentLocation) {
          distanceMeters = getDistance(currentLocation, { latitude: p.latitude, longitude: p.longitude });
        }

        let smartBadge = '';
        if (instantMockIntent.tag === 'hearty_rice') smartBadge = '🍚 Cơm tấm, Cơm sườn & Cơm niêu';
        else if (instantMockIntent.tag === 'spicy_noodle') smartBadge = '🍜 Mì cay & Mì bún nóng hổi';
        else if (instantMockIntent.tag === 'tasty_noodles') smartBadge = '🍜 Bún, Phở & Mì đặc sản';
        else if (instantMockIntent.tag === 'quiet') smartBadge = '📚 Yên tĩnh • Phù hợp học & làm việc';
        else if (instantMockIntent.tag === 'dry_route') smartBadge = '🍲 Lẩu nóng • Tuyến đường tránh ngập';
        else if (instantMockIntent.tag === 'aesthetic') smartBadge = '✨ Không gian chill • Hẹn hò lý tưởng';
        else if (instantMockIntent.tag === 'grilled_bbq') smartBadge = '🥩 Thịt nướng thơm lừng • BBQ hấp dẫn';
        else if (instantMockIntent.tag === 'crispy_fast_food') smartBadge = '🥖 Bánh mì & Ăn nhanh tiện lợi';

        const cleanAddressParts: string[] = [];
        if (smartBadge) cleanAddressParts.push(smartBadge);
        const rawAddr = (p.address || '').trim();
        const rawDistrict = (p.district || '').trim();
        if (rawAddr && rawAddr !== 'Hà Nội' && rawAddr !== 'Hà Nội, Hà Nội') {
          const firstPart = rawAddr.split(',')[0].trim();
          if (firstPart) cleanAddressParts.push(firstPart);
        } else if (rawDistrict) {
          cleanAddressParts.push(rawDistrict);
        }

        const subtitle = cleanAddressParts.join(' • ');
        const normName = normalizeVietnameseText(p.name || '');
        const latKey = Math.round(p.latitude * 2500);
        const lngKey = Math.round(p.longitude * 2500);

        venueCandidates.push({
          item: {
            id: `venue_${p.id}`,
            type: 'venue',
            title: p.name,
            subtitle,
            category: classification.category,
            categoryGlyph: catMeta.symbolGlyph || '🍴',
            latitude: p.latitude,
            longitude: p.longitude,
            venue: p,
            distanceMeters,
          },
          score: 5000,
          dist: distanceMeters ?? 999999,
          normName,
          latKey,
          lngKey,
        });
      }
    }

    // 3b. AI Intent-Matched Venues (Smart Natural Language Intent Filtering)
    if (parsedIntent && (parsedIntent.category !== 'any' || parsedIntent.vibe !== 'any' || parsedIntent.maxDistanceKm < 50)) {
      const intentRanked = filterPlacesBySearchIntent(places, parsedIntent, currentLocation);
      for (const cand of intentRanked) {
        const p = cand.venue;
        const classification = classifyVenue({
          name: p.name,
          category: p.category,
          categoryLabel: p.categoryLabel,
        });
        const catMeta = CANONICAL_CATEGORIES[classification.category] || CANONICAL_CATEGORIES.RESTAURANT;

        const cleanAddressParts: string[] = [];
        const rawAddr = (p.address || '').trim();
        const rawDistrict = (p.district || '').trim();

        if (rawAddr && rawAddr !== 'Hà Nội' && rawAddr !== 'Hà Nội, Hà Nội') {
          const firstPart = rawAddr.split(',')[0].trim();
          if (firstPart) cleanAddressParts.push(firstPart);
        }
        if (rawDistrict && !cleanAddressParts.includes(rawDistrict)) {
          cleanAddressParts.push(rawDistrict);
        }
        if (cleanAddressParts.length === 0) {
          cleanAddressParts.push('Hà Nội');
        }

        const subtitle = cleanAddressParts.join(' • ');
        const normName = normalizeVietnameseText(p.name || '');
        const latKey = Math.round(p.latitude * 2500);
        const lngKey = Math.round(p.longitude * 2500);

        venueCandidates.push({
          item: {
            id: `venue_${p.id}`,
            type: 'venue',
            title: p.name,
            subtitle,
            category: classification.category,
            categoryGlyph: catMeta.symbolGlyph || '🍴',
            latitude: p.latitude,
            longitude: p.longitude,
            venue: p,
            distanceMeters: cand.distanceMeters,
          },
          score: 1000 + cand.score,
          dist: cand.distanceMeters ?? 999999,
          normName,
          latKey,
          lngKey,
        });
      }
    }

    // 3b. Standard Text / Keyword Search Scoring (Fallback & Exact Match)
    for (const p of places) {
      if (!p || typeof p.latitude !== 'number' || typeof p.longitude !== 'number') continue;

      let distanceMeters: number | undefined;
      if (currentLocation) {
        distanceMeters = getDistance(currentLocation, { latitude: p.latitude, longitude: p.longitude });
      }

      const score = getVenueSearchRelevance(p, searchQuery, distanceMeters);
      if (score > 0) {
        const classification = classifyVenue({
          name: p.name,
          category: p.category,
          categoryLabel: p.categoryLabel,
        });
        const catMeta = CANONICAL_CATEGORIES[classification.category] || CANONICAL_CATEGORIES.RESTAURANT;

        // Clean up subtitle to avoid redundant repetitive strings
        const cleanAddressParts: string[] = [];
        const rawAddr = (p.address || '').trim();
        const rawDistrict = (p.district || '').trim();

        if (rawAddr && rawAddr !== 'Hà Nội' && rawAddr !== 'Hà Nội, Hà Nội') {
          const firstPart = rawAddr.split(',')[0].trim();
          if (firstPart) cleanAddressParts.push(firstPart);
        }
        if (rawDistrict && !cleanAddressParts.includes(rawDistrict)) {
          cleanAddressParts.push(rawDistrict);
        }
        if (cleanAddressParts.length === 0) {
          cleanAddressParts.push('Hà Nội');
        }

        const subtitle = cleanAddressParts.join(' • ');
        const normName = normalizeVietnameseText(p.name || '');
        const latKey = Math.round(p.latitude * 2500);
        const lngKey = Math.round(p.longitude * 2500);

        venueCandidates.push({
          item: {
            id: `venue_${p.id}`,
            type: 'venue',
            title: p.name,
            subtitle,
            category: classification.category,
            categoryGlyph: catMeta.symbolGlyph || '🍴',
            latitude: p.latitude,
            longitude: p.longitude,
            venue: p,
            distanceMeters,
          },
          score,
          dist: distanceMeters ?? 999999,
          normName,
          latKey,
          lngKey,
        });
      }
    }

    // Sort by relevance score desc, then by distance asc
    venueCandidates.sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return a.dist - b.dist;
    });

    // Deduplicate candidates (by ID and by Name + Geo Grid)
    const seenGeoKeys = new Set<string>();
    const seenIds = new Set<string>();
    const topVenues: SearchResultItem[] = [];

    for (const cand of venueCandidates) {
      if (seenIds.has(cand.item.id)) continue;
      const geoKey = `${cand.normName}_${cand.latKey}_${cand.lngKey}`;
      if (seenGeoKeys.has(geoKey)) continue;

      seenIds.add(cand.item.id);
      seenGeoKeys.add(geoKey);
      topVenues.push(cand.item);

      if (topVenues.length >= 10) break;
    }

    results.push(...topVenues);

    return results;
  }, [normalizedQuery, searchQuery, places, currentLocation, parsedIntent, instantMockIntent]);

  // Debounced background decision engine & NLP intent analysis (without circular dependency)
  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      setIsSearching(false);
      setParsedIntent(null);
      setSmartDecision(null);
      return;
    }

    let isMounted = true;
    setIsSearching(true);

    const timer = setTimeout(async () => {
      if (!isMounted) return;

      try {
        // 1. Natural Language Intent parsing if needed
        if (isNaturalLanguageQuery(trimmed)) {
          try {
            const intent = await parseSearchIntentWithGemini(trimmed);
            if (isMounted && intent) {
              setParsedIntent(intent);
            }
          } catch {
            // Intent fallback already handled in service
          }
        }

        // 2. Trigger Real Decision Engine Pipeline if matched smart scenario
        if (isMounted) {
          await runDecisionEngine(trimmed);
        }
      } catch (err) {
        console.warn('Search execution error:', err);
      } finally {
        if (isMounted) {
          setIsSearching(false);
        }
      }
    }, 250);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [searchQuery]);

  const handleSelectResult = (item: SearchResultItem) => {
    saveRecentSearch(item.title);
    setIsOpen(false);

    if (item.type === 'venue' && item.venue) {
      onSelectVenue(item.venue);
      onSearchQueryChange(item.title);
    } else if (item.type === 'district' && typeof item.latitude === 'number' && typeof item.longitude === 'number') {
      onSelectLocation({ latitude: item.latitude, longitude: item.longitude }, item.zoom || 15);
      onSearchQueryChange('');
    } else if (item.type === 'dish' && item.category && onSelectCategory) {
      onSelectCategory(item.category);
      onSearchQueryChange('');
    }
  };

  const handleRecentClick = (query: string) => {
    onSearchQueryChange(query);
    setIsOpen(true);
  };

  return (
    <div ref={containerRef} className="relative w-full" id="google-maps-search-container">
      {/* 1. Main Floating Search Bar Card */}
      <div className={`bg-white/98 backdrop-blur-md rounded-2xl h-12 px-3 flex items-center gap-2 shadow-[0_4px_20px_rgba(45,41,38,0.12)] border transition-all ${
        isListening
          ? 'border-red-500 ring-2 ring-red-500/25 bg-red-50/20'
          : 'border-stone-200/90 hover:border-stone-300 focus-within:border-[#FF6B35] focus-within:ring-2 focus-within:ring-[#FF6B35]/20'
      }`}>
        {/* Left: Food / Map Pin Icon */}
        <div className="w-7 h-7 rounded-full bg-[#FF6B35]/10 flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined text-[17px] text-[#FF6B35]">search</span>
        </div>

        {/* Search Input */}
        <input
          ref={inputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => {
            const val = e.target.value;
            // Instant mock intent trigger
            mockAnalyzeIntent(val);
            onSearchQueryChange(val);
            if (!isOpen) setIsOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              const firstMatch = computedSearchResults[0];
              if (firstMatch) {
                handleSelectResult(firstMatch);
              } else {
                setIsOpen(false);
              }
            }
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={
            isListening
              ? isVi
                ? 'Đang lắng nghe giọng nói...'
                : 'Listening to your voice...'
              : isVi
              ? 'Bạn muốn đi đâu? (VD: Phở, Cà phê...)'
              : 'Where do you want to go? (e.g., Pho, Cafe...)'
          }
          className="bg-transparent border-none focus:outline-none w-full min-w-0 text-[13.5px] font-heading font-medium text-stone-800 placeholder:text-stone-400"
          id="input-google-maps-search"
          autoComplete="off"
          aria-label={isVi ? 'Tìm kiếm trên BiteQuest' : 'Search on BiteQuest'}
        />

        {/* Clear Button */}
        {searchQuery ? (
          <button
            type="button"
            onClick={() => {
              onSearchQueryChange('');
              inputRef.current?.focus();
            }}
            className="w-6 h-6 rounded-full bg-stone-100 hover:bg-stone-200 flex items-center justify-center text-xs text-stone-600 transition-colors shrink-0 cursor-pointer"
            aria-label={isVi ? 'Xóa tìm kiếm' : 'Clear search'}
            title={isVi ? 'Xóa nội dung' : 'Clear query'}
          >
            ✕
          </button>
        ) : null}

        {/* Microphone Voice Search Button */}
        <button
          type="button"
          onClick={handleToggleVoiceSearch}
          className={`w-8 h-8 rounded-full flex items-center justify-center transition-all active:scale-95 shrink-0 cursor-pointer ${
            isListening
              ? 'bg-red-500 text-white animate-pulse shadow-xs shadow-red-500/50'
              : 'hover:bg-stone-100 text-stone-500 hover:text-stone-800'
          }`}
          title={
            isListening
              ? isVi
                ? 'Dừng ghi âm'
                : 'Stop recording'
              : isVi
              ? 'Tìm kiếm bằng giọng nói'
              : 'Voice search'
          }
          aria-label={isVi ? 'Tìm bằng giọng nói' : 'Voice search'}
          id="btn-voice-search"
        >
          <span className="material-symbols-outlined text-[19px]">
            {isListening ? 'mic' : 'mic_none'}
          </span>
        </button>
      </div>

      {/* Speech Error Banner */}
      {speechError && (
        <div className="absolute top-[calc(100%+4px)] left-0 right-0 z-50 bg-rose-50 border border-rose-200 text-rose-700 text-xs px-3 py-1.5 rounded-xl shadow-md animate-fade-in flex items-center justify-between">
          <span>⚠️ {speechError}</span>
          <button onClick={() => setSpeechError(null)} className="text-rose-500 hover:text-rose-800 text-xs">✕</button>
        </div>
      )}

      {/* 2. Google Maps-Style Autocomplete & Suggestion Dropdown */}
      {isOpen && (
        <div
          className="absolute top-[calc(100%+6px)] left-0 right-0 z-50 bg-white rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.15)] border border-stone-200/90 overflow-hidden max-h-[75vh] flex flex-col animate-fade-in"
          id="google-maps-autocomplete-dropdown"
        >
          {/* Quick Smart Actions Header - Gracefully hidden when user enters query or scrolls */}
          {!normalizedQuery && (
            <div className="p-2 bg-gradient-to-r from-stone-50 via-white to-stone-50 border-b border-stone-100 flex items-center gap-1.5 overflow-x-auto no-scrollbar transition-all duration-300 animate-fade-in">
              {onOpenRoulette && (
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    onOpenRoulette();
                  }}
                  className="px-2.5 py-1 rounded-lg bg-orange-50 hover:bg-orange-100 text-orange-950 border border-orange-200 text-[11px] font-heading font-bold flex items-center gap-1 shrink-0 transition-colors cursor-pointer"
                >
                  <span>🎲</span>
                  <span>{isVi ? 'Hôm nay ăn gì?' : 'What to eat today?'}</span>
                </button>
              )}

              {onOpenTraffic && (
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    onOpenTraffic();
                  }}
                  className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-[11px] font-heading font-bold flex items-center gap-1 shrink-0 transition-colors cursor-pointer"
                >
                  <span>🚦</span>
                  <span>{isVi ? 'Né tắc đường' : 'Avoid traffic'}</span>
                </button>
              )}

              {onOpenComparator && (
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    onOpenComparator();
                  }}
                  className="px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-[11px] font-heading font-bold flex items-center gap-1 shrink-0 transition-colors cursor-pointer"
                >
                  <span>⚖️</span>
                  <span>{isVi ? 'So sánh các quán' : 'Compare venues'}</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  onSearchQueryChange(isVi ? 'Phở' : 'Pho');
                  setIsOpen(true);
                }}
                className="px-2.5 py-1 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 text-[11px] font-heading font-medium shrink-0 transition-colors cursor-pointer"
              >
                {isVi ? '🍜 Phở ngon' : '🍜 Delicious Pho'}
              </button>

              <button
                type="button"
                onClick={() => {
                  onSearchQueryChange(isVi ? 'Cà phê' : 'Coffee');
                  setIsOpen(true);
                }}
                className="px-2.5 py-1 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 text-[11px] font-heading font-medium shrink-0 transition-colors cursor-pointer"
              >
                {isVi ? '☕ Cà phê view đẹp' : '☕ Scenic Coffee'}
              </button>
            </div>
          )}

          {/* Scrollable Suggestion Body */}
          <div className="overflow-y-auto no-scrollbar py-2 divide-y divide-stone-100">
            {/* Smart Typeahead Autocomplete Suggestions (Rich Contextual Prompts) - Hidden when active query */}
            {!normalizedQuery && typeaheadSuggestions.length > 0 && (
              <div className="py-2 px-3 bg-amber-50/40 border-b border-amber-100/70 transition-all duration-300 animate-fade-in">
                <div className="flex items-center gap-1 text-[10.5px] font-heading font-bold text-amber-900 uppercase tracking-wider mb-1.5">
                  <span>💡</span>
                  <span>{isVi ? 'Gợi ý tìm kiếm theo ngữ cảnh' : 'Contextual search prompts'}</span>
                </div>
                <div className="flex flex-col gap-1">
                  {typeaheadSuggestions.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => {
                        onSearchQueryChange(prompt);
                        runDecisionEngine(prompt);
                      }}
                      className="text-left px-2.5 py-1.5 rounded-xl bg-white hover:bg-amber-100/60 border border-amber-200/80 text-[12px] font-heading font-medium text-stone-800 flex items-center gap-2 transition-all cursor-pointer group shadow-2xs"
                    >
                      <span className="text-amber-500 group-hover:translate-x-0.5 transition-transform text-xs">✨</span>
                      <span className="truncate flex-1">{prompt}</span>
                      <span className="text-[10px] text-amber-700 bg-amber-100/80 px-1.5 py-0.5 rounded-md font-bold shrink-0">
                        {isVi ? 'Tìm ngay' : 'Search'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Case A: Active Search Results or Loading State */}
            {normalizedQuery ? (
              computedSearchResults.length > 0 ? (
                <div className="py-1">
                  {/* Real-time Explainable Decision Engine Result Card (Top Highlighted Route) */}
                  {smartDecision && (
                    !isTopCardCollapsed ? (
                      <SmartDecisionCard
                        decision={smartDecision}
                        onSelectVenue={(venue) => {
                          handleSelectResult({
                            id: `venue_${venue.id}`,
                            type: 'venue',
                            title: venue.name,
                            subtitle: venue.address || venue.district,
                            latitude: venue.latitude,
                            longitude: venue.longitude,
                            venue,
                          });
                        }}
                        isLoading={isExecutingDecision}
                        onToggleCollapse={() => setIsTopCardCollapsed(true)}
                      />
                    ) : (
                      <div
                        onClick={() => setIsTopCardCollapsed(false)}
                        className="mx-3.5 my-2 px-3.5 py-2.5 rounded-xl bg-amber-50/90 hover:bg-amber-100 border border-amber-200 text-stone-800 flex items-center justify-between cursor-pointer transition-all shadow-2xs group"
                        title={isVi ? 'Bấm để mở lại phân tích lộ trình chi tiết' : 'Click to expand detailed route analysis'}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-xs">🧠</span>
                          <span className="text-[12.5px] font-heading font-bold text-amber-950 truncate">
                            {isVi ? 'Đề xuất:' : 'Suggestion:'} {smartDecision.bestRoute.place.name}
                          </span>
                          <span className="text-[10px] bg-emerald-100 border border-emerald-300 text-emerald-800 font-bold px-1.5 py-0.2 rounded-full shrink-0">
                            {isVi ? 'Độ tin cậy' : 'Confidence'} {smartDecision.explanation?.confidenceScore ?? 94}%
                          </span>
                        </div>
                        <div className="flex items-center gap-1 text-[11px] font-heading font-bold text-amber-800 shrink-0 group-hover:translate-y-0.5 transition-transform">
                          <span>{isVi ? 'Mở chi tiết' : 'Details'}</span>
                          <ChevronDown className="w-3.5 h-3.5 stroke-[2.5]" />
                        </div>
                      </div>
                    )
                  )}

                  <div className="px-3.5 py-1 text-[11px] font-heading font-bold text-stone-400 uppercase tracking-wider flex items-center justify-between">
                    <span>
                      {isVi
                        ? `Kết quả gợi ý (${computedSearchResults.length})`
                        : `Suggested results (${computedSearchResults.length})`}
                    </span>
                    {isExecutingDecision && (
                      <span className="text-[10px] text-[#FF6B35] font-normal flex items-center gap-1">
                        <span className="animate-spin text-[9px]">🧭</span>{' '}
                        {isVi ? 'Đang tối ưu tuyến đường...' : 'Optimizing route...'}
                      </span>
                    )}
                  </div>
                  {computedSearchResults
                    .filter((item) => !smartDecision || item.venue?.id !== smartDecision.bestRoute.place.id)
                    .map((item) => {
                    const isExpanded = expandedVenueId === item.id;
                    const venueDecision = isExpanded && item.venue ? getVenueDecisionState(item) : null;

                    if (isExpanded && venueDecision) {
                      return (
                        <div key={item.id} className="relative transition-all">
                          <SmartDecisionCard
                            decision={venueDecision}
                            onSelectVenue={() => handleSelectResult(item)}
                            onToggleCollapse={() => setExpandedVenueId(null)}
                            customBadgeTitle={isVi ? 'Phân tích tuyến đường & an toàn' : 'Route & Safety Analysis'}
                          />
                        </div>
                      );
                    }

                    return (
                      <div
                        key={item.id}
                        className="w-full px-3.5 py-2 flex items-center justify-between hover:bg-stone-50 text-left transition-colors group cursor-pointer"
                        onClick={() => {
                          if (item.type === 'venue' && item.venue) {
                            setExpandedVenueId(item.id);
                          } else {
                            handleSelectResult(item);
                          }
                        }}
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="w-8 h-8 rounded-full bg-stone-100 flex items-center justify-center text-sm shrink-0 text-stone-700">
                            {item.categoryGlyph || (item.type === 'district' ? '📍' : '🍽️')}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-[13px] font-heading font-semibold text-stone-900 truncate">
                                {item.title}
                              </span>
                              {item.type === 'district' && (
                                <span className="px-1.5 py-0.2 rounded text-[10px] font-heading font-bold bg-blue-50 text-blue-600 shrink-0">
                                  {isVi ? 'Khu vực' : 'District'}
                                </span>
                              )}
                              {item.type === 'dish' && (
                                <span className="px-1.5 py-0.2 rounded text-[10px] font-heading font-bold bg-amber-50 text-amber-700 shrink-0">
                                  {isVi ? 'Món ngon' : 'Dish'}
                                </span>
                              )}
                            </div>
                            {item.subtitle && (
                              <p className="text-[11.5px] text-stone-500 truncate mt-0.5">{item.subtitle}</p>
                            )}
                          </div>
                        </div>

                        {/* Right actions: Distance, Compare & Expand Chevron */}
                        <div className="flex items-center gap-1.5 shrink-0 ml-2">
                          {typeof item.distanceMeters === 'number' && (
                            <span className="text-[11px] font-medium text-[#FF6B35] font-heading">
                              {item.distanceMeters < 1000
                                ? `${item.distanceMeters}m`
                                : `${(item.distanceMeters / 1000).toFixed(1)}km`}
                            </span>
                          )}

                          {item.type === 'venue' && item.venue && onOpenComparator && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setIsOpen(false);
                                onOpenComparator([item.venue!]);
                              }}
                              className="px-2 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 text-[10.5px] font-heading font-bold border border-amber-200 transition-all cursor-pointer"
                              title={isVi ? 'Thêm vào bảng so sánh' : 'Add to comparator'}
                            >
                              ⚖️ {isVi ? 'So sánh' : 'Compare'}
                            </button>
                          )}

                          {item.type === 'venue' && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setExpandedVenueId(item.id);
                              }}
                              className="p-1 rounded-lg hover:bg-stone-200/80 text-stone-500 hover:text-stone-900 transition-colors flex items-center gap-0.5 text-[10.5px] font-heading cursor-pointer"
                              title={isVi ? 'Bấm để xem đầy đủ chi tiết tuyến đường' : 'Click to view complete route details'}
                            >
                              <ChevronDown className="w-4 h-4 stroke-[2.2]" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : isSearching || isExecutingDecision ? (
                <div className="py-8 px-4 flex flex-col items-center justify-center text-center animate-pulse" id="ai-search-loading-indicator">
                  <div className="w-12 h-12 rounded-2xl bg-orange-50 border border-orange-200 flex items-center justify-center text-2xl shadow-sm mb-3">
                    <span className="animate-spin text-xl">🧭</span>
                  </div>
                  <p className="text-xs font-heading font-bold text-[#FF6B35]">
                    {isVi ? 'BiteQuest đang phân tích lộ trình & thời tiết...' : 'BiteQuest is analyzing route & weather...'}
                  </p>
                  <p className="text-[11px] text-stone-400 mt-1">
                    {isVi
                      ? 'Đang tính toán tuyến đường khô ráo & giao thông thời gian thực'
                      : 'Calculating dry routes & real-time traffic conditions'}
                  </p>
                </div>
              ) : (
                <div className="py-6 px-4 text-center">
                  <span className="text-2xl">🔍</span>
                  <p className="text-xs font-heading font-semibold text-stone-700 mt-2">
                    {isVi ? `Không tìm thấy kết quả cho "${searchQuery}"` : `No results found for "${searchQuery}"`}
                  </p>
                  <p className="text-[11px] text-stone-500 mt-1">
                    {isVi
                      ? 'Thử tìm theo tên món (Phở, Bún, Cà phê), quận huyện hoặc tên quán.'
                      : 'Try searching by dish (Pho, Coffee), district or venue name.'}
                  </p>
                </div>
              )
            ) : (
              /* Case B: Default State - Recent Searches + Quick Discovery Hub */
              <>
                {/* Recent Searches */}
                {recentSearches.length > 0 && (
                  <div className="py-1">
                    <div className="px-3.5 py-1 flex items-center justify-between text-[11px] font-heading font-bold text-stone-400 uppercase tracking-wider">
                      <span>{isVi ? 'Tìm kiếm gần đây' : 'Recent searches'}</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 px-3 py-1.5">
                      {recentSearches.map((item) => (
                        <div
                          key={item}
                          onClick={() => handleRecentClick(item)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-stone-100 hover:bg-stone-200/80 text-stone-700 text-xs font-heading font-medium transition-colors cursor-pointer select-none"
                        >
                          <span className="material-symbols-outlined text-[13px] text-stone-400">history</span>
                          <span>{item}</span>
                          <button
                            type="button"
                            onClick={(e) => removeRecentSearch(e, item)}
                            className="text-stone-400 hover:text-stone-600 text-[10px] ml-0.5 cursor-pointer"
                            aria-label={isVi ? 'Xóa từ khóa' : 'Delete keyword'}
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Popular Food Categories */}
                <div className="py-1">
                  <div className="px-3.5 py-1 text-[11px] font-heading font-bold text-stone-400 uppercase tracking-wider">
                    {isVi ? 'Khám phá món ngon đặc sản' : 'Explore popular food specialties'}
                  </div>
                  <div className="grid grid-cols-2 gap-1 px-2.5 py-1">
                    {POPULAR_DISHES.slice(0, 6).map((dish) => (
                      <button
                        key={dish.title}
                        type="button"
                        onClick={() => {
                          if (onSelectCategory) onSelectCategory(dish.category);
                          onSearchQueryChange('');
                          saveRecentSearch(dish.title);
                          setIsOpen(false);
                        }}
                        className="flex items-center gap-2 p-2 rounded-xl hover:bg-stone-50 text-left transition-colors cursor-pointer"
                      >
                        <span className="text-base shrink-0">{dish.glyph}</span>
                        <span className="text-[12.5px] font-heading font-medium text-stone-700 truncate">
                          {dish.title}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Popular Hanoi Foodie Neighborhoods */}
                <div className="py-1">
                  <div className="px-3.5 py-1 text-[11px] font-heading font-bold text-stone-400 uppercase tracking-wider">
                    {isVi ? 'Khu vực ẩm thực nổi tiếng Hà Nội' : 'Popular Hanoi foodie areas'}
                  </div>
                  <div className="max-h-48 overflow-y-auto no-scrollbar">
                    {HANOI_DISCOVERY_LOCATIONS.map((loc) => (
                      <button
                        key={loc.name}
                        type="button"
                        onClick={() => {
                          onSelectLocation({ latitude: loc.latitude, longitude: loc.longitude }, loc.zoom);
                          saveRecentSearch(loc.name);
                          setIsOpen(false);
                        }}
                        className="w-full px-3.5 py-2 flex items-center gap-2.5 hover:bg-stone-50 text-left transition-colors cursor-pointer"
                      >
                        <span className="text-base shrink-0">{loc.glyph}</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-[12.5px] font-heading font-semibold text-stone-800 truncate">
                            {loc.name}
                          </div>
                          <div className="text-[11px] text-stone-500 truncate">{loc.description}</div>
                        </div>
                        <span className="text-[10.5px] font-heading font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full shrink-0">
                          {isVi ? 'Đến khu vực' : 'Go to area'}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Footer Bar */}
          <div className="px-3.5 py-2 bg-stone-50 border-t border-stone-100 flex items-center justify-between text-[11px] text-stone-500">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
              {isVi
                ? `Đang hiển thị ${places.length} địa điểm trong tầm ngắm`
                : `Showing ${places.length} places on radar`}
            </span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-stone-600 font-heading font-semibold hover:text-stone-900 cursor-pointer"
            >
              {isVi ? 'Đóng' : 'Close'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
