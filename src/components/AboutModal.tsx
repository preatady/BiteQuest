import React from 'react';

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AboutModal: React.FC<AboutModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
      id="about-modal-root"
      role="dialog"
      aria-modal="true"
      aria-labelledby="about-modal-title"
    >
      <div
        className="bg-[#FDFCF8] text-[#2D2926] rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col border border-[#2D2926]/10 animate-slide-up overflow-hidden"
        id="about-modal-content"
      >
        {/* Header */}
        <div className="pt-5 px-6 pb-3 flex items-center justify-between border-b border-[#2D2926]/5 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🍜</span>
            <div>
              <h2
                id="about-modal-title"
                className="font-heading text-lg font-black text-[#FF6B35] leading-tight"
              >
                Về BiteQuest Vietnam
              </h2>
              <p className="text-[11px] text-[#594139] font-medium">
                Khám phá bản đồ ẩm thực ngõ phố qua từng món ăn
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-[#F4F4F0] hover:bg-[#EAE9E4] text-[#2D2926] flex items-center justify-center active:scale-95 transition-all focus:outline-none"
            aria-label="Đóng bảng thông tin"
            id="btn-close-about-modal"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 overflow-y-auto space-y-4 text-xs text-[#594139] leading-relaxed">
          {/* Section 1: Giới thiệu */}
          <div className="bg-white p-4 rounded-2xl border border-[#2D2926]/5 shadow-sm">
            <h3 className="font-heading text-sm font-bold text-[#2D2926] mb-1.5 flex items-center gap-2">
              <span className="text-base">✨</span>
              <span>BiteQuest là gì?</span>
            </h3>
            <p>
              <strong>BiteQuest</strong> là ứng dụng khám phá ẩm thực xã hội dành cho giới trẻ tại Việt Nam. Ứng dụng biến mỗi trải nghiệm ăn uống ngoài đời thực thành một dấu ấn trên <strong>Hành Trình Ẩm Thực</strong>, kết nối bạn bè thông qua dấu chân ẩm thực đáng tin cậy.
            </p>
          </div>

          {/* Section 2: Cách thức hoạt động của Verified Bite */}
          <div className="bg-white p-4 rounded-2xl border border-[#2D2926]/5 shadow-sm space-y-2">
            <h3 className="font-heading text-sm font-bold text-[#2D2926] flex items-center gap-2">
              <span className="text-base">📸</span>
              <span>Cơ chế "Verified Bite" hoạt động thế nào?</span>
            </h3>
            <p>
              Để bảo vệ tính xác thực và ngăn chặn đánh giá ảo, mỗi lượt check-in món ăn được hệ thống kiểm chứng qua mô hình 5 lớp:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-[11px]">
              <div className="bg-[#FAF9F5] p-2.5 rounded-xl border border-[#2D2926]/5">
                <span className="font-bold text-[#2D2926] block mb-0.5">1. Tọa độ GPS thực tế</span>
                <span>Đối chiếu bán kính vị trí thiết bị với tọa độ chính xác của quán ăn.</span>
              </div>
              <div className="bg-[#FAF9F5] p-2.5 rounded-xl border border-[#2D2926]/5">
                <span className="font-bold text-[#2D2926] block mb-0.5">2. Bằng chứng thị giác AI</span>
                <span>AI hỗ trợ nhận diện món ăn và trích xuất chữ trên biển hiệu/menu từ ảnh chụp.</span>
              </div>
              <div className="bg-[#FAF9F5] p-2.5 rounded-xl border border-[#2D2926]/5">
                <span className="font-bold text-[#2D2926] block mb-0.5">3. Cơ sở dữ liệu địa điểm</span>
                <span>Khớp tên quán, danh mục món và quận/huyện tương ứng.</span>
              </div>
              <div className="bg-[#FAF9F5] p-2.5 rounded-xl border border-[#2D2926]/5">
                <span className="font-bold text-[#2D2926] block mb-0.5">4. Quy tắc xác minh</span>
                <span>Kết hợp thuật toán xác minh đa yếu tố trước khi ghi nhận dấu Bite.</span>
              </div>
            </div>
            <p className="text-[11px] text-[#594139]/80 italic pt-1">
              * Lưu ý: AI đóng vai trò công cụ trích xuất dữ liệu thị giác khách quan, hệ thống quy tắc quyết định trạng thái xác minh.
            </p>
          </div>

          {/* Section 3: Community Spot & First Bite */}
          <div className="bg-white p-4 rounded-2xl border border-[#2D2926]/5 shadow-sm space-y-1.5">
            <h3 className="font-heading text-sm font-bold text-[#2D2926] flex items-center gap-2">
              <span className="text-base">🥇</span>
              <span>Khám phá Quán Ngõ & Danh hiệu First Bite</span>
            </h3>
            <p>
              Những quán ăn ngon nhất Việt Nam thường nằm sâu trong ngõ nhỏ. Người dùng có thể đề xuất <strong>Community Spot</strong> mới. Để chống spam, quán mới cần một người dùng độc lập khác ghé quán xác nhận (giai đoạn <em>Scout Window</em>) để mở khóa danh hiệu <strong>First Bite</strong> danh giá.
            </p>
          </div>

          {/* Section 4: Quyền riêng tư & Minh bạch */}
          <div className="bg-white p-4 rounded-2xl border border-[#2D2926]/5 shadow-sm space-y-1.5">
            <h3 className="font-heading text-sm font-bold text-[#2D2926] flex items-center gap-2">
              <span className="text-base">🔒</span>
              <span>Bảo mật & Quyền riêng tư</span>
            </h3>
            <p>
              BiteQuest tôn trọng quyền riêng tư người dùng: hệ thống chỉ xử lý hình ảnh món ăn và không gian quán ăn công khai, không thu thập hay lưu trữ dữ liệu nhận dạng khuôn mặt cá nhân.
            </p>
          </div>

          {/* Section 5: Nền tảng công nghệ */}
          <div className="bg-[#FAF9F5] p-3.5 rounded-2xl border border-[#2D2926]/10 space-y-1.5">
            <span className="font-heading font-bold text-xs text-[#2D2926] block">
              🛠️ Nền tảng công nghệ vận hành:
            </span>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div>• <strong>Bản đồ:</strong> MapLibre GL & OpenFreeMap</div>
              <div>• <strong>Địa điểm:</strong> Geoapify & Geolib</div>
              <div>• <strong>Thị giác AI:</strong> Gemini Multimodal API</div>
              <div>• <strong>Cơ sở dữ liệu:</strong> Cloud Firestore & Auth</div>
            </div>
          </div>
        </div>

        {/* Footer Button */}
        <div className="p-4 border-t border-[#2D2926]/5 bg-[#FDFCF8] shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full bg-[#FF6B35] hover:bg-[#FF6B35]/90 text-white font-heading text-xs font-bold py-3 rounded-full shadow-md active:scale-98 transition-all"
            id="btn-close-about-bottom"
          >
            Đã hiểu & Tiếp tục khám phá 😋
          </button>
        </div>
      </div>
    </div>
  );
};
