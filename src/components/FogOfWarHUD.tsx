/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { calculateExplorerStats } from '../services/maps/fogOfWarHelper';

interface FogOfWarHUDProps {
  totalVenues: number;
  visitedCount: number;
  districtName?: string;
  isRadarBoosted: boolean;
  onTriggerRadarScan: () => void;
  onExitFogMode?: () => void;
}

export const FogOfWarHUD: React.FC<FogOfWarHUDProps> = ({
  totalVenues,
  visitedCount,
  districtName = 'Cầu Giấy',
  isRadarBoosted,
  onTriggerRadarScan,
  onExitFogMode,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const stats = calculateExplorerStats(totalVenues, visitedCount, districtName);

  return (
    <>
      {/* Non-intrusive Floating Explorer Badge - Positioned neatly without overlapping search/filter bar */}
      <div className="absolute top-28 right-3 z-20 pointer-events-auto animate-fade-in">
        {!isExpanded ? (
          /* Compact Mini Pill (Uncluttered View) */
          <div className="flex items-center gap-1.5 bg-[#0B1120]/90 backdrop-blur-md text-white rounded-2xl py-1.5 px-3 border border-sky-500/30 shadow-lg">
            <button
              type="button"
              onClick={() => setIsExpanded(true)}
              className="flex items-center gap-2 cursor-pointer text-left hover:opacity-90"
              title="Mở bảng thông tin Thám hiểm Sương Mù"
            >
              <span className="text-sm">🌫️</span>
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-sky-200 leading-tight">
                  Mở sáng {stats.percentage}%
                </span>
                <span className="text-[9px] text-slate-400">
                  {stats.unlockedZonesCount} vùng sáng
                </span>
              </div>
            </button>

            <div className="h-4 w-px bg-slate-700 mx-0.5"></div>

            <button
              type="button"
              onClick={onTriggerRadarScan}
              disabled={isRadarBoosted}
              className={`p-1.5 rounded-xl text-[11px] font-bold transition-all cursor-pointer ${
                isRadarBoosted
                  ? 'bg-sky-500 text-white animate-pulse'
                  : 'bg-sky-600/80 hover:bg-sky-500 text-white'
              }`}
              title="Quét Radar mở rộng tầm nhìn (+600m)"
            >
              <span>{isRadarBoosted ? '📡...' : '📡 Quét'}</span>
            </button>

            {onExitFogMode && (
              <button
                type="button"
                onClick={onExitFogMode}
                className="w-5 h-5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center text-[10px] cursor-pointer"
                title="Tắt chế độ sương mù"
              >
                ✕
              </button>
            )}
          </div>
        ) : (
          /* Full Expanded Status Card */
          <div className="bg-[#0B1120]/95 backdrop-blur-md text-white rounded-3xl p-4 border border-sky-500/30 shadow-2xl w-80 flex flex-col gap-3 animate-slide-up">
            {/* Header Row */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center text-base shadow-sm">
                  {stats.badgeIcon}
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center gap-1.5">
                    <span className="font-heading text-xs font-bold text-sky-200">
                      Sương Mù RPG
                    </span>
                    <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                      x1.5 XP
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400 font-medium">
                    {stats.rank}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setShowGuide(true)}
                  className="w-7 h-7 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center text-xs transition-colors cursor-pointer"
                  title="Luật chơi"
                >
                  ❓
                </button>
                <button
                  type="button"
                  onClick={() => setIsExpanded(false)}
                  className="w-7 h-7 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center text-xs transition-colors cursor-pointer"
                  title="Thu gọn"
                >
                  ▲
                </button>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-300 font-medium">
                  🗺️ Đã mở sáng ({stats.districtName})
                </span>
                <span className="font-bold text-sky-400 font-mono">
                  {stats.percentage}%
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden p-0.5 border border-slate-700">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-sky-400 via-teal-400 to-amber-400 transition-all duration-700 shadow-[0_0_8px_rgba(56,189,248,0.6)]"
                  style={{ width: `${stats.percentage}%` }}
                ></div>
              </div>
              <div className="flex items-center justify-between text-[10px] text-slate-400 mt-0.5">
                <span>🔥 {stats.unlockedZonesCount} vùng sáng</span>
                <span>Mục tiêu: {stats.nextMilestone}%</span>
              </div>
            </div>

            {/* Action Row */}
            <div className="pt-1 flex items-center gap-2 border-t border-slate-800">
              <button
                type="button"
                onClick={onTriggerRadarScan}
                disabled={isRadarBoosted}
                className={`flex-1 py-2 px-3 rounded-xl font-heading text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  isRadarBoosted
                    ? 'bg-sky-500 text-white animate-pulse shadow-[0_0_12px_rgba(56,189,248,0.5)]'
                    : 'bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white shadow-md active:scale-95'
                }`}
              >
                <span>{isRadarBoosted ? '📡 Đang quét sóng...' : '📡 Quét Radar (+600m)'}</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Guide Modal */}
      {showGuide && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setShowGuide(false)}
        >
          <div
            className="bg-[#0B1120] text-white w-full max-w-sm rounded-3xl p-5 border border-sky-500/30 shadow-2xl flex flex-col gap-4 animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl">🌫️</span>
                <h3 className="font-heading font-bold text-base text-sky-200">
                  Thám Hiểm Sương Mù
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="w-7 h-7 rounded-full bg-slate-800 text-slate-300 flex items-center justify-center text-xs"
              >
                ✕
              </button>
            </div>

            <div className="flex flex-col gap-2.5 text-xs text-slate-300 leading-relaxed">
              <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 flex items-start gap-2.5">
                <span className="text-base">📍</span>
                <div>
                  <strong className="text-white">Tầm nhìn thám hiểm:</strong> Bạn luôn có vùng sáng bán kính ~650m quanh vị trí GPS thực tế.
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 flex items-start gap-2.5">
                <span className="text-base">🔥</span>
                <div>
                  <strong className="text-white">Ngọn hải đăng vĩnh viễn:</strong> Khi check-in quán ăn, khu vực đó sẽ được mở sáng vĩnh viễn trên bản đồ!
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 flex items-start gap-2.5">
                <span className="text-base">📡</span>
                <div>
                  <strong className="text-white">Quét Radar:</strong> Phát sóng siêu âm mở rộng tầm nhìn trong 6 giây để săn tìm các quán ăn ẩn sâu trong ngõ.
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowGuide(false)}
              className="w-full py-2.5 bg-sky-600 hover:bg-sky-500 text-white font-heading font-bold text-xs rounded-xl transition-colors"
            >
              Đã hiểu, tiếp tục khám phá!
            </button>
          </div>
        </div>
      )}
    </>
  );
};
