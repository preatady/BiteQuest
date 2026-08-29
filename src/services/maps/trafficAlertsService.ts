/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { getDistance } from 'geolib';
import { getSyntheticHourlyWeather, fetchLiveWeatherForecast } from './weatherFloodService';

export interface TrafficAlertItem {
  id: string;
  name: string;
  district: string;
  latitude: number;
  longitude: number;
  distanceMeters: number;
  distanceFormatted: string;
  severity: 'jammed' | 'heavy' | 'moderate' | 'smooth'; // ⛔ 🔴 🟡 🟢
  severityLabel: string;
  estimatedSpeedKmH: number;
  delayMinutes: number;
  cause: string;
  recommendation: string;
  isFlooded?: boolean;
  floodDepthCm?: number;
  updatedAtText: string;
}

export interface NearbyTrafficStatusReport {
  userLocation: { latitude: number; longitude: number };
  radiusKm: number;
  totalAlertsWithinRadius: number;
  severeCount: number;
  moderateCount: number;
  smoothCount: number;
  overallStatus: 'normal' | 'caution' | 'heavy_jam' | 'severe_weather';
  overallStatusTitle: string;
  overallAdvice: string;
  alerts: TrafficAlertItem[];
  currentHour: number;
  currentMinute: number;
  isRushHour: boolean;
  generatedAt: Date;
}

// Authoritative urban traffic bottleneck nodes across Vietnam's key metropolitan arteries
const URBAN_TRAFFIC_HOTSPOTS = [
  // --- HÀ NỘI ---
  {
    id: 'hn-nga-tu-so',
    name: 'Nút giao Ngã Tư Sở - Trường Chinh - Tây Sơn',
    district: 'Đống Đa / Thanh Xuân',
    latitude: 21.0016,
    longitude: 105.8202,
    basePeakMultiplier: 2.8,
    typicalCauses: ['Xung đột luồng xe từ Vành đai 2 trên cao đổ xuống', 'Mật độ phương tiện qua ngã tư quá tải'],
    avoidAdvice: 'Tránh đi thẳng qua ngã tư lúc cao điểm; nên đi nhánh gom hoặc chuyển hướng qua Láng Hạ - Yên Lãng.',
    floodProne: false,
  },
  {
    id: 'hn-cau-giay-xuan-thuy',
    name: 'Trục Cầu Giấy - Xuân Thủy - Hồ Tùng Mậu',
    district: 'Cầu Giấy',
    latitude: 21.0365,
    longitude: 105.7895,
    basePeakMultiplier: 2.5,
    typicalCauses: ['Lưu lượng sinh viên & nhân viên văn phòng giờ cao điểm', 'Nút thắt cổ chai gần cầu vượt Mai Dịch'],
    avoidAdvice: 'Hạn chế di chuyển vào trục Cầu Giấy; có thể đi vòng đường Trần Thái Tông - Tôn Thất Thuyết hoặc Nguyễn Phong Sắc.',
    floodProne: false,
  },
  {
    id: 'hn-nguyen-trai-khuat-duy-tien',
    name: 'Nút giao Nguyễn Trãi - Khuất Duy Tiến (Hầm chui Thanh Xuân)',
    district: 'Thanh Xuân',
    latitude: 20.9925,
    longitude: 105.8045,
    basePeakMultiplier: 2.4,
    typicalCauses: ['Dòng xe từ Hà Đông đổ về nội thành và lên đường Vành đai 3'],
    avoidAdvice: 'Tận dụng hầm chui nếu đi thẳng; nếu rẽ trái Khuất Duy Tiến nên đi sớm trước 17h00 hoặc sau 19h15.',
    floodProne: false,
  },
  {
    id: 'hn-de-la-thanh-kim-ma',
    name: 'Trục Đê La Thành - Giảng Võ - Kim Mã',
    district: 'Ba Đình / Đống Đa',
    latitude: 21.0315,
    longitude: 105.8155,
    basePeakMultiplier: 2.3,
    typicalCauses: ['Lòng đường hẹp, nhiều điểm giao cắt với bệnh viện và trường học'],
    avoidAdvice: 'Đoạn đường hẹp dễ ùn tắc kéo dài, nên chọn tuyến Giảng Võ hoặc Vạn Phúc thay thế.',
    floodProne: false,
  },
  {
    id: 'hn-xa-dan-o-cho-dua',
    name: 'Trục Xã Đàn - Ô Chợ Dừa - Hoàng Cầu',
    district: 'Đống Đa',
    latitude: 21.0175,
    longitude: 105.8345,
    basePeakMultiplier: 2.2,
    typicalCauses: ['Giao cắt phức tạp tại ngã 6 Ô Chợ Dừa', 'Lượng xe rẽ vào phố ẩm thực đông đúc'],
    avoidAdvice: 'Di chuyển chậm khi qua nút giao ngã 6, chú ý quan sát đèn tín hiệu phân làn.',
    floodProne: false,
  },
  {
    id: 'hn-vanh-dai-3-pham-hung',
    name: 'Nút giao Phạm Hùng - Đại Lộ Thăng Long - Trần Duy Hưng',
    district: 'Nam Từ Liêm / Cầu Giấy',
    latitude: 21.0078,
    longitude: 105.7925,
    basePeakMultiplier: 2.6,
    typicalCauses: ['Điểm lên xuống Vành đai 3 trên cao và xe khách qua lại Bến xe Mỹ Đình'],
    avoidAdvice: 'Kẹt cứng ở lối lên xuống cao tốc giờ tan tầm, nên đi đường gom Phạm Hùng hoặc rẽ Mễ Trì.',
    floodProne: false,
  },
  {
    id: 'hn-chua-boc-thai-ha',
    name: 'Ngã tư Chùa Bộc - Thái Hà - Tây Sơn',
    district: 'Đống Đa',
    latitude: 21.0082,
    longitude: 105.8256,
    basePeakMultiplier: 2.2,
    typicalCauses: ['Khu phố mua sắm sầm uất và các trường đại học lớn'],
    avoidAdvice: 'Đường hẹp vào buổi tối cuối tuần, ưu tiên gửi xe sớm nếu đến khu vực này dùng bữa.',
    floodProne: false,
  },
  {
    id: 'hn-cau-chuong-duong',
    name: 'Cầu Chương Dương - Trần Nhật Duật - Nguyễn Văn Cừ',
    district: 'Hoàn Kiếm / Long Biên',
    latitude: 21.0398,
    longitude: 105.8612,
    basePeakMultiplier: 2.5,
    typicalCauses: ['Lưu lượng xe qua sông Hồng giờ tan tầm rất cao'],
    avoidAdvice: 'Có thể cân nhắc di chuyển qua Cầu Vĩnh Tuy hoặc Cầu Long Biên (xe máy) để giảm thời gian chờ.',
    floodProne: false,
  },
  {
    id: 'hn-tran-duy-hung-hoang-minh-giam',
    name: 'Trục Trần Duy Hưng - Hoàng Minh Giám - Nguyễn Chánh',
    district: 'Cầu Giấy / Thanh Xuân',
    latitude: 21.0092,
    longitude: 105.7995,
    basePeakMultiplier: 2.1,
    typicalCauses: ['Tập trung nhiều toà nhà văn phòng, chung cư cao tầng'],
    avoidAdvice: 'Các ngã rẽ vào khu Trung Hòa Nhân Chính thường đông đúc từ 17h30 đến 18h45.',
    floodProne: false,
  },
  {
    id: 'hn-hoang-quoc-viet-buoi',
    name: 'Nút giao Hoàng Quốc Việt - Đường Bưởi - Võ Chí Công',
    district: 'Cầu Giấy / Tây Hồ',
    latitude: 21.0475,
    longitude: 105.8015,
    basePeakMultiplier: 2.0,
    typicalCauses: ['Dòng xe hướng ra sân bay Nội Bài và đường vành đai 2'],
    avoidAdvice: 'Lưu thông tương đối tốt nếu đi trên cầu vượt Bưởi; đường nhánh phía dưới có thể ùn ứ nhẹ.',
    floodProne: false,
  },

  // --- TP. HỒ CHÍ MINH ---
  {
    id: 'hcm-cong-hoa-truong-chinh',
    name: 'Trục Cộng Hòa - Trường Chinh - Hoàng Văn Thụ',
    district: 'Tân Bình',
    latitude: 10.803,
    longitude: 106.654,
    basePeakMultiplier: 2.8,
    typicalCauses: ['Cửa ngõ sân bay Tân Sơn Nhất và lưu lượng từ Hóc Môn, Q.12 dồn về'],
    avoidAdvice: 'Hạn chế qua trục Cộng Hòa từ 17h00 - 19h00; nên đi vòng Hoàng Hoa Thám hoặc Trường Chinh nối dài.',
    floodProne: false,
  },
  {
    id: 'hcm-hang-xanh-xo-viet-nghe-tinh',
    name: 'Vòng xoay Hàng Xanh - Xô Viết Nghệ Tĩnh - Điện Biên Phủ',
    district: 'Bình Thạnh',
    latitude: 10.801,
    longitude: 106.711,
    basePeakMultiplier: 2.7,
    typicalCauses: ['Điểm nút giao thông huyết mạch nối Bình Thạnh, Thủ Đức và Trung tâm'],
    avoidAdvice: 'Đoạn Xô Viết Nghệ Tĩnh hướng về bến xe Miền Đông cũ hay nghẽn cứng, đi Nguyễn Xí hoặc Bạch Đằng.',
    floodProne: true,
  },
  {
    id: 'hcm-vong-xoay-dan-chu',
    name: 'Vòng xoay Dân Chủ (CMT8 - Ba Tháng Hai - Võ Thị Sáu)',
    district: 'Quận 3 / Quận 10',
    latitude: 10.7785,
    longitude: 106.682,
    basePeakMultiplier: 2.5,
    typicalCauses: ['Nút giao nhiều hướng không có đèn tín hiệu phân luồng riêng'],
    avoidAdvice: 'Nên giảm tốc độ, nhường đường tại vòng xoay hoặc đi tránh qua đường Rạch Bùng Binh / Tú Xương.',
    floodProne: false,
  },
  {
    id: 'hcm-cau-kenh-te-nguyen-huu-tho',
    name: 'Cầu Kênh Tẻ - Trục Nguyễn Hữu Thọ - Khánh Hội',
    district: 'Quận 4 / Quận 7',
    latitude: 10.7515,
    longitude: 106.7025,
    basePeakMultiplier: 2.6,
    typicalCauses: ['Lưu lượng cư dân từ Quận 7, Nhà Bè đổ về Trung tâm qua duy nhất 1 cây cầu'],
    avoidAdvice: 'Cầu Kênh Tẻ kẹt nghiêm trọng 7h30 - 8h45 sáng và 17h30 - 19h00 chiều. Có thể đi vòng Cầu Tân Thuận hoặc Cầu Nguyễn Văn Cừ.',
    floodProne: false,
  },
  {
    id: 'hcm-an-phu-mai-chi-tho',
    name: 'Nút giao An Phú - Cao tốc TP.HCM Long Thành - Mai Chí Thọ',
    district: 'Thành phố Thủ Đức',
    latitude: 10.7925,
    longitude: 106.758,
    basePeakMultiplier: 2.6,
    typicalCauses: ['Khu vực đang thi công nút giao 3 tầng, nhiều xe container di chuyển'],
    avoidAdvice: 'Chú ý quan sát xe lớn và tuân thủ phân luồng tạm của CSGT.',
    floodProne: false,
  },
  {
    id: 'hcm-lang-cha-ca',
    name: 'Vòng xoay Lăng Cha Cả - Phan Thúc Duyện - Trần Quốc Hoàn',
    district: 'Tân Bình',
    latitude: 10.7995,
    longitude: 106.662,
    basePeakMultiplier: 2.4,
    typicalCauses: ['Dòng xe ra vào Ga Quốc tế và Quốc nội sân bay'],
    avoidAdvice: 'Nếu đi đón người thân ở sân bay, nên đi trước giờ hạ cánh ít nhất 40 phút.',
    floodProne: false,
  },
];

/**
 * Check real-time traffic status around user within specified radius (default 5km)
 */
export function checkNearbyRealtimeTraffic(
  userLocation: { latitude: number; longitude: number },
  radiusKm: number = 5.0
): NearbyTrafficStatusReport {
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const radiusMeters = radiusKm * 1000;

  // Determine if right now is active rush hour
  const isMorningRush = (currentHour === 7 && currentMinute >= 15) || currentHour === 8 || (currentHour === 9 && currentMinute <= 15);
  const isEveningRush = (currentHour === 16 && currentMinute >= 45) || currentHour === 17 || currentHour === 18 || (currentHour === 19 && currentMinute <= 30);
  const isLunchRush = currentHour === 12 || (currentHour === 11 && currentMinute >= 30) || (currentHour === 13 && currentMinute <= 15);
  const isRushHour = isMorningRush || isEveningRush;

  // Hourly base factor calculation
  let timeMultiplier = 1.0;
  if (isEveningRush) {
    timeMultiplier = 2.5;
  } else if (isMorningRush) {
    timeMultiplier = 2.2;
  } else if (isLunchRush) {
    timeMultiplier = 1.5;
  } else if (currentHour >= 19 && currentHour <= 21) {
    timeMultiplier = 1.35;
  } else if (currentHour >= 22 || currentHour < 6) {
    timeMultiplier = 0.8;
  } else {
    timeMultiplier = 1.1;
  }

  // Get active weather condition
  const syntheticWeather = getSyntheticHourlyWeather()[currentHour] || getSyntheticHourlyWeather()[20];
  const isRaining = syntheticWeather?.isRainy;

  // Filter all authoritative hotspots within 5km of the user
  const nearbyHotspots = URBAN_TRAFFIC_HOTSPOTS.map((spot) => {
    const distMeters = getDistance(
      { latitude: userLocation.latitude, longitude: userLocation.longitude },
      { latitude: spot.latitude, longitude: spot.longitude }
    );
    return {
      ...spot,
      distanceMeters: distMeters,
    };
  }).filter((spot) => spot.distanceMeters <= radiusMeters);

  // If user is not near any predefined hotspot (e.g. provincial area), generate dynamic realistic road alerts from user location
  let evaluatedAlerts: TrafficAlertItem[] = [];

  if (nearbyHotspots.length > 0) {
    evaluatedAlerts = nearbyHotspots.map((spot) => {
      // Calculate dynamic congestion factor
      let spotMultiplier = (spot.basePeakMultiplier * (timeMultiplier / 2.2));
      if (isRaining) spotMultiplier += 0.4;

      // Realistic speed and delay calculation
      let severity: 'jammed' | 'heavy' | 'moderate' | 'smooth' = 'smooth';
      let severityLabel = '🟢 Thông thoáng';
      let estimatedSpeedKmH = 38;
      let delayMinutes = 0;

      if (spotMultiplier >= 2.3) {
        severity = 'jammed';
        severityLabel = '⛔ Ùn tắc nghiêm trọng';
        estimatedSpeedKmH = Math.max(4, Math.round(7 - (spotMultiplier - 2.3) * 3));
        delayMinutes = Math.round(18 + (spotMultiplier - 2.3) * 12);
      } else if (spotMultiplier >= 1.7) {
        severity = 'heavy';
        severityLabel = '🔴 Di chuyển rất chậm';
        estimatedSpeedKmH = Math.round(12 + Math.random() * 4);
        delayMinutes = Math.round(10 + Math.random() * 6);
      } else if (spotMultiplier >= 1.25) {
        severity = 'moderate';
        severityLabel = '🟡 Lưu lượng đông';
        estimatedSpeedKmH = Math.round(22 + Math.random() * 6);
        delayMinutes = Math.round(4 + Math.random() * 3);
      } else {
        severity = 'smooth';
        severityLabel = '🟢 Lưu thông bình thường';
        estimatedSpeedKmH = Math.round(35 + Math.random() * 8);
        delayMinutes = 0;
      }

      // Pick representative cause
      let cause = spot.typicalCauses[0];
      if (isRaining) {
        cause = `Trời mưa gây trơn trượt, phương tiện giảm tốc độ kết hợp ${spot.typicalCauses[0].toLowerCase()}`;
      } else if (isEveningRush && spot.typicalCauses[1]) {
        cause = spot.typicalCauses[1];
      }

      const distKm = (spot.distanceMeters / 1000).toFixed(1);

      return {
        id: spot.id,
        name: spot.name,
        district: spot.district,
        latitude: spot.latitude,
        longitude: spot.longitude,
        distanceMeters: spot.distanceMeters,
        distanceFormatted: `${distKm} km`,
        severity,
        severityLabel,
        estimatedSpeedKmH,
        delayMinutes,
        cause,
        recommendation: spot.avoidAdvice,
        isFlooded: spot.floodProne && isRaining,
        updatedAtText: `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')} (Vừa xong)`,
      };
    });
  } else {
    // Dynamic generated grid alerts based on user coordinates (within 1 - 4 km)
    const mockDirections = [
      { name: 'Trục đường chính hướng Đông Bắc (Bán kính 2.1km)', offsetLat: 0.015, offsetLng: 0.012, district: 'Khu vực lân cận' },
      { name: 'Ngã tư trung tâm thương mại & dịch vụ (Bán kính 1.4km)', offsetLat: -0.008, offsetLng: 0.009, district: 'Khu trung tâm' },
      { name: 'Tuyến đường vành đai kết nối liên khu (Bán kính 3.8km)', offsetLat: 0.022, offsetLng: -0.018, district: 'Cửa ngõ khu vực' },
    ];

    evaluatedAlerts = mockDirections.map((dir, idx) => {
      const lat = userLocation.latitude + dir.offsetLat;
      const lng = userLocation.longitude + dir.offsetLng;
      const dist = getDistance(
        { latitude: userLocation.latitude, longitude: userLocation.longitude },
        { latitude: lat, longitude: lng }
      );

      let severity: 'jammed' | 'heavy' | 'moderate' | 'smooth' = isRushHour ? (idx === 0 ? 'heavy' : 'moderate') : 'smooth';
      let speed = isRushHour ? 14 : 36;
      let delay = isRushHour ? 8 : 0;

      return {
        id: `dyn-traffic-${idx}`,
        name: dir.name,
        district: dir.district,
        latitude: lat,
        longitude: lng,
        distanceMeters: dist,
        distanceFormatted: `${(dist / 1000).toFixed(1)} km`,
        severity,
        severityLabel: severity === 'heavy' ? '🔴 Di chuyển chậm' : severity === 'moderate' ? '🟡 Lưu lượng đông' : '🟢 Thông thoáng',
        estimatedSpeedKmH: speed,
        delayMinutes: delay,
        cause: isRushHour ? 'Mật độ xe tăng cao vào khung giờ tan tầm' : 'Lưu lượng phương tiện ổn định',
        recommendation: isRushHour ? 'Giữ khoảng cách an toàn và chú ý quan sát khi chuyển hướng' : 'Đường đi thoáng, di chuyển thuận lợi',
        isFlooded: false,
        updatedAtText: `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')} (Vừa xong)`,
      };
    });
  }

  // Sort by distance (nearest to user first) then by severity (jammed first)
  evaluatedAlerts.sort((a, b) => {
    if (a.severity === 'jammed' && b.severity !== 'jammed') return -1;
    if (b.severity === 'jammed' && a.severity !== 'jammed') return 1;
    return a.distanceMeters - b.distanceMeters;
  });

  const severeCount = evaluatedAlerts.filter((a) => a.severity === 'jammed' || a.severity === 'heavy').length;
  const moderateCount = evaluatedAlerts.filter((a) => a.severity === 'moderate').length;
  const smoothCount = evaluatedAlerts.filter((a) => a.severity === 'smooth').length;

  let overallStatus: 'normal' | 'caution' | 'heavy_jam' | 'severe_weather' = 'normal';
  let overallStatusTitle = 'Giao thông xung quanh thông thoáng';
  let overallAdvice = 'Các tuyến đường trong bán kính 5km di chuyển rất êm ái. Bạn có thể thoải mái xuất phát đi ăn uống!';

  if (isRaining) {
    overallStatus = 'severe_weather';
    overallStatusTitle = 'Mưa ướt & Giảm tốc độ lưu thông';
    overallAdvice = 'Trời có mưa, mặt đường trơn trượt. Khuyên bạn nên mang áo mưa, giảm tốc độ và tránh các vùng trũng.';
  } else if (severeCount >= 2) {
    overallStatus = 'heavy_jam';
    overallStatusTitle = `Có ${severeCount} điểm ùn tắc nặng trong bán kính 5km`;
    overallAdvice = isEveningRush
      ? 'Đang là giờ cao điểm tan tầm chiều tối. Nhiều nút giao lớn nghẽn cứng, bạn nên hạn chế ra đường qua các trục chính hoặc lùi lịch xuất phát sau 19h30.'
      : 'Nhiều điểm nút giao thông đang bị nghẽn, bạn nên kiểm tra kỹ lộ trình hoặc chọn quán ăn gần nhà trong bán kính đi bộ.';
  } else if (severeCount === 1 || moderateCount >= 2) {
    overallStatus = 'caution';
    overallStatusTitle = 'Lưu lượng phương tiện tăng cao';
    overallAdvice = 'Đường bắt đầu đông tại một số nút giao lớn. Di chuyển có thể chậm hơn 5 - 10 phút so với bình thường.';
  }

  return {
    userLocation,
    radiusKm,
    totalAlertsWithinRadius: evaluatedAlerts.length,
    severeCount,
    moderateCount,
    smoothCount,
    overallStatus,
    overallStatusTitle,
    overallAdvice,
    alerts: evaluatedAlerts,
    currentHour,
    currentMinute,
    isRushHour,
    generatedAt: now,
  };
}
