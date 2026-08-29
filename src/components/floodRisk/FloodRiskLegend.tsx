/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { RainfallDataPoint } from '../../services/floodRisk/types';

interface FloodRiskLegendProps {
  rainfall?: RainfallDataPoint | null;
  className?: string;
}

export const FloodRiskLegend: React.FC<FloodRiskLegendProps> = ({ rainfall, className = '' }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div
      className={`bg-white/95 backdrop-blur-md rounded-2xl shadow-[0_6px_24px_rgba(45,41,38,0.12)] border border-[#2D2926]/10 p-2.5 text-[#2D2926] transition-all duration-200 z-20 pointer-events-auto ${className}`}
      id="flood-risk-legend-box"
    >
      {/* Header with quick trigger */}
      <button
        type="button"
        onClick={() => setIsExpanded((prev) => !prev)}
        className="w-full flex items-center justify-between gap-2.5 cursor-pointer text-left"
        aria-expanded={isExpanded}
      >
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-sky-500 animate-pulse"></span>
          <span className="font-heading text-xs font-bold text-[#2D2926]">
            Mức độ nguy cơ ngập
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {rainfall && rainfall.currentRainfallMmH > 0 && (
            <span className="text-[10px] px-1.5 py-0.2 rounded-full font-bold bg-blue-50 text-blue-700 border border-blue-200">
              🌧️ {rainfall.currentRainfallMmH} mm/h
            </span>
          )}
          <span className="text-xs text-[#8D7168]">
            {isExpanded ? '▲' : '▼'}
          </span>
        </div>
      </button>

      {/* Mini Color Bar (Always visible) */}
      <div className="flex items-center gap-1 mt-2">
        <div className="h-1.5 flex-1 rounded-l-full bg-sky-400" title="Thấp (0.0 - 0.25)"></div>
        <div className="h-1.5 flex-1 bg-amber-400" title="Trung bình (0.25 - 0.50)"></div>
        <div className="h-1.5 flex-1 bg-orange-500" title="Cao (0.50 - 0.75)"></div>
        <div className="h-1.5 flex-1 rounded-r-full bg-red-500" title="Rất cao (0.75 - 1.00)"></div>
      </div>

      {/* Expanded Legend and Rainfall Accumulation metrics */}
      {isExpanded && (
        <div className="mt-3 pt-2.5 border-t border-[#2D2926]/8 flex flex-col gap-2.5 animate-fade-in text-[11px]">
          {/* Risk Level Tiers */}
          <div className="grid grid-cols-2 gap-1.5">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-sky-400 shrink-0"></span>
              <span className="font-medium text-[#594139]">Thấp (0 - 25%)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shrink-0"></span>
              <span className="font-medium text-[#594139]">T.Bình (25 - 50%)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-orange-500 shrink-0"></span>
              <span className="font-medium text-[#594139]">Cao (50 - 75%)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0"></span>
              <span className="font-medium text-[#594139]">Rất cao (75%+)</span>
            </div>
          </div>

          {/* Real-time & Cumulative Rainfall Metrics */}
          {rainfall && (
            <div className="bg-[#FAF9F5] p-2 rounded-xl border border-[#2D2926]/5 flex flex-col gap-1">
              <div className="flex items-center justify-between text-[#8D7168] text-[10px] font-bold">
                <span>TÍCH LŨY MƯA</span>
                <span className="text-emerald-700 font-semibold">Open-Meteo Live</span>
              </div>
              <div className="grid grid-cols-4 gap-1 text-center font-heading">
                <div className="bg-white p-1 rounded-lg border border-stone-100">
                  <span className="block text-[9px] text-[#8D7168]">15 Phút</span>
                  <span className="text-[11px] font-bold text-[#2D2926]">{rainfall.rainfall15mMm} mm</span>
                </div>
                <div className="bg-white p-1 rounded-lg border border-stone-100">
                  <span className="block text-[9px] text-[#8D7168]">30 Phút</span>
                  <span className="text-[11px] font-bold text-[#2D2926]">{rainfall.rainfall30mMm} mm</span>
                </div>
                <div className="bg-white p-1 rounded-lg border border-stone-100">
                  <span className="block text-[9px] text-[#8D7168]">1 Giờ</span>
                  <span className="text-[11px] font-bold text-[#2D2926]">{rainfall.rainfall1hMm} mm</span>
                </div>
                <div className="bg-white p-1 rounded-lg border border-stone-100">
                  <span className="block text-[9px] text-[#8D7168]">3 Giờ</span>
                  <span className="text-[11px] font-bold text-[#2D2926]">{rainfall.rainfall3hMm} mm</span>
                </div>
              </div>
            </div>
          )}

          <p className="text-[9.5px] text-[#8D7168] italic leading-tight">
            * Tính toán theo mô hình thủy văn đa yếu tố (Cao độ tương đối, độ dốc, tập trung dòng chảy & lịch sử điểm đen).
          </p>
        </div>
      )}
    </div>
  );
};
