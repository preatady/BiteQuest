import React, { useState } from 'react';
import { FoodCategory } from '../types';

interface CommunitySpotModalProps {
  prefillData?: {
    dishName?: string;
    foodCategory?: FoodCategory;
    categoryLabel?: string;
    visibleVenueText?: string;
    visiblePriceMin?: number;
    visiblePriceMax?: number;
    ambianceType?: string;
  };
  imageUrl?: string | null;
  latitude?: number;
  longitude?: number;
  onClose: () => void;
  onSubmit: (spotData: any) => void;
}

export const CommunitySpotModal: React.FC<CommunitySpotModalProps> = ({
  prefillData,
  imageUrl,
  latitude,
  longitude,
  onClose,
  onSubmit,
}) => {
  const [name, setName] = useState(prefillData?.visibleVenueText || prefillData?.dishName || 'Bún Riêu Cua Ngõ 36');
  const [categoryLabel, setCategoryLabel] = useState(prefillData?.categoryLabel || 'Bún / Phở');
  const [priceBand, setPriceBand] = useState('35k–55k');
  const [address, setAddress] = useState('Ngõ 36 Xuân Thủy, Cầu Giấy, Hà Nội');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      name,
      categoryLabel,
      priceBand,
      address,
      latitude: latitude || 21.0368,
      longitude: longitude || 105.7892,
      imageUrl: imageUrl || 'https://images.unsplash.com/photo-1541544741938-0af808871cc0?w=800',
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in">
      <div className="bg-[#FDFCF8] text-[#2D2926] rounded-t-3xl sm:rounded-3xl shadow-2xl w-full max-w-md p-6 flex flex-col gap-4 border border-[#2D2926]/10 animate-slide-up max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-start pb-2 border-b border-[#2D2926]/5">
          <div>
            <div className="inline-flex items-center gap-1 bg-[#FF6B35]/15 text-[#FF6B35] px-2.5 py-0.5 rounded-full text-xs font-heading font-bold mb-1">
              <span>🥇 Cơ hội nhận First Bite</span>
            </div>
            <h3 className="font-heading text-xl font-black text-[#2D2926]">
              👀 Quán mới à?
            </h3>
            <p className="text-xs text-[#594139]/80">
              Gemini đã tự động trích xuất thông tin từ ảnh giúp bạn.
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#F4F4F0] text-[#2D2926] flex items-center justify-center"
          >
            ✕
          </button>
        </div>

        {/* Image Preview */}
        {imageUrl && (
          <div className="w-full h-32 rounded-2xl overflow-hidden shadow-inner relative">
            <img src={imageUrl} alt="New spot preview" className="w-full h-full object-cover" />
            <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-md text-white text-[10px] px-2 py-0.5 rounded-full">
              Ảnh vừa chụp
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
          {/* Tên Quán */}
          <div className="flex flex-col gap-1">
            <label className="font-heading text-xs font-bold text-[#2D2926]">Tên quán:</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full bg-[#F4F4F0] border border-[#2D2926]/10 rounded-xl px-3.5 py-2.5 text-xs text-[#2D2926] font-semibold focus:outline-none focus:ring-2 focus:ring-[#FF6B35]"
              placeholder="Nhập tên quán..."
            />
          </div>

          {/* Loại Món */}
          <div className="flex flex-col gap-1">
            <label className="font-heading text-xs font-bold text-[#2D2926]">Loại đồ ăn:</label>
            <input
              type="text"
              value={categoryLabel}
              onChange={(e) => setCategoryLabel(e.target.value)}
              required
              className="w-full bg-[#F4F4F0] border border-[#2D2926]/10 rounded-xl px-3.5 py-2.5 text-xs text-[#2D2926] focus:outline-none focus:ring-2 focus:ring-[#FF6B35]"
              placeholder="Ví dụ: Bún / Phở, Ăn vặt trong ngõ..."
            />
          </div>

          {/* Khoảng Giá */}
          <div className="flex flex-col gap-1">
            <label className="font-heading text-xs font-bold text-[#2D2926]">Khoảng giá ước tính:</label>
            <input
              type="text"
              value={priceBand}
              onChange={(e) => setPriceBand(e.target.value)}
              className="w-full bg-[#F4F4F0] border border-[#2D2926]/10 rounded-xl px-3.5 py-2.5 text-xs text-[#2D2926] focus:outline-none focus:ring-2 focus:ring-[#FF6B35]"
              placeholder="Ví dụ: 30k–50k"
            />
          </div>

          {/* Vị trí / Địa chỉ ngắn */}
          <div className="flex flex-col gap-1">
            <label className="font-heading text-xs font-bold text-[#2D2926]">Vị trí / Ngõ:</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full bg-[#F4F4F0] border border-[#2D2926]/10 rounded-xl px-3.5 py-2.5 text-xs text-[#2D2926] focus:outline-none focus:ring-2 focus:ring-[#FF6B35]"
            />
          </div>

          {/* First Bite Notice */}
          <div className="p-3 bg-[#2EC4B6]/10 rounded-xl border border-[#2EC4B6]/20 text-[11px] text-[#006A62]">
            💡 <strong>Cơ chế First Bite:</strong> Quán sẽ được lưu ở trạng thái <em>Đang chờ xác minh</em>. Khi một bạn khác độc lập tới ăn và chụp ảnh xác nhận, bạn sẽ được trao huy hiệu <strong>🥇 First Bite</strong> độc quyền!
          </div>

          {/* Submit */}
          <button
            type="submit"
            className="w-full bg-[#FF6B35] hover:bg-[#FF6B35]/90 text-white font-heading text-xs font-bold py-3.5 rounded-full shadow-lg shadow-[#FF6B35]/30 active:scale-98 transition-transform mt-1"
          >
            Đóng góp quán này (+150 XP) ✨
          </button>
        </form>
      </div>
    </div>
  );
};
