/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { AppNotification, NotificationCategory } from '../services/notificationService';

interface NotificationCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: AppNotification[];
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onDeleteNotification: (id: string) => void;
  onClearAllNotifications: () => void;
  onSelectTrafficHotspot?: (hotspot: { latitude: number; longitude: number; name: string }) => void;
  onNavigateToTab?: (tab: 'explore' | 'passport' | 'profile' | 'radar') => void;
}

export const NotificationCenterModal: React.FC<NotificationCenterModalProps> = ({
  isOpen,
  onClose,
  notifications,
  onMarkAsRead,
  onMarkAllAsRead,
  onDeleteNotification,
  onClearAllNotifications,
  onSelectTrafficHotspot,
  onNavigateToTab,
}) => {
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'unread' | 'traffic' | 'activity'>('all');

  // Close modal on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const filteredNotifications = notifications.filter((n) => {
    if (selectedFilter === 'unread') return !n.isRead;
    if (selectedFilter === 'traffic') return n.category === 'traffic';
    if (selectedFilter === 'activity') return n.category === 'achievement' || n.category === 'quest' || n.category === 'discovery';
    return true;
  });

  const handleNotificationClick = (n: AppNotification) => {
    if (!n.isRead) {
      onMarkAsRead(n.id);
    }

    if (n.category === 'traffic' && n.metadata?.latitude && n.metadata?.longitude && onSelectTrafficHotspot) {
      onClose();
      onSelectTrafficHotspot({
        latitude: n.metadata.latitude,
        longitude: n.metadata.longitude,
        name: n.metadata.placeName || n.title,
      });
    } else if (n.category === 'achievement' && onNavigateToTab) {
      onClose();
      onNavigateToTab('profile');
    } else if (n.category === 'discovery' && onNavigateToTab) {
      onClose();
      onNavigateToTab('passport');
    }
  };

  const getCategoryIcon = (category: NotificationCategory) => {
    switch (category) {
      case 'traffic':
        return {
          icon: '🚦',
          bg: 'bg-red-50 text-red-600 border-red-100',
          badgeText: 'Giao thông',
          badgeColor: 'bg-red-50 text-red-700 border-red-200/80',
        };
      case 'achievement':
        return {
          icon: '🏆',
          bg: 'bg-amber-50 text-amber-600 border-amber-100',
          badgeText: 'Thành tựu',
          badgeColor: 'bg-amber-50 text-amber-700 border-amber-200/80',
        };
      case 'quest':
        return {
          icon: '🍜',
          bg: 'bg-orange-50 text-orange-600 border-orange-100',
          badgeText: 'Nhiệm vụ',
          badgeColor: 'bg-orange-50 text-orange-700 border-orange-200/80',
        };
      case 'discovery':
        return {
          icon: '🗺️',
          bg: 'bg-emerald-50 text-emerald-600 border-emerald-100',
          badgeText: 'Khám phá',
          badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
        };
      default:
        return {
          icon: '✨',
          bg: 'bg-blue-50 text-blue-600 border-blue-100',
          badgeText: 'Cập nhật',
          badgeColor: 'bg-blue-50 text-blue-700 border-blue-200/80',
        };
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-xs animate-fade-in pointer-events-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="notif-center-title"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg max-h-[85vh] bg-[#FDFCF8] rounded-3xl shadow-2xl border border-stone-200/90 flex flex-col overflow-hidden text-[#2D2926]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 1. Header sắc nét chuẩn thông báo */}
        <div className="px-4 py-3.5 sm:px-6 sm:py-4 bg-white border-b border-stone-200/80 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-2xl bg-stone-100 flex items-center justify-center text-stone-700 shrink-0">
              <span className="material-symbols-outlined text-[20px]">notifications</span>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 id="notif-center-title" className="font-heading text-base font-bold text-[#2D2926]">
                  Thông báo
                </h2>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-[#FF6B35] text-white text-[11px] font-heading font-extrabold shadow-2xs">
                    {unreadCount} mới
                  </span>
                )}
              </div>
              <p className="text-[11px] text-stone-500 font-medium truncate">
                Cập nhật giao thông, thành tựu & nhiệm vụ
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={onMarkAllAsRead}
                className="px-2.5 py-1.5 text-xs font-heading font-semibold text-stone-600 hover:text-[#FF6B35] hover:bg-stone-100 rounded-xl transition-all cursor-pointer"
                title="Đánh dấu tất cả là đã đọc"
              >
                Đã đọc tất cả
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-700 flex items-center justify-center transition-all cursor-pointer"
              title="Đóng"
              aria-label="Đóng"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>
        </div>

        {/* 2. Filter Pills Tabs */}
        <div className="px-4 py-2.5 sm:px-6 bg-white border-b border-stone-100 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
          <button
            type="button"
            onClick={() => setSelectedFilter('all')}
            className={`px-3 py-1.5 rounded-full text-xs font-heading font-bold transition-all cursor-pointer shrink-0 ${
              selectedFilter === 'all'
                ? 'bg-[#2D2926] text-white shadow-2xs'
                : 'bg-stone-100 hover:bg-stone-200 text-stone-700'
            }`}
          >
            Tất cả ({notifications.length})
          </button>
          <button
            type="button"
            onClick={() => setSelectedFilter('unread')}
            className={`px-3 py-1.5 rounded-full text-xs font-heading font-bold transition-all cursor-pointer shrink-0 ${
              selectedFilter === 'unread'
                ? 'bg-[#FF6B35] text-white shadow-2xs'
                : 'bg-stone-100 hover:bg-stone-200 text-stone-700'
            }`}
          >
            Chưa đọc {unreadCount > 0 ? `(${unreadCount})` : ''}
          </button>
          <button
            type="button"
            onClick={() => setSelectedFilter('traffic')}
            className={`px-3 py-1.5 rounded-full text-xs font-heading font-bold transition-all cursor-pointer shrink-0 ${
              selectedFilter === 'traffic'
                ? 'bg-red-600 text-white shadow-2xs'
                : 'bg-red-50 hover:bg-red-100 text-red-700 border border-red-200/60'
            }`}
          >
            🚦 Giao thông (5km)
          </button>
          <button
            type="button"
            onClick={() => setSelectedFilter('activity')}
            className={`px-3 py-1.5 rounded-full text-xs font-heading font-bold transition-all cursor-pointer shrink-0 ${
              selectedFilter === 'activity'
                ? 'bg-amber-600 text-white shadow-2xs'
                : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200/60'
            }`}
          >
            🏆 Hoạt động & Điểm
          </button>
        </div>

        {/* 3. Notifications List */}
        <div className="flex-1 overflow-y-auto divide-y divide-stone-100/90 p-2 sm:p-3 space-y-1">
          {filteredNotifications.length === 0 ? (
            <div className="py-12 px-4 text-center">
              <div className="w-12 h-12 rounded-full bg-stone-100 text-stone-400 flex items-center justify-center mx-auto mb-2 text-xl">
                📭
              </div>
              <p className="font-heading font-bold text-sm text-stone-700">Không có thông báo nào</p>
              <p className="text-xs text-stone-500 mt-0.5">
                Các cập nhật mới nhất sẽ xuất hiện tại đây.
              </p>
            </div>
          ) : (
            filteredNotifications.map((notif) => {
              const meta = getCategoryIcon(notif.category);

              return (
                <div
                  key={notif.id}
                  onClick={() => handleNotificationClick(notif)}
                  className={`group relative p-3 sm:p-3.5 rounded-2xl transition-all flex items-start gap-3 cursor-pointer select-none ${
                    !notif.isRead
                      ? 'bg-white hover:bg-stone-50/90 shadow-2xs border border-orange-100'
                      : 'hover:bg-stone-100/70 bg-transparent'
                  }`}
                >
                  {/* Category Icon */}
                  <div
                    className={`w-10 h-10 rounded-2xl flex items-center justify-center text-lg shrink-0 border ${meta.bg}`}
                  >
                    {meta.icon}
                  </div>

                  {/* Content Container */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className={`text-[10px] font-heading font-extrabold px-2 py-0.5 rounded-full border ${meta.badgeColor}`}
                        >
                          {meta.badgeText}
                        </span>
                        <span className="text-[11px] text-stone-400 font-medium">
                          {notif.timeFormatted}
                        </span>
                      </div>

                      {/* Unread indicator */}
                      {!notif.isRead && (
                        <span className="w-2 h-2 rounded-full bg-[#FF6B35] shrink-0 mt-1"></span>
                      )}
                    </div>

                    <h3
                      className={`text-xs sm:text-[13px] font-heading font-bold mt-1 leading-snug ${
                        !notif.isRead ? 'text-[#2D2926]' : 'text-stone-700'
                      }`}
                    >
                      {notif.title}
                    </h3>

                    <p className="text-xs text-stone-600 mt-0.5 leading-relaxed">
                      {notif.message}
                    </p>

                    {/* Specific Data Badges (Traffic info, XP, progress) */}
                    {notif.metadata && (
                      <div className="mt-2 flex items-center gap-2 flex-wrap">
                        {/* Traffic Distance & Delay */}
                        {notif.metadata.distanceFormatted && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-stone-700 bg-stone-100 px-2 py-0.5 rounded-lg border border-stone-200/60">
                            <span>📍 Cách</span>
                            <strong className="text-[#FF6B35] font-bold">
                              {notif.metadata.distanceFormatted}
                            </strong>
                          </span>
                        )}

                        {typeof notif.metadata.delayMinutes === 'number' && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-stone-700 bg-stone-100 px-2 py-0.5 rounded-lg border border-stone-200/60">
                            <span>⏱️ Trễ:</span>
                            <strong
                              className={
                                notif.metadata.delayMinutes > 10
                                  ? 'text-red-600 font-bold'
                                  : 'text-amber-700 font-bold'
                              }
                            >
                              ~{notif.metadata.delayMinutes} phút
                            </strong>
                          </span>
                        )}

                        {/* XP Earned */}
                        {notif.metadata.xpEarned && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-heading font-extrabold text-[#FF6B35] bg-orange-50 px-2 py-0.5 rounded-lg border border-orange-200/60">
                            <span>⚡ +{notif.metadata.xpEarned} XP</span>
                          </span>
                        )}

                        {/* Progress text */}
                        {notif.metadata.progressText && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200/60">
                            <span>🎯 {notif.metadata.progressText}</span>
                          </span>
                        )}

                        {/* Quick Action Link */}
                        {notif.category === 'traffic' && notif.metadata.latitude && (
                          <span className="text-[11px] font-heading font-bold text-[#FF6B35] group-hover:underline flex items-center gap-0.5 ml-auto">
                            <span>Xem trên map</span>
                            <span className="material-symbols-outlined text-[13px]">arrow_forward</span>
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Delete Item Button on Hover */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteNotification(notif.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 w-6 h-6 rounded-full hover:bg-stone-200 text-stone-400 hover:text-stone-700 flex items-center justify-center transition-opacity shrink-0 cursor-pointer"
                    title="Xóa thông báo"
                  >
                    <span className="material-symbols-outlined text-[14px]">close</span>
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* 4. Footer */}
        <div className="px-4 py-2.5 sm:px-6 bg-white border-t border-stone-200/80 flex items-center justify-between text-xs text-stone-500 shrink-0">
          <span>{notifications.length} thông báo</span>
          {notifications.length > 0 && (
            <button
              type="button"
              onClick={onClearAllNotifications}
              className="text-[11px] font-heading font-medium text-stone-500 hover:text-red-600 transition-colors cursor-pointer"
            >
              Xóa tất cả
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
