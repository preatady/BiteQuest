export type KnowledgeTrackId = 'smart_biter' | 'bite_guardian';

export type QuestionDifficulty = 'easy' | 'medium' | 'reasoning';

export interface KnowledgeChoice {
  id: string;
  text: string;
}

export interface KnowledgeQuestion {
  id: string;
  track: KnowledgeTrackId;
  theme: string;
  scenarioTitle: string;
  scenario: string;
  choices: KnowledgeChoice[];
  correctChoiceId: string;
  explanation: string;
  difficulty: QuestionDifficulty;
  contextPill?: string;
}

export interface KnowledgeTrackInfo {
  id: KnowledgeTrackId;
  badgeEmoji: string;
  badgeName: string;
  titleVi: string;
  subtitle: string;
  description: string;
  rewardXp: number;
  unlockedTitle?: string;
  stickerId: string;
}

export const KNOWLEDGE_TRACKS: Record<KnowledgeTrackId, KnowledgeTrackInfo> = {
  smart_biter: {
    id: 'smart_biter',
    badgeEmoji: '🛡️',
    badgeName: 'SMART BITER',
    titleVi: 'Ăn Tỉnh Táo',
    subtitle: 'Kỹ năng minh bạch giá cả & kiểm chứng thông tin',
    description: 'Quan sát, hỏi giá trước khi gọi món, đối chiếu hóa đơn và lưu trữ bằng chứng xác thực.',
    rewardXp: 100,
    stickerId: 'smart_biter',
  },
  bite_guardian: {
    id: 'bite_guardian',
    badgeEmoji: '🧭',
    badgeName: 'BITE GUARDIAN',
    titleVi: 'Người Khám Phá Có Trách Nhiệm',
    subtitle: 'Văn hóa đóng góp cộng đồng & tôn trọng sự thật',
    description: 'Phân biệt bằng chứng với ý kiến cá nhân, xác minh độc lập, bảo vệ quyền riêng tư và an toàn ẩm thực.',
    rewardXp: 100,
    stickerId: 'bite_guardian',
  },
};

export const META_KNOWLEDGE_TITLE = '🏆 Nhà Khám Phá Sành Sỏi';

// Question Pool: At least 10 Smart Biter questions
export const SMART_BITER_QUESTIONS: KnowledgeQuestion[] = [
  {
    id: 'sb_1_missing_price',
    track: 'smart_biter',
    theme: 'Missing price',
    scenarioTitle: '📋 Menu không ghi giá',
    scenario: 'Bạn vào một quán ốc trong ngõ lạ. Menu dán trên tường không ghi giá món, nhân viên bảo: "Cứ gọi đi em, tí chị tính sau". Hành động đầu tiên hợp lý nhất là gì?',
    choices: [
      { id: 'a', text: 'Cứ gọi thoải mái rồi đợi tính tiền sau' },
      { id: 'b', text: 'Hỏi và xác nhận giá từng món trước khi chốt gọi món' },
      { id: 'c', text: 'Chụp ảnh quán và đăng bài bóc phốt ngay lập tức' },
      { id: 'd', text: 'Đánh giá 1 sao trên mạng trước khi ăn' },
    ],
    correctChoiceId: 'b',
    explanation: 'Hỏi và xác nhận giá trước khi gọi món giúp bạn nắm rõ thông tin chi phí và chủ động lựa chọn, tránh bất ngờ khi thanh toán.',
    difficulty: 'reasoning',
    contextPill: 'Hỏi giá trước',
  },
  {
    id: 'sb_2_bill_difference',
    track: 'smart_biter',
    theme: 'Unexpected bill difference',
    scenarioTitle: '🧾 Chênh lệch hóa đơn',
    scenario: 'Menu ghi đĩa phở xào 50.000đ. Khi nhận phiếu thanh toán, tổng tiền là 80.000đ. Bạn nên làm gì trước khi đưa ra nhận xét?',
    choices: [
      { id: 'a', text: 'Kiểm tra xem có phụ thu, khăn lạnh, nước uống hoặc món gọi thêm trước khi kết luận' },
      { id: 'b', text: 'Quát lớn và tố cáo quán lừa đảo du khách' },
      { id: 'c', text: 'Lẳng lặng trả tiền rồi về nhà đăng bài ẩn danh' },
      { id: 'd', text: 'Rút tiền trả đủ 50k rồi bỏ đi không giải thích' },
    ],
    correctChoiceId: 'a',
    explanation: 'Luôn rà soát chi tiết các mục trên hóa đơn (nước, khăn, topping gọi thêm) và trao đổi lịch sự với quán để làm rõ nguyên nhân chênh lệch.',
    difficulty: 'reasoning',
    contextPill: 'Đối chiếu hóa đơn',
  },
  {
    id: 'sb_3_wrong_item',
    track: 'smart_biter',
    theme: 'Wrong item',
    scenarioTitle: '🍽️ Món không gọi xuất hiện trên hóa đơn',
    scenario: 'Hóa đơn tính tiền có thêm một phần "Quẩy giòn 15.000đ" nhưng bàn bạn không hề gọi và cũng không ăn. Bước xử lý đúng là gì?',
    choices: [
      { id: 'a', text: 'Tạo tài khoản ảo bóc phốt quán gian lận' },
      { id: 'b', text: 'Nhẹ nhàng chỉ rõ hóa đơn cho nhân viên và đề nghị kiểm tra, điều chỉnh lại' },
      { id: 'c', text: 'Chấp nhận trả tiền vì ngại giao tiếp' },
      { id: 'd', text: 'Chụp hình bàn ăn rồi rời đi không thanh toán' },
    ],
    correctChoiceId: 'b',
    explanation: 'Nhân viên có thể sơ suất gộp nhầm bàn. Trao đổi thẳng thắn và lịch sự tại chỗ là cách giải quyết văn minh và nhanh chóng nhất.',
    difficulty: 'medium',
    contextPill: 'Xử lý lịch sự',
  },
  {
    id: 'sb_4_unsupported_accusation',
    track: 'smart_biter',
    theme: 'Unsupported accusation',
    scenarioTitle: '📱 Bài viết mạng xã hội chưa kiểm chứng',
    scenario: 'Bạn đọc được bài viết: "Quán bún chả X này chuyên chém giá khách du lịch!" nhưng bài viết không có ảnh menu, hóa đơn hay thời gian cụ thể. Bạn nên nhìn nhận ra sao?',
    choices: [
      { id: 'a', text: 'Coi đây là sự thật đã được chứng minh 100%' },
      { id: 'b', text: 'Xem như một ý kiến tham khảo chưa có bằng chứng xác thực, cần tự kiểm chứng' },
      { id: 'c', text: 'Chia sẻ bài viết sang nhiều hội nhóm để cảnh báo' },
      { id: 'd', text: 'Vào chấm 1 sao quán ngay lập tức' },
    ],
    correctChoiceId: 'b',
    explanation: 'Trong BiteQuest, thông tin không có ảnh bằng chứng và mốc thời gian chỉ là ý kiến chưa kiểm chứng, không thể coi là sự thật tuyệt đối.',
    difficulty: 'reasoning',
    contextPill: 'Tư duy kiểm chứng',
  },
  {
    id: 'sb_5_price_evidence',
    track: 'smart_biter',
    theme: 'Price evidence',
    scenarioTitle: '📸 Bằng chứng giá cả minh bạch',
    scenario: 'Khi đóng góp thông tin giá cả của một quán ăn lên BiteQuest, dữ liệu nào sau đây có giá trị bằng chứng khách quan cao nhất?',
    choices: [
      { id: 'a', text: 'Một bình luận khen: "Quán này ăn no nê mà rẻ lắm"' },
      { id: 'b', text: 'Ảnh chụp rõ bảng giá/hóa đơn có kèm vị trí GPS và mốc thời gian chụp' },
      { id: 'c', text: 'Lời kể của một người bạn ghé quán từ 2 năm trước' },
      { id: 'd', text: 'Ước tính chủ quan trong đầu' },
    ],
    correctChoiceId: 'b',
    explanation: 'Ảnh chụp bảng giá hoặc hóa đơn thực tế có gắn GPS và timestamp là bằng chứng khách quan, đáng tin cậy nhất cho cộng đồng.',
    difficulty: 'medium',
    contextPill: 'Bằng chứng thực tế',
  },
  {
    id: 'sb_6_easy_arithmetic',
    track: 'smart_biter',
    theme: 'Tourist currency awareness',
    scenarioTitle: '🔢 Tính nhẩm cơ bản',
    scenario: 'Bạn gọi 1 tô Bún bò: 50.000đ và 1 cốc Trà đá: 5.000đ. Quán không có bất kỳ phụ phí nào khác. Số tiền dự kiến cần thanh toán là bao nhiêu?',
    choices: [
      { id: 'a', text: '50.000đ' },
      { id: 'b', text: '55.000đ' },
      { id: 'c', text: '65.000đ' },
      { id: 'd', text: '105.000đ' },
    ],
    correctChoiceId: 'b',
    explanation: '50.000đ + 5.000đ = 55.000đ. Nhẩm tính nhanh giúp bạn tự tin kiểm tra số tiền thối lại khi thanh toán tiền mặt.',
    difficulty: 'easy',
    contextPill: 'Tính nhẩm nhanh',
  },
  {
    id: 'sb_7_qr_vs_physical',
    track: 'smart_biter',
    theme: 'QR versus physical menu',
    scenarioTitle: '📲 Menu QR khác Menu giấy',
    scenario: 'Menu giấy trên bàn ghi Cơm sườn 45.000đ, nhưng khi quét mã QR để đặt món thì hiển thị 55.000đ. Bạn nên làm gì?',
    choices: [
      { id: 'a', text: 'Hỏi nhân viên bảng giá nào đang áp dụng chính thức hôm nay' },
      { id: 'b', text: 'Cố tình không thanh toán chênh lệch sau khi ăn xong' },
      { id: 'c', text: 'Đăng bài tố cáo nhà hàng lừa đảo công nghệ' },
      { id: 'd', text: 'Bỏ về không nói lời nào' },
    ],
    correctChoiceId: 'a',
    explanation: 'Hệ thống điện tử và menu giấy đôi khi chưa đồng bộ sau đợt cập nhật giá. Hãy hỏi nhân viên để xác nhận mức giá áp dụng trước khi hoàn tất đặt món.',
    difficulty: 'reasoning',
    contextPill: 'Đồng bộ giá',
  },
  {
    id: 'sb_8_additional_charge',
    track: 'smart_biter',
    theme: 'Additional charge',
    scenarioTitle: '🏷️ Phụ phí trên hóa đơn',
    scenario: 'Hóa đơn xuất hiện dòng "Phí gửi xe / Phí phòng lạnh 10.000đ". Cách ứng xử nào đúng đắn nhất?',
    choices: [
      { id: 'a', text: 'Kiểm tra xem quán có biển thông báo hoặc nhân viên đã nhắc trước đó chưa' },
      { id: 'b', text: 'Nổi giận ngay tại quầy thu ngân' },
      { id: 'c', text: 'Chụp lén nhân viên và đăng lên mạng' },
      { id: 'd', text: 'Mặc định đây là hành vi vi phạm pháp luật' },
    ],
    correctChoiceId: 'a',
    explanation: 'Nhiều địa điểm có phụ phí dịch vụ đã được niêm yết công khai. Cần kiểm tra thông tin thông báo trước khi đánh giá tính minh bạch của quán.',
    difficulty: 'medium',
    contextPill: 'Kiểm tra thông báo',
  },
  {
    id: 'sb_9_price_changes',
    track: 'smart_biter',
    theme: 'Price changes',
    scenarioTitle: '⏳ Giá cả theo thời gian',
    scenario: 'Một bài đánh giá trên BiteQuest từ 8 tháng trước ghi giá Bánh cuốn là 30.000đ, nhưng hôm nay menu quán là 35.000đ. Điều này phản ánh điều gì?',
    choices: [
      { id: 'a', text: 'Quán ăn đang lừa dối người dùng' },
      { id: 'b', text: 'Giá cả có thể thay đổi theo biến động thị trường; dữ liệu mới hơn luôn được ưu tiên' },
      { id: 'c', text: 'BiteQuest phải khóa tài khoản người đánh giá cũ' },
      { id: 'd', text: 'Quán ăn không có quyền điều chỉnh giá' },
    ],
    correctChoiceId: 'b',
    explanation: 'Giá cả ẩm thực biến động theo nguyên liệu và thời gian. BiteQuest khuyến khích cộng đồng cập nhật bằng chứng giá mới nhất thay vì coi thông tin cũ là gian dối.',
    difficulty: 'reasoning',
    contextPill: 'Cập nhật định kỳ',
  },
  {
    id: 'sb_10_factual_reporting',
    track: 'smart_biter',
    theme: 'Reporting',
    scenarioTitle: '✍️ Báo cáo trung thực',
    scenario: 'Khi muốn phản hồi về sự khác biệt giá cả trên BiteQuest, nội dung nào sau đây là chuẩn mực và hữu ích nhất?',
    choices: [
      { id: 'a', text: '"Quán này làm ăn chộp giật, tẩy chay đi mọi người!"' },
      { id: 'b', text: '"Menu niêm yết 40k lúc 12:00 ngày 25/08, hóa đơn tính 50k (gồm 10k trà đá ghi rõ)"' },
      { id: 'c', text: '"Chủ quán nhìn không thân thiện nên chắc chắn tính đắt"' },
      { id: 'd', text: '"Giá quá đắt không nên vào"' },
    ],
    correctChoiceId: 'b',
    explanation: 'Báo cáo chuẩn mực cần mô tả số liệu quan sát thực tế (giá menu, giá hóa đơn, mốc thời gian và chi tiết phụ phí) thay vì gán ghép suy đoán chủ quan.',
    difficulty: 'reasoning',
    contextPill: 'Báo cáo dữ liệu',
  },
  {
    id: 'sb_11_easy_drink_combo',
    track: 'smart_biter',
    theme: 'Tourist currency awareness',
    scenarioTitle: '🥤 Combo ăn uống',
    scenario: 'Bánh mì pate: 25.000đ. Nước ngọt: 15.000đ. Tổng hóa đơn bạn cần chuẩn bị là:',
    choices: [
      { id: 'a', text: '35.000đ' },
      { id: 'b', text: '40.000đ' },
      { id: 'c', text: '45.000đ' },
      { id: 'd', text: '50.000đ' },
    ],
    correctChoiceId: 'b',
    explanation: '25.000đ + 15.000đ = 40.000đ. Nắm chắc giá giúp bạn thanh toán nhanh chóng và chính xác.',
    difficulty: 'easy',
    contextPill: 'Cộng nhẩm',
  },
];

// Question Pool: At least 10 Bite Guardian questions
export const BITE_GUARDIAN_QUESTIONS: KnowledgeQuestion[] = [
  {
    id: 'bg_1_community_spot_verification',
    track: 'bite_guardian',
    theme: 'Community Spot discovery',
    scenarioTitle: '✨ Tạo điểm quán mới',
    scenario: 'Bạn là người đầu tiên tạo một "Quán Ngõ Mới" (Community Spot) trên BiteQuest. Bạn có thể tự mình bấm xác minh (Verify) quán đó để nhận huy hiệu First Bite ngay lập tức không?',
    choices: [
      { id: 'a', text: 'Có thể, vì mình là người tìm ra quán' },
      { id: 'b', text: 'Không — Cơ chế BiteQuest bắt buộc người dùng độc lập thứ hai ghé ăn và xác minh' },
      { id: 'c', text: 'Có thể, chỉ cần chụp nhiều góc ảnh khác nhau' },
      { id: 'd', text: 'Có thể, nếu tài khoản của bạn đạt cấp độ cao' },
    ],
    correctChoiceId: 'b',
    explanation: 'Quy tắc 2-User Verification ngăn chặn việc tạo quán ảo hoặc tự thổi phồng thành tích. Sự độc lập là cốt lõi của tính xác thực trong BiteQuest.',
    difficulty: 'reasoning',
    contextPill: 'Xác minh độc lập',
  },
  {
    id: 'bg_2_duplicate_spot',
    track: 'bite_guardian',
    theme: 'Duplicate place',
    scenarioTitle: '📍 Quán ăn đã có trên bản đồ',
    scenario: 'Bạn muốn tạo một quán bún riêu mới, nhưng thấy trên bản đồ cách 5m đã có quán "Bún Riêu Cua Bà Năm" cùng địa chỉ. Bạn nên làm gì?',
    choices: [
      { id: 'a', text: 'Tạo thêm 1 quán mới với tên viết tắt để nhận thêm điểm XP tạo quán' },
      { id: 'b', text: 'Kiểm tra xem quán có sẵn có phải chính là địa điểm này không và thực hiện Check-in tại quán đó' },
      { id: 'c', text: 'Báo cáo xóa quán cũ để tạo quán của mình' },
      { id: 'd', text: 'Tạo liên tiếp 3 quán để chiếm sóng' },
    ],
    correctChoiceId: 'b',
    explanation: 'Tránh tạo trùng lặp địa điểm để giữ cho bản đồ cộng đồng gọn gàng, dữ liệu tập trung và hữu ích cho mọi người.',
    difficulty: 'medium',
    contextPill: 'Chống trùng lặp',
  },
  {
    id: 'bg_3_gallery_vs_live',
    track: 'bite_guardian',
    theme: 'Gallery photo',
    scenarioTitle: '📸 Tải ảnh từ thư viện (Gallery Upload)',
    scenario: 'Bạn đang đứng tại Cầu Giấy và tải lên một tấm ảnh chụp đồ ăn từ tháng trước trong thư viện điện thoại. Hệ thống sẽ xử lý bằng chứng này ra sao?',
    choices: [
      { id: 'a', text: 'Xem đây là Proof-of-Bite thời gian thực và xác minh tuyệt đối' },
      { id: 'b', text: 'Gắn nhãn Gallery Bite (bằng chứng tham khảo) vì GPS hiện tại không chứng minh thời gian ảnh được chụp' },
      { id: 'c', text: 'Khóa tài khoản người dùng' },
      { id: 'd', text: 'Tự động sửa thời gian chụp ảnh thành hôm nay' },
    ],
    correctChoiceId: 'b',
    explanation: 'Ảnh thư viện vẫn có giá trị chia sẻ trải nghiệm ẩm thực, nhưng được phân biệt rõ ràng với ảnh chụp trực tiếp tại quán (Live Verified Bite).',
    difficulty: 'reasoning',
    contextPill: 'Phân loại bằng chứng',
  },
  {
    id: 'bg_4_food_claim',
    track: 'bite_guardian',
    theme: 'Food claim',
    scenarioTitle: '🥣 Nhận xét về độ an toàn thực phẩm',
    scenario: 'Bạn thấy một bức ảnh món bún nước dùng có màu sẫm hơn bình thường. Bạn nên đưa ra nhận xét thế nào trên cộng đồng?',
    choices: [
      { id: 'a', text: 'Tuyên bố ngay quán sử dụng hóa chất độc hại hoặc thực phẩm bẩn' },
      { id: 'b', text: 'Mô tả trung thực quan sát hình ảnh và hương vị trải nghiệm, không đưa ra cáo buộc y tế khi không có cơ sở kiểm nghiệm' },
      { id: 'c', text: 'Kêu gọi bạn bè đánh giá 1 sao tập thể' },
      { id: 'd', text: 'Gửi khiếu nại kiện tụng ngay' },
    ],
    correctChoiceId: 'b',
    explanation: 'Các kết luận về an toàn thực phẩm cần cơ quan kiểm nghiệm có thẩm quyền. Người khám phá văn minh chỉ chia sẻ cảm nhận thực tế khách quan.',
    difficulty: 'reasoning',
    contextPill: 'Khách quan',
  },
  {
    id: 'bg_5_privacy',
    track: 'bite_guardian',
    theme: 'Privacy',
    scenarioTitle: '🛡️ Quyền riêng tư của nhân viên và thực khách',
    scenario: 'Khi chụp ảnh check-in món ăn tại một quán cà phê đông người, nguyên tắc tôn trọng quyền riêng tư nào cần được áp dụng?',
    choices: [
      { id: 'a', text: 'Chụp cận cảnh khuôn mặt khách bàn bên cạnh đang trò chuyện riêng tư' },
      { id: 'b', text: 'Tập trung khung hình vào món ăn, đồ uống và không gian chung; tránh zoom vào thông tin cá nhân của người khác' },
      { id: 'c', text: 'Chụp màn hình máy tính của khách ngồi cạnh' },
      { id: 'd', text: 'Ghi âm cuộc nói chuyện của nhân viên' },
    ],
    correctChoiceId: 'b',
    explanation: 'Tôn trọng quyền riêng tư của mọi người xung quanh là chuẩn mực đạo đức của một Bite Guardian có trách nhiệm.',
    difficulty: 'medium',
    contextPill: 'Quyền riêng tư',
  },
  {
    id: 'bg_6_easy_honest_checkin',
    track: 'bite_guardian',
    theme: 'Easy question / Basics',
    scenarioTitle: '🍜 Trải nghiệm món ăn',
    scenario: 'Mục đích chính của tính năng Check-in trong BiteQuest là gì?',
    choices: [
      { id: 'a', text: 'Lưu giữ nhật ký ẩm thực cá nhân và đóng góp thông tin xác thực cho bạn bè' },
      { id: 'b', text: 'Tạo tài khoản ảo để bán hàng online' },
      { id: 'c', text: 'Spam đánh giá để nhận quà tài trợ trái phép' },
      { id: 'd', text: 'Tranh cãi với người dùng khác' },
    ],
    correctChoiceId: 'a',
    explanation: 'Check-in giúp bạn ghi lại hành trình ẩm thực đáng nhớ và chia sẻ địa chỉ ăn ngon thật 100% đến cộng đồng.',
    difficulty: 'easy',
    contextPill: 'Mục đích cốt lõi',
  },
  {
    id: 'bg_7_evidence_vs_opinion',
    track: 'bite_guardian',
    theme: 'Evidence vs opinion',
    scenarioTitle: '🔍 Phân biệt Sự thật và Ý kiến cá nhân',
    scenario: 'Trong hai câu sau, câu nào là "Bằng chứng/Sự thật quan sát được" (Fact), câu nào là "Ý kiến chủ quan" (Opinion)?',
    choices: [
      { id: 'a', text: '"Món nước dùng này dở tệ" là Fact; "Quán mở cửa lúc 07:00" là Opinion' },
      { id: 'b', text: '"Menu niêm yết 50k lúc 19:00" là Fact (Sự thật); "Món này nêm hơi ngọt so với khẩu vị của tôi" là Opinion (Ý kiến)' },
      { id: 'c', text: 'Cả hai câu đều là Fact tuyệt đối' },
      { id: 'd', text: 'Không có cách nào phân biệt được' },
    ],
    correctChoiceId: 'b',
    explanation: 'Khẩu vị là trải nghiệm chủ quan của từng cá nhân; còn mức giá niêm yết, giờ mở cửa và hình ảnh là sự thật có thể quan sát và đo lường.',
    difficulty: 'reasoning',
    contextPill: 'Fact vs Opinion',
  },
  {
    id: 'bg_8_xp_farming',
    track: 'bite_guardian',
    theme: 'XP farming',
    scenarioTitle: '🎮 Cày điểm thưởng (XP Farming)',
    scenario: 'Một tài khoản liên tục bấm tạo 10 check-in cùng một địa điểm trong vòng 5 phút để tăng cấp nhanh. Quy tắc BiteQuest nhìn nhận hành vi này thế nào?',
    choices: [
      { id: 'a', text: 'Đây là kỹ năng tốt đáng khuyến khích' },
      { id: 'b', text: 'Đây là hành vi spam/farming làm loãng dữ liệu cộng đồng, sẽ bị giới hạn thưởng và lọc tự động' },
      { id: 'c', text: 'Hệ thống sẽ trao tặng danh hiệu Top 1 ngay' },
      { id: 'd', text: 'Được phép nếu chụp ảnh cùng một bát nước chấm' },
    ],
    correctChoiceId: 'b',
    explanation: 'BiteQuest áp dụng giới hạn tần suất (rate-limit) và cơ chế chống spam để đảm bảo mỗi check-in đều đại diện cho trải nghiệm ẩm thực thực thụ.',
    difficulty: 'medium',
    contextPill: 'Chống gian lận',
  },
  {
    id: 'bg_9_allergen_and_ai',
    track: 'bite_guardian',
    theme: 'Allergy awareness',
    scenarioTitle: '🥜 Dị ứng thực phẩm & Trí tuệ nhân tạo (AI)',
    scenario: 'Bạn hoặc bạn bè bị dị ứng nghiêm trọng với đậu phộng (lạc). Tính năng nhận diện hình ảnh Gemini AI có thể được coi là kết luận y khoa đảm bảo món ăn 100% không có đậu phộng không?',
    choices: [
      { id: 'a', text: 'Có, AI nhận diện hình ảnh thay thế hoàn toàn bác sĩ và đầu bếp' },
      { id: 'b', text: 'Không — AI chỉ hỗ trợ nhận diện trực quan; khi có nguy cơ dị ứng, BẮT BUỘC phải hỏi trực tiếp nhân viên và nhà bếp' },
      { id: 'c', text: 'Có, nếu ảnh chụp có độ phân giải 4K' },
      { id: 'd', text: 'Chỉ cần tin vào ảnh trên mạng' },
    ],
    correctChoiceId: 'b',
    explanation: 'AI nhận diện hình ảnh hỗ trợ phân loại món ăn nhưng KHÔNG BAO GIỜ là chẩn đoán y tế hay cam kết an toàn dị ứng. Luôn chủ động hỏi quán để bảo vệ sức khỏe!',
    difficulty: 'reasoning',
    contextPill: 'An toàn sức khỏe',
  },
  {
    id: 'bg_10_community_reporting',
    track: 'bite_guardian',
    theme: 'Community reporting',
    scenarioTitle: '🤝 Văn hóa báo cáo quán ăn',
    scenario: 'Khi một quán ăn tạm thời nghỉ bán hoặc chuyển địa điểm, hành động xây dựng cộng đồng phù hợp nhất là:',
    choices: [
      { id: 'a', text: 'Đăng tải thông tin cập nhật địa chỉ mới hoặc báo trạng thái tạm đóng cửa kèm hình ảnh' },
      { id: 'b', text: 'Chửi bới trên diễn đàn vì mất công đi lại' },
      { id: 'c', text: 'Xóa ứng dụng' },
      { id: 'd', text: 'Tạo tin đồn thất thiệt về quán' },
    ],
    correctChoiceId: 'a',
    explanation: 'Bite Guardian luôn chung tay cập nhật thông tin chuẩn xác để giúp những người đi sau không bị nhỡ bữa ăn.',
    difficulty: 'medium',
    contextPill: 'Đóng góp hữu ích',
  },
  {
    id: 'bg_11_easy_respect',
    track: 'bite_guardian',
    theme: 'Easy question / Basics',
    scenarioTitle: '🥢 Văn hóa đi ăn',
    scenario: 'Khi thưởng thức món ăn tại các quán ăn vỉa hè hoặc ngõ nhỏ, thái độ nào thể hiện nét đẹp văn hóa ẩm thực?',
    choices: [
      { id: 'a', text: 'Gọn gàng, lịch sự với nhân viên và giữ gìn vệ sinh chung' },
      { id: 'b', text: 'Vứt rác bừa bãi ra lối đi chung của hàng xóm' },
      { id: 'c', text: 'Gây ồn ào vào đêm khuya' },
      { id: 'd', text: 'Bấm còi xe inh ỏi trước cửa quán' },
    ],
    correctChoiceId: 'a',
    explanation: 'Thưởng thức ẩm thực đường phố gắn liền với sự văn minh, trân trọng người nấu và giữ gìn không gian chung.',
    difficulty: 'easy',
    contextPill: 'Văn minh ẩm thực',
  },
];

/**
 * Shuffles an array with Fisher-Yates algorithm
 */
function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Randomly select 5 questions respecting roughly the difficulty distribution:
 * ~3 reasoning (60%), ~1 medium (25%), ~1 easy (15%)
 */
export function getRandomizedQuestQuestions(
  track: KnowledgeTrackId,
  count: number = 5
): KnowledgeQuestion[] {
  const pool = track === 'smart_biter' ? SMART_BITER_QUESTIONS : BITE_GUARDIAN_QUESTIONS;

  const reasoningPool = shuffleArray(pool.filter((q) => q.difficulty === 'reasoning'));
  const mediumPool = shuffleArray(pool.filter((q) => q.difficulty === 'medium'));
  const easyPool = shuffleArray(pool.filter((q) => q.difficulty === 'easy'));

  const selected: KnowledgeQuestion[] = [];

  // Pick 1 easy
  if (easyPool.length > 0) selected.push(easyPool[0]);

  // Pick 1 medium
  if (mediumPool.length > 0) selected.push(mediumPool[0]);

  // Pick reasoning up to target count
  for (const q of reasoningPool) {
    if (selected.length < count) {
      selected.push(q);
    }
  }

  // Fallback if needed from remaining pools
  if (selected.length < count) {
    const remaining = pool.filter((q) => !selected.some((s) => s.id === q.id));
    for (const q of shuffleArray(remaining)) {
      if (selected.length < count) {
        selected.push(q);
      }
    }
  }

  // Final shuffle so the easy question isn't always question #1
  return shuffleArray(selected).slice(0, count);
}
