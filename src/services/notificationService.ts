/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type NotificationCategory = 'traffic' | 'achievement' | 'quest' | 'discovery' | 'system';

export interface AppNotification {
  id: string;
  category: NotificationCategory;
  title: string;
  message: string;
  timestamp: Date;
  timeFormatted: string;
  isRead: boolean;
  actionUrl?: string;
  actionType?: 'map_focus' | 'open_traffic' | 'open_passport' | 'open_quest' | 'open_profile';
  metadata?: {
    latitude?: number;
    longitude?: number;
    placeName?: string;
    distanceFormatted?: string;
    delayMinutes?: number;
    xpEarned?: number;
    badgeName?: string;
    progressText?: string;
  };
}

/**
 * Generate initial realistic notifications list tailored for BiteQuest
 */
export function getInitialNotifications(
  userLocation: { latitude: number; longitude: number } = { latitude: 21.0285, longitude: 105.7958 },
  districtName: string = 'Cầu Giấy'
): AppNotification[] {
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();

  const isRushHour =
    (currentHour >= 7 && currentHour <= 9) || (currentHour >= 16 && currentHour <= 19);

  return [
    {
      id: 'notif-traffic-1',
      category: 'traffic',
      title: 'Cảnh báo tắc đường giờ cao điểm',
      message: `Trục Cầu Giấy - Xuân Thủy đang ùn tắc kéo dài do lượng xe tan tầm dồn về.`,
      timestamp: new Date(now.getTime() - 1000 * 60 * 8), // 8 mins ago
      timeFormatted: '8 phút trước',
      isRead: false,
      actionType: 'map_focus',
      metadata: {
        latitude: 21.0365,
        longitude: 105.7895,
        placeName: 'Trục Cầu Giấy - Xuân Thủy',
        distanceFormatted: '1.4 km',
        delayMinutes: isRushHour ? 16 : 6,
      },
    },
    {
      id: 'notif-traffic-2',
      category: 'traffic',
      title: 'Lưu lượng xe đông tại nút giao',
      message: 'Ngã tư Nguyễn Trãi - Khuất Duy Tiến lượng phương tiện tăng cao, di chuyển chậm.',
      timestamp: new Date(now.getTime() - 1000 * 60 * 25), // 25 mins ago
      timeFormatted: '25 phút trước',
      isRead: false,
      actionType: 'map_focus',
      metadata: {
        latitude: 20.9925,
        longitude: 105.8045,
        placeName: 'Nút giao Nguyễn Trãi - Khuất Duy Tiến',
        distanceFormatted: '3.2 km',
        delayMinutes: 10,
      },
    },
    {
      id: 'notif-achieve-1',
      category: 'achievement',
      title: 'Mở khóa thành tựu mới! 🎉',
      message: `Bạn vừa mở khóa danh hiệu "Chuyên Gia Ăn Đêm" và được cộng điểm kinh nghiệm.`,
      timestamp: new Date(now.getTime() - 1000 * 60 * 60 * 2), // 2 hours ago
      timeFormatted: '2 giờ trước',
      isRead: false,
      actionType: 'open_profile',
      metadata: {
        xpEarned: 150,
        badgeName: 'Chuyên Gia Ăn Đêm',
      },
    },
    {
      id: 'notif-discovery-1',
      category: 'discovery',
      title: 'Mở rộng bản đồ ẩm thực 🗺️',
      message: `Bạn vừa khám phá thêm 1 khu vực sương mù mới tại phường Dịch Vọng Hậu (${districtName}).`,
      timestamp: new Date(now.getTime() - 1000 * 60 * 60 * 5), // 5 hours ago
      timeFormatted: '5 giờ trước',
      isRead: true,
      actionType: 'open_passport',
      metadata: {
        progressText: '+15% Bản đồ',
      },
    },
    {
      id: 'notif-quest-1',
      category: 'quest',
      title: 'Tiến độ nhiệm vụ ẩm thực 🍜',
      message: 'Nhiệm vụ tuần "Thưởng thức 3 quán Phở gia truyền" đã hoàn thành 2/3 quán.',
      timestamp: new Date(now.getTime() - 1000 * 60 * 60 * 20), // 20 hours ago
      timeFormatted: 'Hôm qua',
      isRead: true,
      actionType: 'open_quest',
      metadata: {
        progressText: '2/3 quán',
      },
    },
    {
      id: 'notif-sys-1',
      category: 'system',
      title: 'Cập nhật tính năng mới ✨',
      message: 'BiteQuest đã cập nhật Radar giao thông Realtime và Bộ so sánh quán ăn thông minh.',
      timestamp: new Date(now.getTime() - 1000 * 60 * 60 * 48), // 2 days ago
      timeFormatted: '2 ngày trước',
      isRead: true,
    },
  ];
}
