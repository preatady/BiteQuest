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
      subtext: 'Mở ngay để nhận +150 XP & Deal x2',
      badge: 'Còn 15p',
    });

    // 2. Traffic tip event
    dynamicEvents.push({
      id: 'event-traffic',
      type: 'traffic_tip',
      icon: '🚦',
      message: 'Tìm quán né kẹt xe & dự báo giờ đi',
      subtext: 'Tính toán đường thông thoáng nhất cho 8h tối',
      badge: 'AI Traffic',
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
      <div className="w-full bg-[#1C1917]/90 hover:bg-[#24201D]/95 backdrop-blur-md text-white rounded-2xl py-1.5 px-2.5 border border-amber-500/25 shadow-md flex items-center justify-between gap-2 transition-all">
        {/* Main Clickable Area */}
        <button
          type="button"
          onClick={handleClick}
          className="flex-1 flex items-center gap-2 min-w-0 text-left cursor-pointer group"
        >
          <div className="relative w-6 h-6 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-xs shadow-xs shrink-0">
            <span>{currentEvent.icon}</span>
          </div>

          <div className="flex items-center gap-1.5 min-w-0 overflow-hidden">
            <span className="font-heading text-xs font-bold text-amber-200 truncate group-hover:text-amber-300">
              {currentEvent.message}
            </span>
            <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-amber-500/25 text-amber-300 font-bold border border-amber-500/30 shrink-0">
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
          className="w-5 h-5 rounded-full bg-stone-800 hover:bg-stone-700 text-stone-400 hover:text-white flex items-center justify-center text-[10px] shrink-0 transition-colors cursor-pointer"
          title="Ẩn thông báo"
        >
          ✕
        </button>
      </div>
    </div>
  );
};
