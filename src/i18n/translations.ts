export type Language = 'vi' | 'en';

export interface TranslationDictionary {
  // Common & Branding
  appName: string;
  appTagline: string;
  aiRiserPartner: string;
  loading: string;
  save: string;
  cancel: string;
  confirm: string;
  close: string;
  back: string;
  done: string;
  viewAll: string;
  details: string;
  collapse: string;
  expand: string;
  share: string;
  copyLink: string;
  copied: string;
  delete: string;
  edit: string;
  refresh: string;
  search: string;

  // Language Switcher
  language: string;
  langVi: string;
  langEn: string;
  langSwitchPrompt: string;
  currentLanguageName: string;

  // Top App Bar
  menuExtended: string;
  openMenu: string;
  askBiteBot: string;
  xpTitle: string;
  notificationsTitle: string;
  unreadCount: string;

  // Navigation Tabs
  tabExplore: string;
  tabRadar: string;
  tabFriends: string;
  tabCamera: string;
  tabPassport: string;
  tabProfile: string;

  // Map View & Search Bar
  searchPlaceholder1: string;
  searchPlaceholder2: string;
  searchPlaceholder3: string;
  searchPlaceholder4: string;
  voiceSearchPrompt: string;
  voiceListening: string;
  filterAll: string;
  filterNear: string;
  filterTopRated: string;
  filterOpenNow: string;
  filterGoodValue: string;
  filterQuietCozy: string;
  filterFloodSafe: string;
  filterScenic: string;
  filterSpicy: string;
  filterVegan: string;

  // Smart Search Intent & Decision Card
  smartChoiceBadge: string;
  smartDecisionTitle: string;
  routeAnalysis: string;
  trafficClear: string;
  trafficModerate: string;
  trafficCongested: string;
  trafficFlooded: string;
  confidenceScore: string;
  estimatedTravelTime: string;
  distanceKm: string;
  whyThisPlace: string;
  directionsBtn: string;
  quickCheckinBtn: string;
  hideDetails: string;
  showDetails: string;
  otherSmartResults: string;
  noPlacesFound: string;

  // Floating Controls & Docks
  biteRouletteTitle: string;
  biteRouletteSubtitle: string;
  trafficSheetTitle: string;
  trafficSheetSubtitle: string;
  compareVenuesTitle: string;
  mapLayersTitle: string;
  fogOfWarLayer: string;
  streetLayer: string;
  satelliteLayer: string;
  myLocationBtn: string;
  holidayEventTitle: string;
  holidayEventRadius: string;

  // Bite Camera & Check-in
  cameraTitle: string;
  cameraSubtext: string;
  capturePhoto: string;
  analyzingDishAI: string;
  quickRatingTaste: string;
  tasteTasty: string;
  tasteNormal: string;
  tasteBad: string;
  quickRatingPrice: string;
  priceGoodValue: string;
  priceFair: string;
  priceExpensive: string;
  publishCheckin: string;
  checkinSuccess: string;
  firstBiteBadge: string;
  rewardXpEarned: string;
  cameraRetake: string;
  cameraFilter: string;
  cameraSticker: string;
  cameraNoSticker: string;
  cameraConfirmDish: string;
  cameraContributeSpot: string;
  cameraOrChoose: string;
  cameraVerifyingAI: string;
  cameraVerifyingSubtext: string;
  cameraVerifiedLive: string;
  cameraGalleryBite: string;
  cameraReviewModalTitle: string;
  cameraTasteQuestion: string;
  cameraPriceQuestion: string;
  cameraReturnQuestion: string;
  cameraReturnYes: string;
  cameraReturnNo: string;
  cameraCaptionLabel: string;
  cameraCaptionPlaceholder: string;
  cameraSaveBiteBtn: string;
  cameraSavingBite: string;
  cameraPermissionError: string;
  cameraPermissionGuide: string;
  cameraUseSample: string;
  cameraChooseGallery: string;
  cameraRetryPermission: string;
  cameraOptional: string;

  // Passport & Fog of War
  passportTitle: string;
  passportSubtitle: string;
  districtStamps: string;
  conqueredPercentage: string;
  unlockedDistricts: string;
  fogClearedArea: string;
  leaderboardTitle: string;
  knowledgeQuestTitle: string;

  // Profile & Settings
  profileTitle: string;
  levelBadge: string;
  totalCheckins: string;
  tasteDNA: string;
  savedVenues: string;
  myBadges: string;
  logOut: string;
  signIn: string;
  guestUser: string;
  languageSettingTitle: string;
  languageSettingDesc: string;
}

export const translations: Record<Language, TranslationDictionary> = {
  vi: {
    // Common & Branding
    appName: 'BiteQuest',
    appTagline: 'Bản đồ Săn Quán & Thám Hiểm Ẩm Thực Thông Minh',
    aiRiserPartner: 'AI RISER',
    loading: 'Đang tải...',
    save: 'Lưu',
    cancel: 'Hủy',
    confirm: 'Xác nhận',
    close: 'Đóng',
    back: 'Quay lại',
    done: 'Hoàn tất',
    viewAll: 'Xem tất cả',
    details: 'Chi tiết',
    collapse: 'Thu gọn',
    expand: 'Mở rộng',
    share: 'Chia sẻ',
    copyLink: 'Sao chép liên kết',
    copied: 'Đã sao chép!',
    delete: 'Xóa',
    edit: 'Chỉnh sửa',
    refresh: 'Làm mới',
    search: 'Tìm kiếm',

    // Language Switcher
    language: 'Ngôn ngữ',
    langVi: 'Tiếng Việt',
    langEn: 'English',
    langSwitchPrompt: 'Chuyển đổi ngôn ngữ hiển thị',
    currentLanguageName: 'Tiếng Việt',

    // Top App Bar
    menuExtended: 'Menu mở rộng',
    openMenu: 'Mở menu',
    askBiteBot: 'BiteBot',
    xpTitle: 'Điểm kinh nghiệm',
    notificationsTitle: 'Thông báo',
    unreadCount: 'chưa đọc',

    // Navigation Tabs
    tabExplore: 'Khám phá',
    tabRadar: 'Săn quán',
    tabFriends: 'Cộng đồng',
    tabCamera: 'Bite Cam',
    tabPassport: 'Hộ chiếu',
    tabProfile: 'Cá nhân',

    // Map View & Search Bar
    searchPlaceholder1: "Tìm 'cafe làm việc yên tĩnh có ổ điện'...",
    searchPlaceholder2: "Tìm 'phở bò tái lăn gần đây né tắc đường'...",
    searchPlaceholder3: "Tìm 'lẩu thái view đẹp cho 4 người'...",
    searchPlaceholder4: "Tìm 'quán ăn vặt vỉa hè ngon rẻ'...",
    voiceSearchPrompt: 'Nói món hoặc quán bạn muốn tìm...',
    voiceListening: 'Đang lắng nghe giọng nói...',
    filterAll: 'Tất cả',
    filterNear: 'Gần nhất',
    filterTopRated: 'Đánh giá cao',
    filterOpenNow: 'Đang mở cửa',
    filterGoodValue: 'Giá hợp lý',
    filterQuietCozy: 'Yên tĩnh làm việc',
    filterFloodSafe: 'Né ngập úng',
    filterScenic: 'View đẹp sống ảo',
    filterSpicy: 'Món cay nóng',
    filterVegan: 'Thuần chay',

    // Smart Search Intent & Decision Card
    smartChoiceBadge: 'Lựa chọn thông minh nhất',
    smartDecisionTitle: 'Phân tích lộ trình & Trí tuệ ẩm thực',
    routeAnalysis: 'Phân tích đường đi tối ưu',
    trafficClear: 'Đường thông thoáng',
    trafficModerate: 'Ùn ứ nhẹ',
    trafficCongested: 'Đang tắc nghẽn',
    trafficFlooded: 'Nguy cơ ngập nước',
    confidenceScore: 'Độ tin cậy',
    estimatedTravelTime: 'Thời gian di chuyển',
    distanceKm: 'Cự ly',
    whyThisPlace: 'Lý do đề xuất',
    directionsBtn: 'Chỉ đường',
    quickCheckinBtn: 'Check-in ngay',
    hideDetails: 'Thu gọn lộ trình',
    showDetails: 'Chi tiết lộ trình',
    otherSmartResults: 'Gợi ý phù hợp tiếp theo',
    noPlacesFound: 'Không tìm thấy quán phù hợp',

    // Floating Controls & Docks
    biteRouletteTitle: 'Hôm nay ăn gì?',
    biteRouletteSubtitle: 'Lắc xúc xắc gợi ý quán ngon ngẫu nhiên',
    trafficSheetTitle: 'Lưu thông & Né ngập',
    trafficSheetSubtitle: 'Dự báo lộ trình thông minh tránh kẹt xe',
    compareVenuesTitle: 'So sánh quán',
    mapLayersTitle: 'Lớp bản đồ',
    fogOfWarLayer: 'Sương mù ẩm thực',
    streetLayer: 'Bản đồ đường phố',
    satelliteLayer: 'Ảnh vệ tinh',
    myLocationBtn: 'Vị trí hiện tại',
    holidayEventTitle: 'Hot: Lễ 2/9',
    holidayEventRadius: 'Bán kính 50km',

    // Bite Camera & Check-in
    cameraTitle: 'Chụp ảnh món ngon',
    cameraSubtext: 'AI phân tích hương vị & ghi nhận vào Hộ chiếu ẩm thực',
    capturePhoto: 'Chụp món',
    analyzingDishAI: 'AI đang nhận diện món ăn & hương vị...',
    quickRatingTaste: 'Cảm nhận vị giác',
    tasteTasty: 'Siêu ngon!',
    tasteNormal: 'Bình thường',
    tasteBad: 'Không hợp khẩu vị',
    quickRatingPrice: 'Mức giá',
    priceGoodValue: 'Rất đáng tiền',
    priceFair: 'Giá hợp lý',
    priceExpensive: 'Hơi đắt',
    publishCheckin: 'Đăng Check-in',
    checkinSuccess: 'Đã check-in thành công!',
    firstBiteBadge: 'Người khám phá đầu tiên!',
    rewardXpEarned: 'XP nhận được',
    cameraRetake: 'Chụp lại',
    cameraFilter: 'Filter',
    cameraSticker: 'Sticker',
    cameraNoSticker: 'Không sticker',
    cameraConfirmDish: 'Chuẩn luôn 😋',
    cameraContributeSpot: 'Không phải quán này / Đóng góp quán mới 👀',
    cameraOrChoose: 'Hoặc chọn:',
    cameraVerifyingAI: 'Gemini & GPS đang xác minh quán...',
    cameraVerifyingSubtext: 'Đối chiếu toạ độ thực tế và nhận diện hình ảnh',
    cameraVerifiedLive: '✨ Verified Live',
    cameraGalleryBite: '📸 Gallery Bite',
    cameraReviewModalTitle: 'Đánh giá nhanh Bite 😋',
    cameraTasteQuestion: 'Món ăn ngon không?',
    cameraPriceQuestion: 'Giá cả thế nào?',
    cameraReturnQuestion: 'Bạn có muốn quay lại không?',
    cameraReturnYes: 'Có',
    cameraReturnNo: 'Không',
    cameraCaptionLabel: 'Ghi chú 1 câu ngắn:',
    cameraCaptionPlaceholder: 'Ví dụ: Nước dùng siêu ngọt, cá rán giòn rụm!',
    cameraSaveBiteBtn: 'Lưu Bite & Mở Hành trình (+60 XP) ✨',
    cameraSavingBite: 'Đang lưu Bite...',
    cameraPermissionError: 'Không thể mở camera',
    cameraPermissionGuide: 'Vào Cài đặt trình duyệt → Quyền riêng tư → Cho phép Camera cho BiteQuest.',
    cameraUseSample: 'Dùng ảnh món mẫu thử nghiệm',
    cameraChooseGallery: 'Chọn ảnh từ thư viện máy',
    cameraRetryPermission: 'Thử kết nối lại camera',
    cameraOptional: '(Tùy chọn)',

    // Passport & Fog of War
    passportTitle: 'Hộ chiếu Ẩm thực',
    passportSubtitle: 'Hành trình mở khóa bản đồ ẩm thực từng quận',
    districtStamps: 'Dấu ấn đã thu thập',
    conqueredPercentage: 'Tỷ lệ khám phá',
    unlockedDistricts: 'Quận đã mở khóa',
    fogClearedArea: 'Khu vực đã khai phá',
    leaderboardTitle: 'Bảng xếp hạng Foodie',
    knowledgeQuestTitle: 'Thử thách Kiến thức Ẩm thực',

    // Profile & Settings
    profileTitle: 'Hồ sơ Ẩm thực',
    levelBadge: 'Cấp bậc',
    totalCheckins: 'Tổng lượt check-in',
    tasteDNA: 'Bản đồ Khẩu vị AI',
    savedVenues: 'Quán đã lưu',
    myBadges: 'Bộ sưu tập Huy hiệu',
    logOut: 'Đăng xuất',
    signIn: 'Đăng nhập',
    guestUser: 'Khách vãng lai',
    languageSettingTitle: 'Chế độ Ngôn ngữ',
    languageSettingDesc: 'Chọn Tiếng Việt hoặc English với bản dịch ngữ nghĩa chuẩn xác',
  },
  en: {
    // Common & Branding
    appName: 'BiteQuest',
    appTagline: 'Smart Culinary Discovery & Street Food Map Quest',
    aiRiserPartner: 'AI RISER',
    loading: 'Loading...',
    save: 'Save',
    cancel: 'Cancel',
    confirm: 'Confirm',
    close: 'Close',
    back: 'Back',
    done: 'Done',
    viewAll: 'View All',
    details: 'Details',
    collapse: 'Collapse',
    expand: 'Expand',
    share: 'Share',
    copyLink: 'Copy Link',
    copied: 'Copied!',
    delete: 'Delete',
    edit: 'Edit',
    refresh: 'Refresh',
    search: 'Search',

    // Language Switcher
    language: 'Language',
    langVi: 'Tiếng Việt',
    langEn: 'English',
    langSwitchPrompt: 'Switch interface language',
    currentLanguageName: 'English',

    // Top App Bar
    menuExtended: 'App Menu',
    openMenu: 'Open Menu',
    askBiteBot: 'BiteBot',
    xpTitle: 'Experience Points',
    notificationsTitle: 'Notifications',
    unreadCount: 'unread',

    // Navigation Tabs
    tabExplore: 'Explore',
    tabRadar: 'Food Radar',
    tabFriends: 'Community',
    tabCamera: 'Bite Cam',
    tabPassport: 'Passport',
    tabProfile: 'Profile',

    // Map View & Search Bar
    searchPlaceholder1: "Search 'quiet work cafe with power sockets'...",
    searchPlaceholder2: "Search 'authentic beef pho nearby traffic-free'...",
    searchPlaceholder3: "Search 'Thai hotpot with scenic view for 4'...",
    searchPlaceholder4: "Search 'tasty street food snacks & hidden gems'...",
    voiceSearchPrompt: 'Speak the food or venue you want to find...',
    voiceListening: 'Listening to your voice...',
    filterAll: 'All',
    filterNear: 'Nearest',
    filterTopRated: 'Top Rated',
    filterOpenNow: 'Open Now',
    filterGoodValue: 'Good Value',
    filterQuietCozy: 'Quiet & Work-friendly',
    filterFloodSafe: 'Flood-Safe',
    filterScenic: 'Scenic Views',
    filterSpicy: 'Spicy & Hot',
    filterVegan: 'Plant-Based / Vegan',

    // Smart Search Intent & Decision Card
    smartChoiceBadge: 'Smartest Choice',
    smartDecisionTitle: 'Route Intelligence & Foodie AI Insights',
    routeAnalysis: 'Optimal Path Analysis',
    trafficClear: 'Clear Traffic',
    trafficModerate: 'Light Congestion',
    trafficCongested: 'Heavy Traffic Jam',
    trafficFlooded: 'Flooding Risk',
    confidenceScore: 'Confidence Match',
    estimatedTravelTime: 'Estimated Time',
    distanceKm: 'Distance',
    whyThisPlace: 'Why recommended',
    directionsBtn: 'Directions',
    quickCheckinBtn: 'Check-in Now',
    hideDetails: 'Hide Route Details',
    showDetails: 'Show Route Details',
    otherSmartResults: 'Other Suitable Matches',
    noPlacesFound: 'No matching places found',

    // Floating Controls & Docks
    biteRouletteTitle: 'What to Eat Today?',
    biteRouletteSubtitle: 'Roll the dice for a curated delicious surprise',
    trafficSheetTitle: 'Traffic & Flood Navigator',
    trafficSheetSubtitle: 'Smart ETA forecasts avoiding traffic jams and floods',
    compareVenuesTitle: 'Compare Venues',
    mapLayersTitle: 'Map Layers',
    fogOfWarLayer: 'Culinary Fog of War',
    streetLayer: 'Standard Streets',
    satelliteLayer: 'Satellite Imagery',
    myLocationBtn: 'My Location',
    holidayEventTitle: 'National Day Special',
    holidayEventRadius: '50km Radius',

    // Bite Camera & Check-in
    cameraTitle: 'Capture Delicious Bites',
    cameraSubtext: 'AI analyzes sensory flavors & stamps your Culinary Passport',
    capturePhoto: 'Snap Dish',
    analyzingDishAI: 'AI is recognizing flavors and culinary traits...',
    quickRatingTaste: 'Taste Experience',
    tasteTasty: 'Amazing / Delicious!',
    tasteNormal: 'Decent',
    tasteBad: 'Not for me',
    quickRatingPrice: 'Price Value',
    priceGoodValue: 'Great Value',
    priceFair: 'Fair Price',
    priceExpensive: 'On the pricey side',
    publishCheckin: 'Post Check-in',
    checkinSuccess: 'Check-in posted successfully!',
    firstBiteBadge: 'Pioneer / First Discovery!',
    rewardXpEarned: 'XP Earned',
    cameraRetake: 'Retake',
    cameraFilter: 'Filter',
    cameraSticker: 'Sticker',
    cameraNoSticker: 'No Sticker',
    cameraConfirmDish: 'Spot on! 😋',
    cameraContributeSpot: 'Not this spot / Add new spot 👀',
    cameraOrChoose: 'Or choose:',
    cameraVerifyingAI: 'Gemini & GPS verifying venue...',
    cameraVerifyingSubtext: 'Matching real-time coordinates and visual recognition',
    cameraVerifiedLive: '✨ Verified Live',
    cameraGalleryBite: '📸 Gallery Bite',
    cameraReviewModalTitle: 'Quick Bite Review 😋',
    cameraTasteQuestion: 'How was the food?',
    cameraPriceQuestion: 'How was the price?',
    cameraReturnQuestion: 'Would you come back?',
    cameraReturnYes: 'Yes',
    cameraReturnNo: 'No',
    cameraCaptionLabel: 'Short note (1 sentence):',
    cameraCaptionPlaceholder: 'e.g., Crispy fish, rich flavorful broth!',
    cameraSaveBiteBtn: 'Save Bite & Unlock Quest (+60 XP) ✨',
    cameraSavingBite: 'Saving Bite...',
    cameraPermissionError: 'Unable to open camera',
    cameraPermissionGuide: 'Go to Browser Settings → Privacy & Security → Allow Camera for BiteQuest.',
    cameraUseSample: 'Use sample dish photo for testing',
    cameraChooseGallery: 'Choose photo from library',
    cameraRetryPermission: 'Retry camera connection',
    cameraOptional: '(Optional)',

    // Passport & Fog of War
    passportTitle: 'Culinary Passport',
    passportSubtitle: 'Your quest to conquer district food maps',
    districtStamps: 'Stamps Collected',
    conqueredPercentage: 'Exploration Rate',
    unlockedDistricts: 'Unlocked Districts',
    fogClearedArea: 'Discovered Area',
    leaderboardTitle: 'Foodie Leaderboard',
    knowledgeQuestTitle: 'Culinary Trivia Quest',

    // Profile & Settings
    profileTitle: 'Culinary Profile',
    levelBadge: 'Rank Level',
    totalCheckins: 'Total Check-ins',
    tasteDNA: 'AI Taste Profile DNA',
    savedVenues: 'Saved Places',
    myBadges: 'Badge Collection',
    logOut: 'Sign Out',
    signIn: 'Sign In',
    guestUser: 'Guest Explorer',
    languageSettingTitle: 'Language Mode',
    languageSettingDesc: 'Switch between natural Vietnamese and contextual English',
  },
};
