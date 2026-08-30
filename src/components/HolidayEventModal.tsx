import React from 'react';

export interface HolidayEventItem {
  id: string;
  name: string;
  distance: string;
  tag: string;
  reason: string;
  latitude?: number;
  longitude?: number;
  category?: string;
  highlightBadge?: string;
}

export const HOLIDAY_EVENTS: HolidayEventItem[] = [
  {
    id: 'e1',
    name: 'Lăng Chủ tịch Hồ Chí Minh',
    distance: '3.2 km',
    tag: 'Miễn phí',
    reason: 'Điểm đến lịch sử lý tưởng. BiteQuest khuyên bạn nên đi trước 7h sáng để tránh đông đúc.',
    latitude: 21.0368,
    longitude: 105.8347,
    category: 'Lịch sử & Văn hóa',
    highlightBadge: '🇻🇳 Quốc Khánh',
  },
  {
    id: 'e2',
    name: 'Hoàng Thành Thăng Long',
    distance: '4.5 km',
    tag: 'Check-in',
    reason: 'Không gian rộng rãi, nhiều hoạt động văn hóa mừng Quốc Khánh.',
    latitude: 21.0350,
    longitude: 105.8410,
    category: 'Di sản & Lễ hội',
    highlightBadge: '📸 Rộng rãi',
  },
  {
    id: 'e3',
    name: 'Vườn Quốc gia Ba Vì',
    distance: '48 km',
    tag: 'Đi trốn',
    reason: 'Lựa chọn tuyệt vời trong bán kính 50km. Tuyến Đại lộ Thăng Long hiện đang thông thoáng.',
    latitude: 21.0778,
    longitude: 105.3615,
    category: 'Dã ngoại & Thiên nhiên',
    highlightBadge: '🌲 Bán kính 50km',
  },
];

interface HolidayEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectEventLocation?: (coords: { latitude: number; longitude: number }, name: string) => void;
}

export const HolidayEventModal: React.FC<HolidayEventModalProps> = ({
  isOpen,
  onClose,
  onSelectEventLocation,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[999] bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in"
      onClick={onClose}
      id="holiday-event-modal-backdrop"
    >
      <div
        className="bg-[#FDFCF8] w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl border border-stone-200/90 flex flex-col gap-4 overflow-hidden animate-slide-up max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Sự kiện Hot: Lễ 2/9 Quốc Khánh"
        id="holiday-event-modal-dialog"
      >
        {/* Header */}
        <div className="flex items-start justify-between pb-3.5 border-b border-stone-200/80">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-red-600 via-orange-500 to-amber-500 flex items-center justify-center text-2xl shadow-md text-white shrink-0 relative overflow-hidden">
              <span className="relative z-10">🇻🇳</span>
              <div className="absolute inset-0 bg-white/10 animate-pulse pointer-events-none" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-red-100 text-red-700 text-[10px] font-heading font-extrabold uppercase tracking-wider border border-red-200/60">
                  🔥 Sự kiện theo ngữ cảnh
                </span>
                <span className="text-[11px] text-stone-500 font-medium font-mono">Bán kính 50km</span>
              </div>
              <h3 className="text-lg font-heading font-bold text-[#2D2926] mt-0.5 flex items-center gap-1.5">
                Hot: Lễ 2/9 Quốc Khánh
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 flex items-center justify-center text-stone-600 transition-colors cursor-pointer shrink-0"
            aria-label="Đóng"
            id="btn-close-holiday-modal"
          >
            ✕
          </button>
        </div>

        {/* AI Context Banner */}
        <div className="p-3.5 bg-gradient-to-r from-orange-50/90 via-amber-50/90 to-red-50/90 rounded-2xl border border-orange-200/80 flex items-start gap-3 text-xs text-[#594139] shadow-xs">
          <div className="w-8 h-8 rounded-xl bg-[#FF6B35]/15 text-[#FF6B35] flex items-center justify-center text-base shrink-0">
            🧭
          </div>
          <div className="leading-relaxed">
            <div className="font-heading font-bold text-[#2D2926] mb-0.5">
              Lịch nhận biết thời gian thực: <span className="text-[#FF6B35]">30 Tháng 8</span>
            </div>
            Dịp nghỉ lễ <strong>Quốc Khánh 2/9</strong> đang đến gần. BiteQuest tự động phân tích tuyến đường thông thoáng, dự báo thời tiết và mật độ khách để gợi ý 3 điểm đến hấp dẫn nhất:
          </div>
        </div>

        {/* Verified Event Cards */}
        <div className="flex flex-col gap-2.5 overflow-y-auto no-scrollbar max-h-[50vh] pr-0.5">
          {HOLIDAY_EVENTS.map((item, idx) => (
            <div
              key={item.id}
              onClick={() => {
                if (item.latitude && item.longitude && onSelectEventLocation) {
                  onSelectEventLocation({ latitude: item.latitude, longitude: item.longitude }, item.name);
                }
                onClose();
              }}
              className="p-4 rounded-2xl bg-white hover:bg-orange-50/30 border border-stone-200/90 hover:border-orange-300 transition-all cursor-pointer shadow-xs hover:shadow-md group flex flex-col gap-2 relative overflow-hidden"
              id={`holiday-card-${item.id}`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="w-5 h-5 rounded-full bg-stone-100 text-stone-700 text-[11px] font-mono font-bold flex items-center justify-center">
                    0{idx + 1}
                  </span>
                  <h4 className="font-heading font-bold text-sm text-[#2D2926] group-hover:text-[#FF6B35] transition-colors">
                    {item.name}
                  </h4>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-heading font-bold ${
                      item.tag === 'Miễn phí'
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        : item.tag === 'Check-in'
                        ? 'bg-purple-100 text-purple-800 border border-purple-200'
                        : 'bg-amber-100 text-amber-800 border border-amber-200'
                    }`}
                  >
                    {item.tag}
                  </span>
                </div>

                <span className="text-xs font-mono font-bold text-stone-500 bg-stone-100 px-2 py-0.5 rounded-full shrink-0">
                  {item.distance}
                </span>
              </div>

              <p className="text-xs text-stone-600 leading-relaxed pl-7">
                {item.reason}
              </p>

              <div className="flex items-center justify-between pl-7 pt-1 border-t border-stone-100 text-[11px] text-stone-400">
                <span className="font-medium text-stone-500">{item.category}</span>
                <span className="text-[#FF6B35] font-heading font-semibold group-hover:translate-x-0.5 transition-transform flex items-center gap-1">
                  Xem vị trí & lộ trình →
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-stone-200/70 gap-3">
          <div className="flex items-center gap-1.5 text-[11px] text-stone-500">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Đã kích hoạt AI Calendar Guard
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 bg-[#FF6B35] hover:bg-[#E85D2A] text-white text-xs font-heading font-bold rounded-xl shadow-sm active:scale-95 transition-all cursor-pointer"
            id="btn-holiday-modal-dismiss"
          >
            Đã hiểu
          </button>
        </div>
      </div>
    </div>
  );
};
