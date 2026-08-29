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

  // Auto rotate ticker every 5 seconds unless hovered
  useEffect(() => {
    if (events.length === 0 || isHovered || isDismissed) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % events.length);
    }, 5000);
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
    >
      <div className="w-full bg-stone-900/60 hover:bg-stone-900/80 backdrop-blur-md text-stone-200 rounded-full py-0.5 px-2.5 border border-white/10 shadow-xs flex items-center justify-between gap-2 transition-all">
        {/* Main Clickable Area */}
        <button
          type="button"
          onClick={handleClick}
          className="flex-1 flex items-center gap-1.5 min-w-0 text-left cursor-pointer group"
        >
          <span className="text-[11px] shrink-0 opacity-90">{currentEvent.icon}</span>

          <div className="flex items-center gap-1.5 min-w-0 overflow-hidden">
            <span className="font-heading text-[11px] font-medium text-stone-200 truncate group-hover:text-amber-200 transition-colors">
              {currentEvent.message}
            </span>
            <span className="text-[8px] px-1.5 py-0.2 rounded-full bg-stone-800/80 text-stone-300 font-medium border border-white/10 shrink-0">
              {currentEvent.badge}
            </span>
          </div>
        </button>

        {/* Dismiss Ticker Button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsDismissed(true);
          }}
          className="w-4 h-4 rounded-full hover:bg-stone-800 text-stone-400 hover:text-stone-200 flex items-center justify-center text-[8.5px] shrink-0 transition-colors cursor-pointer"
          title="Ẩn thông báo"
        >
          ✕
        </button>
      </div>
    </div>
  );
};
