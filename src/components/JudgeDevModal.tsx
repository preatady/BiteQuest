import React from 'react';

interface JudgeDevModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTriggerDemoFirstBite: () => void;
}

export const JudgeDevModal: React.FC<JudgeDevModalProps> = ({
  isOpen,
  onClose,
  onTriggerDemoFirstBite,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
      id="judge-dev-modal-root"
      role="dialog"
      aria-modal="true"
      aria-labelledby="judge-dev-modal-title"
    >
      <div
        className="bg-[#1C1A17] text-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col border border-white/15 animate-slide-up overflow-hidden"
        id="judge-dev-modal-content"
      >
        {/* Top Header */}
        <div className="pt-5 px-6 pb-3 flex items-center justify-between border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#2EC4B6] text-[24px]">terminal</span>
            <div>
              <h2
                id="judge-dev-modal-title"
                className="font-heading text-base font-bold text-white leading-tight flex items-center gap-2"
              >
                <span>Judge & Developer Console</span>
                <span className="bg-[#2EC4B6]/20 text-[#2EC4B6] text-[10px] px-2 py-0.5 rounded-full font-mono font-bold">
                  AI RISER
                </span>
              </h2>
              <p className="text-[11px] text-white/60 font-mono">
                BiteQuest System Architecture & Verification Diagnostics
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center active:scale-95 transition-all focus:outline-none"
            aria-label="Đóng bảng chẩn đoán"
            id="btn-close-judge-dev"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 overflow-y-auto space-y-4 text-xs font-sans text-white/80 leading-relaxed">
          {/* 1. Zero-Billing Blockers Banner */}
          <div className="bg-[#2EC4B6]/15 border border-[#2EC4B6]/30 p-3.5 rounded-2xl flex items-center justify-between">
            <div>
              <span className="font-heading font-bold text-white text-xs block">
                ⚡ 100% Zero-Billing Resilience
              </span>
              <span className="text-[11px] text-[#2EC4B6]">
                Production architecture designed to run reliably without credit card dependencies.
              </span>
            </div>
            <span className="bg-[#2EC4B6] text-black font-heading font-black text-[10px] px-2 py-1 rounded-md shrink-0">
              ACTIVE
            </span>
          </div>

          {/* 2. Real Services Integration Status */}
          <div className="space-y-2">
            <span className="font-mono text-[11px] uppercase tracking-wider text-white/50 block">
              Core Microservices & Providers
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {/* Map Tiles */}
              <div className="bg-white/5 p-3 rounded-xl border border-white/10 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white text-[11px]">🗺️ Map Tiles</span>
                  <span className="text-[9px] text-[#2EC4B6] font-mono font-bold">● LIVE</span>
                </div>
                <p className="text-[10px] text-white/60">
                  MapLibre GL + OpenFreeMap Liberty vector tiles. Zero API key watermark & zero rate-limit blocks.
                </p>
              </div>

              {/* AI Vision Perception */}
              <div className="bg-white/5 p-3 rounded-xl border border-white/10 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white text-[11px]">👁️ AI Vision</span>
                  <span className="text-[9px] text-[#2EC4B6] font-mono font-bold">● LIVE</span>
                </div>
                <p className="text-[10px] text-white/60">
                  Google Gemini Multimodal API via @google/genai. Server-side OCR & dish classification.
                </p>
              </div>

              {/* Places & Geodesic Calculation */}
              <div className="bg-white/5 p-3 rounded-xl border border-white/10 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white text-[11px]">📍 Places & Routes</span>
                  <span className="text-[9px] text-[#2EC4B6] font-mono font-bold">● LIVE</span>
                </div>
                <p className="text-[10px] text-white/60">
                  Geoapify Geocoding API + Geolib geodesic core for deterministic spatial radius queries.
                </p>
              </div>

              {/* Image Storage & CDN */}
              <div className="bg-white/5 p-3 rounded-xl border border-white/10 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white text-[11px]">📸 Image Storage</span>
                  <span className="text-[9px] text-[#2EC4B6] font-mono font-bold">● READY</span>
                </div>
                <p className="text-[10px] text-white/60">
                  Cloudinary Media Storage provider with optimized auto-format, plus base64 fallback.
                </p>
              </div>
            </div>
          </div>

          {/* 3. Demo Simulation Tools (Separated from normal consumer UX) */}
          <div className="bg-white/5 border border-white/10 p-4 rounded-2xl space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[11px] uppercase tracking-wider text-[#FF9F1C] font-bold">
                🛠️ Demo Simulation Tools
              </span>
              <span className="bg-[#FF9F1C]/20 text-[#FF9F1C] text-[9px] px-2 py-0.5 rounded font-mono font-bold">
                DEMO SIMULATION
              </span>
            </div>

            <p className="text-[11px] text-white/70">
              Công cụ hỗ trợ Ban Giám khảo kiểm thử quy trình đồng thuận 2 người dùng (2-party verification): Giả lập User B độc lập ghé quán ngõ để xác minh, hoàn tất chu kỳ Scout Window và mở khóa huy hiệu <strong>First Bite</strong>.
            </p>

            <button
              type="button"
              onClick={() => {
                onTriggerDemoFirstBite();
                onClose();
              }}
              className="w-full bg-[#2EC4B6] hover:bg-[#2EC4B6]/90 text-black font-heading text-xs font-bold py-2.5 px-3 rounded-xl flex items-center justify-center gap-2 active:scale-98 transition-all shadow-md"
              id="btn-simulate-first-bite-dev"
            >
              <span className="material-symbols-outlined text-[18px]">verified</span>
              <span>Kích hoạt mô phỏng: User B xác minh quán (Mở First Bite)</span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/10 bg-[#1C1A17] shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full bg-white/10 hover:bg-white/20 text-white font-heading text-xs font-bold py-2.5 rounded-full active:scale-98 transition-all"
          >
            Đóng bảng điều khiển
          </button>
        </div>
      </div>
    </div>
  );
};
