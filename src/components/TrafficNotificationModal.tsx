/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import {
  checkNearbyRealtimeTraffic,
  TrafficAlertItem,
  NearbyTrafficStatusReport,
} from '../services/maps/trafficAlertsService';

interface TrafficNotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  userLocation: { latitude: number; longitude: number };
  districtName?: string;
  onSelectHotspotOnMap?: (hotspot: { latitude: number; longitude: number; name: string }) => void;
  onOpenTrafficNavigator?: () => void;
}

export const TrafficNotificationModal: React.FC<TrafficNotificationModalProps> = ({
  isOpen,
  onClose,
  userLocation,
  districtName = 'Cầu Giấy',
  onSelectHotspotOnMap,
  onOpenTrafficNavigator,
}) => {
  const [filterSeverity, setFilterSeverity] = useState<'all' | 'severe'>('all');
  const [refreshKey, setRefreshKey] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Generate realtime traffic calculation
  const report: NearbyTrafficStatusReport = useMemo(() => {
    const loc = userLocation || { latitude: 21.0285, longitude: 105.7958 };
    return checkNearbyRealtimeTraffic(loc, 5.0);
  }, [userLocation, refreshKey]);

  // Handle quick refresh
  const handleManualRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setRefreshKey((prev) => prev + 1);
      setIsRefreshing(false);
    }, 400);
  };

  // Close on ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const displayAlerts = useMemo(() => {
    if (filterSeverity === 'severe') {
      return report.alerts.filter((a) => a.severity === 'jammed' || a.severity === 'heavy');
    }
    return report.alerts;
  }, [report.alerts, filterSeverity]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-xs animate-fade-in pointer-events-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="traffic-notify-title"
      onClick={onClose}
    >
      {/* Notification Sheet Card */}
      <div
        className="relative w-full max-w-md max-h-[85vh] bg-white rounded-3xl shadow-2xl border border-stone-200 flex flex-col overflow-hidden text-[#2D2926]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 1. Header (Gọn gàng, chuẩn thông báo) */}
        <div className="px-4 py-3.5 bg-stone-50/90 border-b border-stone-200/80 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-base shrink-0">
              🔔
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 id="traffic-notify-title" className="font-heading text-sm font-bold text-[#2D2926] truncate">
                  Thông báo tắc đường
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-[10px] font-bold">
                  5km quanh bạn
                </span>
              </div>
              <p className="text-[11px] text-stone-500 font-medium truncate">
                Khu vực {districtName} • Cập nhật lúc {report.currentHour.toString().padStart(2, '0')}:{report.currentMinute.toString().padStart(2, '0')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={handleManualRefresh}
              className={`w-7.5 h-7.5 rounded-full hover:bg-stone-200 text-stone-600 flex items-center justify-center transition-all cursor-pointer ${
                isRefreshing ? 'animate-spin' : ''
              }`}
              title="Làm mới"
            >
              <span className="material-symbols-outlined text-[18px]">refresh</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-7.5 h-7.5 rounded-full hover:bg-stone-200 text-stone-600 flex items-center justify-center transition-all cursor-pointer"
              title="Đóng"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>
        </div>

        {/* 2. Quick Filter Pill */}
        <div className="px-4 py-2 bg-white border-b border-stone-100 flex items-center justify-between gap-2 shrink-0">
          <span className="text-xs text-stone-500 font-medium">
            {report.severeCount > 0 ? (
              <span className="text-red-600 font-bold">⚠️ Có {report.severeCount} điểm đang ùn tắc / kẹt</span>
            ) : (
              <span className="text-emerald-700 font-medium">🟢 Xung quanh chưa có điểm tắc lớn</span>
            )}
          </span>

          {report.severeCount > 0 && (
            <button
              type="button"
              onClick={() => setFilterSeverity((prev) => (prev === 'all' ? 'severe' : 'all'))}
              className={`px-2.5 py-0.5 rounded-full text-[11px] font-heading font-bold transition-all cursor-pointer ${
                filterSeverity === 'severe'
                  ? 'bg-red-600 text-white'
                  : 'bg-stone-100 hover:bg-stone-200 text-stone-700'
              }`}
            >
              {filterSeverity === 'severe' ? 'Xem tất cả' : 'Chỉ xem điểm tắc'}
            </button>
          )}
        </div>

        {/* 3. Danh sách thông báo ngắn gọn: Đường nào tắc + Cách bao xa + Dự kiến trễ bao lâu */}
        <div className="flex-1 overflow-y-auto divide-y divide-stone-100 p-2 sm:p-3 space-y-1">
          {displayAlerts.length === 0 ? (
            <div className="p-6 text-center text-stone-500 text-xs">
              Không có điểm nghẽn giao thông nào.
            </div>
          ) : (
            displayAlerts.map((alert) => {
              const isJammed = alert.severity === 'jammed' || alert.severity === 'heavy';
              const isModerate = alert.severity === 'moderate';

              return (
                <div
                  key={alert.id}
                  className={`p-3 rounded-2xl transition-all flex items-start gap-3 hover:bg-stone-50 ${
                    isJammed ? 'bg-red-50/40' : isModerate ? 'bg-amber-50/30' : 'bg-white'
                  }`}
                >
                  {/* Status Indicator Dot/Icon */}
                  <div className="mt-0.5 shrink-0 text-base">
                    {isJammed ? '⛔' : isModerate ? '🟡' : '🟢'}
                  </div>

                  {/* Info: Đường nào, Khoảng cách, Trễ bao lâu */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <h3 className="font-heading font-bold text-xs sm:text-[13px] text-[#2D2926] leading-snug">
                        {alert.name}
                      </h3>
                      <span
                        className={`text-[11px] font-heading font-bold px-2 py-0.5 rounded-full shrink-0 whitespace-nowrap ${
                          isJammed
                            ? 'bg-red-100 text-red-700'
                            : isModerate
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {isJammed ? 'Đang tắc' : isModerate ? 'Lượng xe đông' : 'Thông thoáng'}
                      </span>
                    </div>

                    {/* Dòng tóm tắt cốt lõi: Cách X km • Trễ ~ Y phút */}
                    <div className="mt-1 flex items-center gap-2 text-xs text-stone-600 font-medium">
                      <span>
                        📍 Cách <strong className="text-[#FF6B35] font-bold">{alert.distanceFormatted}</strong>
                      </span>
                      <span>•</span>
                      <span>
                        ⏱️ {alert.delayMinutes > 0 ? (
                          <>Trễ khoảng <strong className="text-red-600 font-bold">~{alert.delayMinutes} phút</strong></>
                        ) : (
                          <span className="text-emerald-700 font-medium">Không bị trễ</span>
                        )}
                      </span>
                    </div>

                    {/* Quick Button to Map */}
                    {onSelectHotspotOnMap && (
                      <div className="mt-2 flex items-center justify-end">
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            onSelectHotspotOnMap({
                              latitude: alert.latitude,
                              longitude: alert.longitude,
                              name: alert.name,
                            });
                          }}
                          className="text-[11px] font-heading font-bold text-[#FF6B35] hover:underline flex items-center gap-0.5 cursor-pointer"
                        >
                          <span>Xem trên bản đồ</span>
                          <span className="material-symbols-outlined text-[13px]">arrow_forward</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* 4. Bottom Quick Action */}
        {onOpenTrafficNavigator && (
          <div className="p-3 bg-stone-50 border-t border-stone-200/80 flex items-center justify-between gap-2 shrink-0">
            <span className="text-[11px] text-stone-500 font-medium">
              Tìm đường né các điểm tắc trên?
            </span>
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenTrafficNavigator();
              }}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-heading text-xs font-bold rounded-xl shadow-2xs transition-all active:scale-95 cursor-pointer flex items-center gap-1"
            >
              <span>🚦 Mở chỉ đường né tắc</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
