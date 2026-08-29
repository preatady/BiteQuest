import React, { useState, useEffect, useRef, useMemo } from 'react';
import { getDistance } from 'geolib';
import { Place } from '../types';
import { UnifiedPlace } from '../services/maps/types';
import { CANONICAL_CATEGORIES, classifyVenue } from '../services/maps/categoryNormalizer';

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

// Popular culinary dishes and categories for quick filtering
const POPULAR_DISHES = [
  { title: 'Phở Bò & Phở Gà', category: 'PHO_NOODLES', glyph: '🍜' },
  { title: 'Bún Chả & Bún Đậu', category: 'VIETNAMESE', glyph: '🥗' },
  { title: 'Cà Phê Trứng & Trà Đá', category: 'CAFE', glyph: '☕' },
  { title: 'Bánh Mì Sốt Vang', category: 'STREET_FOOD', glyph: '🥖' },
  { title: 'Lẩu Riêu Cua & Nướng', category: 'HOTPOT_BBQ', glyph: '🍲' },
  { title: 'Chè Bưởi & Kem Tràng Tiền', category: 'DESSERT', glyph: '🍧' },
  { title: 'Cơm Tấm & Cơm Bình Dân', category: 'VIETNAMESE', glyph: '🍚' },
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
  const [isOpen, setIsOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);

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

  const searchResults = useMemo(() => {
    if (!normalizedQuery) {
      return [];
    }

    const results: SearchResultItem[] = [];

    // 1. Match Districts & Landmarks
    for (const loc of HANOI_DISCOVERY_LOCATIONS) {
      const matchName = loc.name.toLowerCase().includes(normalizedQuery);
      const matchDistrict = loc.district.toLowerCase().includes(normalizedQuery);
      const matchAlias = loc.alias.some((a) => a.includes(normalizedQuery) || normalizedQuery.includes(a));

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
      if (dish.title.toLowerCase().includes(normalizedQuery) || dish.category.toLowerCase().includes(normalizedQuery)) {
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

    // 3. Match Specific Venues
    const venueMatches: SearchResultItem[] = [];
    for (const p of places) {
      const matchName = p.name.toLowerCase().includes(normalizedQuery);
      const matchAddress = p.address?.toLowerCase().includes(normalizedQuery);
      const matchDistrict = p.district?.toLowerCase().includes(normalizedQuery);
      const matchCategory = p.categoryLabel?.toLowerCase().includes(normalizedQuery);

      if (matchName || matchAddress || matchDistrict || matchCategory) {
        const classification = classifyVenue({
          name: p.name,
          category: p.category,
          categoryLabel: p.categoryLabel,
        });
        const catMeta = CANONICAL_CATEGORIES[classification.category] || CANONICAL_CATEGORIES.RESTAURANT;

        let distanceMeters: number | undefined;
        if (currentLocation && typeof p.latitude === 'number' && typeof p.longitude === 'number') {
          distanceMeters = getDistance(currentLocation, { latitude: p.latitude, longitude: p.longitude });
        }

        venueMatches.push({
          id: `venue_${p.id}`,
          type: 'venue',
          title: p.name,
          subtitle: `${p.district || 'Hà Nội'} • ${p.address || ''}`,
          category: classification.category,
          categoryGlyph: catMeta.symbolGlyph || '🍴',
          latitude: p.latitude,
          longitude: p.longitude,
          venue: p,
          distanceMeters,
        });
      }
    }

    // Sort venues by distance if available, or relevance
    venueMatches.sort((a, b) => (a.distanceMeters || 99999) - (b.distanceMeters || 99999));

    // Combine top venues (max 8)
    results.push(...venueMatches.slice(0, 8));

    return results;
  }, [normalizedQuery, places, currentLocation]);

  const handleSelectResult = (item: SearchResultItem) => {
    saveRecentSearch(item.title);
    setIsOpen(false);

    if (item.type === 'venue' && item.venue) {
      onSelectVenue(item.venue);
      onSearchQueryChange(item.title);
    } else if (item.type === 'district' && typeof item.latitude === 'number' && typeof item.longitude === 'number') {
      onSelectLocation({ latitude: item.latitude, longitude: item.longitude }, item.zoom || 15);
      onSearchQueryChange(item.title);
    } else if (item.type === 'dish' && item.category && onSelectCategory) {
      onSelectCategory(item.category);
      onSearchQueryChange(item.title);
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
            onSearchQueryChange(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={isListening ? 'Đang lắng nghe giọng nói...' : 'Bạn muốn đi đâu? (VD: Phở, Cà phê...)'}
          className="bg-transparent border-none focus:outline-none w-full min-w-0 text-[13.5px] font-heading font-medium text-stone-800 placeholder:text-stone-400"
          id="input-google-maps-search"
          autoComplete="off"
          aria-label="Tìm kiếm trên BiteQuest"
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
            aria-label="Xóa tìm kiếm"
            title="Xóa nội dung"
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
          title={isListening ? 'Dừng ghi âm' : 'Tìm kiếm bằng giọng nói'}
          aria-label="Tìm bằng giọng nói"
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
          {/* Quick Smart Actions Header */}
          <div className="p-2 bg-gradient-to-r from-stone-50 via-white to-stone-50 border-b border-stone-100 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
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
                <span>Hôm nay ăn gì?</span>
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
                <span>Né tắc đường</span>
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
                <span>So sánh các quán</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                onSearchQueryChange('Phở');
                setIsOpen(true);
              }}
              className="px-2.5 py-1 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 text-[11px] font-heading font-medium shrink-0 transition-colors cursor-pointer"
            >
              🍜 Phở ngon
            </button>

            <button
              type="button"
              onClick={() => {
                onSearchQueryChange('Cà phê');
                setIsOpen(true);
              }}
              className="px-2.5 py-1 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 text-[11px] font-heading font-medium shrink-0 transition-colors cursor-pointer"
            >
              ☕ Cà phê view đẹp
            </button>
          </div>

          {/* Scrollable Suggestion Body */}
          <div className="overflow-y-auto no-scrollbar py-2 divide-y divide-stone-100">
            {/* Case A: Active Search Results */}
            {normalizedQuery ? (
              searchResults.length > 0 ? (
                <div className="py-1">
                  <div className="px-3.5 py-1 text-[11px] font-heading font-bold text-stone-400 uppercase tracking-wider">
                    Kết quả gợi ý ({searchResults.length})
                  </div>
                  {searchResults.map((item) => (
                    <div
                      key={item.id}
                      className="w-full px-3.5 py-2 flex items-center justify-between hover:bg-stone-50 text-left transition-colors group"
                    >
                      <button
                        type="button"
                        onClick={() => handleSelectResult(item)}
                        className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
                      >
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
                                Khu vực
                              </span>
                            )}
                            {item.type === 'dish' && (
                              <span className="px-1.5 py-0.2 rounded text-[10px] font-heading font-bold bg-amber-50 text-amber-700 shrink-0">
                                Món ngon
                              </span>
                            )}
                          </div>
                          {item.subtitle && (
                            <p className="text-[11.5px] text-stone-500 truncate mt-0.5">{item.subtitle}</p>
                          )}
                        </div>
                      </button>

                      {/* Right actions: Distance & Quick Compare Button */}
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
                            title="Thêm vào bảng so sánh"
                          >
                            ⚖️ So sánh
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-6 px-4 text-center">
                  <span className="text-2xl">🔍</span>
                  <p className="text-xs font-heading font-semibold text-stone-700 mt-2">
                    Không tìm thấy kết quả cho "{searchQuery}"
                  </p>
                  <p className="text-[11px] text-stone-500 mt-1">
                    Thử tìm theo tên món (Phở, Bún, Cà phê), quận huyện hoặc tên quán.
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
                      <span>Tìm kiếm gần đây</span>
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
                            aria-label="Xóa từ khóa"
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
                    Khám phá món ngon đặc sản
                  </div>
                  <div className="grid grid-cols-2 gap-1 px-2.5 py-1">
                    {POPULAR_DISHES.slice(0, 6).map((dish) => (
                      <button
                        key={dish.title}
                        type="button"
                        onClick={() => {
                          onSearchQueryChange(dish.title);
                          if (onSelectCategory) onSelectCategory(dish.category);
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
                    Khu vực ẩm thực nổi tiếng Hà Nội
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
                          Đến khu vực
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
              Đang hiển thị {places.length} địa điểm trong tầm ngắm
            </span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-stone-600 font-heading font-semibold hover:text-stone-900 cursor-pointer"
            >
              Đóng
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
