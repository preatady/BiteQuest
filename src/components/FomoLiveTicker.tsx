/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Place } from '../types';

export interface FomoEvent {
  id: string;
  type: 'hot_checkin' | 'flash_quest' | 'first_bite' | 'friend_activity' | 'mystery_drop' | 'traffic_tip';
  icon: string;
  message: string;
  subtext: string;
  badge: string;
  placeId?: string;
  placeName?: string;
  coordinates?: { latitude: number; longitude: number };
}

interface FomoLiveTickerProps {
  places: Place[];
  onSelectPlaceByCoords?: (latitude: number, longitude: number, placeId?: string) => void;
  onOpenMysteryDrop?: () => void;
  onOpenTrafficSheet?: () => void;
  className?: string;
}

export const FomoLiveTicker: React.FC<FomoLiveTickerProps> = ({
  places,
  onSelectPlaceByCoords,
  onOpenMysteryDrop,
  onOpenTrafficSheet,
  className = '',
}) => {
  const [events, setEvents] = useState<FomoEvent[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    // Generate dynamic FOMO events based on actual places
    const dynamicEvents: FomoEvent[] = [];

    // 1. Mystery drop event
    dynamicEvents.push({
      id: 'event-drop',
      type: 'mystery_drop',
      icon: '🎁',
      message: 'Rương Bí Mật vừa xuất hiện gần bạn!',
      subtext: 'Mở ngay để nhận +150 XP Khám Phá',
      badge: 'Còn 15p',
    });

    // 2. Traffic tip event
    dynamicEvents.push({
      id: 'event-traffic',
      type: 'traffic_tip',
      icon: '🚦',
      message: 'Tìm quán né kẹt xe & dự báo giờ đi',
      subtext: 'Tính toán đường thông thoáng nhất cho 8h tối',
      badge: 'Lưu thông',
    });

    // 3. High rated or popular places (only 1 or 2 best)
    const popularPlaces = places.filter((p) => (p.rating && p.rating >= 4.5) || (p.verifiedBiteCount && p.verifiedBiteCount > 0)).slice(0, 2);
    popularPlaces.forEach((p, idx) => {
      const visitorCount = p.verifiedBiteCount ? p.verifiedBiteCount + 3 : 5 + idx * 2;
      dynamicEvents.push({
        id: `event-pop-${p.id}`,
        type: 'hot_checkin',
        icon: '🔥',
        message: `${p.name}: ${visitorCount} foodies vừa check-in`,
        subtext: 'Đang rất đông & phục vụ nhanh',
        badge: 'Đang Hot',
        placeId: p.id,
        placeName: p.name,
        coordinates: { latitude: p.latitude, longitude: p.longitude },
      });
    });

    setEvents(dynamicEvents);
  }, [places]);

  // Auto rotate ticker every 5.5 seconds unless hovered
  useEffect(() => {
    if (events.length === 0 || isHovered || isDismissed) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % events.length);
    }, 5500);
    return () => clearInterval(interval);
  }, [events.length, isHovered, isDismissed]);

  if (events.length === 0 || isDismissed) return null;

  const currentEvent = events[currentIndex];

  const handleClick = () => {
    if (currentEvent.type === 'mystery_drop') {
      onOpenMysteryDrop?.();
    } else if (currentEvent.type === 'traffic_tip') {
      onOpenTrafficSheet?.();
    } else if (currentEvent.coordinates) {
      onSelectPlaceByCoords?.(
        currentEvent.coordinates.latitude,
        currentEvent.coordinates.longitude,
        currentEvent.placeId
      );
    }
  };

  return (
    <div
      className={`pointer-events-auto transition-all duration-300 ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      id="live-activity-toast-pill"
    >
      <div className="bg-white/96 hover:bg-white text-stone-800 backdrop-blur-md rounded-2xl py-1.5 px-3 border border-stone-200/90 shadow-[0_6px_22px_rgba(45,41,38,0.12)] flex items-center justify-between gap-2.5 transition-all animate-slide-up group max-w-sm">
        {/* Main Clickable Content */}
        <button
          type="button"
          onClick={handleClick}
          className="flex-1 flex items-center gap-2 min-w-0 text-left cursor-pointer"
        >
          {/* Animated Activity Dot & Icon */}
          <div className="relative shrink-0 flex items-center justify-center w-6 h-6 rounded-xl bg-orange-50 text-[#FF6B35] text-xs">
            <span>{currentEvent.icon}</span>
            <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#FF6B35]"></span>
            </span>
          </div>

          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="font-heading text-xs font-bold text-stone-900 truncate group-hover:text-[#FF6B35] transition-colors">
                {currentEvent.message}
              </span>
              <span className="text-[9px] font-heading font-extrabold px-1.5 py-0.2 rounded-md bg-orange-100 text-orange-800 border border-orange-200/60 shrink-0">
                {currentEvent.badge}
              </span>
            </div>
            <span className="text-[10px] text-stone-500 truncate">
              {currentEvent.subtext}
            </span>
          </div>
        </button>

        {/* Dismiss Button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsDismissed(true);
          }}
          className="w-5 h-5 rounded-full hover:bg-stone-100 text-stone-400 hover:text-stone-700 flex items-center justify-center text-[10px] shrink-0 transition-colors cursor-pointer"
          title="Ẩn thông báo"
          aria-label="Ẩn thông báo"
          id="btn-dismiss-fomo-toast"
        >
          ✕
        </button>
      </div>
    </div>
  );
};
