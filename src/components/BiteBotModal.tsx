import React, { useState, useRef, useEffect } from 'react';
import Markdown from 'react-markdown';
import { Place } from '../types';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  recommendedPlaces?: Place[];
}

interface BiteBotModalProps {
  isOpen: boolean;
  onClose: () => void;
  places: Place[];
  userLocation?: { latitude: number; longitude: number; district?: string };
  userPreferences?: string[];
  onSelectPlace: (place: Place) => void;
}

const QUICK_SUGGESTIONS = [
  { label: '🍜 Bún / Phở ngon gần đây', prompt: 'Gợi ý cho mình quán bún hoặc phở ngon chuẩn vị gần đây với!' },
  { label: '☕ Cafe yên tĩnh làm việc', prompt: 'Tìm giúp mình quán cafe không gian yên tĩnh, có wifi tốt để ngồi làm việc/học tập nhé.' },
  { label: '💸 Ăn no giá sinh viên < 50k', prompt: 'Có quán ăn nào ngon, no bụng với giá sinh viên dưới 50k quanh Cầu Giấy không?' },
  { label: '🥘 Lẩu nướng tụ tập bạn bè', prompt: 'Gợi ý quán lẩu hoặc nướng ngon, không khí sôi động để đi ăn nhóm bạn bè.' },
  { label: '🌟 Quán mới có First Bite', prompt: 'Hôm nay có quán nào mới chưa có nhiều người khám phá để mình săn First Bite không?' },
];

export const BiteBotModal: React.FC<BiteBotModalProps> = ({
  isOpen,
  onClose,
  places,
  userLocation,
  userPreferences,
  onSelectPlace,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome-msg',
      role: 'assistant',
      content:
        'Xin chào! Mình là **BiteBot** 🥢 — Trợ lý Ẩm thực AI thông minh của BiteQuest.\n\nBạn đang thèm món gì, muốn tìm quán cafe làm việc hay cần gợi ý ăn uống theo ngân sách? Hãy hỏi mình nhé!',
      timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 200);
    }
  }, [isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  if (!isOpen) return null;

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputMessage).trim();
    if (!text || isLoading) return;

    const userMsgId = `user_${Date.now()}`;
    const userMsg: ChatMessage = {
      id: userMsgId,
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInputMessage('');
    setIsLoading(true);

    try {
      // Send chat request to server-side Gemini 3.7 Flash endpoint
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          userLocation: userLocation || {
            latitude: 21.0285,
            longitude: 105.7958,
            district: 'Cầu Giấy',
          },
          currentPlacesContext: places.slice(0, 20).map((p) => ({
            id: p.id,
            name: p.name,
            category: p.category,
            categoryLabel: p.categoryLabel,
            address: p.address,
            priceBand: p.priceBand,
            rating: p.rating,
            isCommunitySpot: p.isCommunitySpot,
          })),
          userPreferences: userPreferences || ['Khám phá ẩm thực Hà Nội'],
        }),
      });

      if (!res.ok) {
        throw new Error('Lỗi phản hồi từ máy chủ AI');
      }

      const data = await res.json();
      const recommendedPlaces: Place[] = [];

      if (data.recommendedPlaceIds && Array.isArray(data.recommendedPlaceIds)) {
        data.recommendedPlaceIds.forEach((pid: string) => {
          const found = places.find((p) => p.id === pid);
          if (found && !recommendedPlaces.some((rp) => rp.id === found.id)) {
            recommendedPlaces.push(found);
          }
        });
      }

      const botMsg: ChatMessage = {
        id: `bot_${Date.now()}`,
        role: 'assistant',
        content: data.message || 'Mình đã tìm thấy một số gợi ý cho bạn!',
        timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
        recommendedPlaces: recommendedPlaces.length > 0 ? recommendedPlaces : undefined,
      };

      setMessages((prev) => [...prev, botMsg]);
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: `bot_err_${Date.now()}`,
        role: 'assistant',
        content:
          'Xin lỗi bạn, kết nối trợ lý ẩm thực đang bận. Dưới đây là gợi ý nhanh:\n\n- 🍜 **Bún Cá Cô Lan** (Xuân Thủy)\n- ☕ **Phê La Trà Ô Long** (Cầu Giấy)\n- 🥘 **Lẩu Bò 555** (Duy Tân)\n\nBạn có thể thử lại sau một lát nhé!',
        timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetChat = () => {
    setMessages([
      {
        id: 'welcome-msg-reset',
        role: 'assistant',
        content:
          'Đã làm mới cuộc trò chuyện! Bạn đang tìm kiếm món ăn hoặc địa điểm nào tiếp theo?',
        timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  };

  const handlePlaceCardClick = (place: Place) => {
    onSelectPlace(place);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center pointer-events-auto"
      id="bitebot-chat-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="bitebot-title"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity duration-300 animate-fade-in"
        onClick={onClose}
      />

      {/* Main Chat Dialog Container */}
      <div className="relative z-10 w-full sm:max-w-lg h-[86vh] sm:h-[640px] max-h-[92vh] bg-[#FDFCF8] text-[#2D2926] rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-[#2D2926]/10 animate-slide-up">
        {/* HEADER BAR */}
        <div className="pt-4 pb-3 px-4 bg-white/95 backdrop-blur-md border-b border-[#2D2926]/8 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#FF6B35] to-[#FFA07A] flex items-center justify-center text-white text-xl shadow-md shadow-[#FF6B35]/25">
                <span>✨</span>
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-[#10B981] rounded-full ring-2 ring-white" />
            </div>

            <div>
              <div className="flex items-center gap-1.5">
                <h2 id="bitebot-title" className="font-heading text-base font-black text-[#2D2926]">
                  BiteBot AI
                </h2>
                <span className="bg-[#2EC4B6]/15 text-[#006A62] text-[10px] font-heading font-extrabold px-2 py-0.5 rounded-full">
                  Gemini 3.7
                </span>
              </div>
              <p className="text-[11px] text-[#8D7168] flex items-center gap-1">
                <span>Trợ lý Ẩm thực Cầu Giấy</span>
                <span>•</span>
                <span className="text-[#10B981] font-semibold">Trực tuyến</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleResetChat}
              className="w-9 h-9 rounded-full hover:bg-[#F4F4F0] text-[#594139] flex items-center justify-center active:scale-95 transition-all"
              title="Làm mới cuộc trò chuyện"
            >
              <span className="material-symbols-outlined text-[18px]">refresh</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-[#F4F4F0] hover:bg-[#EAE9E4] text-[#2D2926] flex items-center justify-center active:scale-95 transition-all"
              title="Đóng"
              id="btn-close-bitebot"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>
        </div>

        {/* CHAT MESSAGES SCROLL AREA */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#FAF9F5]" id="bitebot-messages-area">
          {messages.map((msg) => {
            const isUser = msg.role === 'user';

            return (
              <div
                key={msg.id}
                className={`flex gap-2.5 ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                {!isUser && (
                  <div className="w-8 h-8 rounded-xl bg-[#FF6B35] text-white flex items-center justify-center shrink-0 text-sm shadow-xs mt-0.5">
                    <span>🥢</span>
                  </div>
                )}

                <div
                  className={`max-w-[85%] rounded-2xl p-3.5 shadow-xs ${
                    isUser
                      ? 'bg-[#FF6B35] text-white rounded-tr-xs'
                      : 'bg-white text-[#2D2926] border border-[#2D2926]/8 rounded-tl-xs'
                  }`}
                >
                  {/* Message Content */}
                  <div
                    className={`text-xs sm:text-[13px] leading-relaxed break-words ${
                      isUser ? 'text-white' : 'text-[#2D2926]'
                    }`}
                  >
                    {isUser ? (
                      <p className="whitespace-pre-wrap font-medium">{msg.content}</p>
                    ) : (
                      <div className="space-y-2 prose prose-xs max-w-none text-[#2D2926]">
                        <Markdown
                          components={{
                            p: ({ children }) => <p className="mb-1.5 last:mb-0">{children}</p>,
                            strong: ({ children }) => <strong className="font-bold text-[#FF6B35]">{children}</strong>,
                            ul: ({ children }) => <ul className="list-disc pl-4 space-y-1 my-1.5">{children}</ul>,
                            li: ({ children }) => <li className="leading-snug">{children}</li>,
                          }}
                        >
                          {msg.content}
                        </Markdown>
                      </div>
                    )}
                  </div>

                  {/* Interactive Recommended Place Cards */}
                  {!isUser && msg.recommendedPlaces && msg.recommendedPlaces.length > 0 && (
                    <div className="mt-3 pt-2.5 border-t border-[#2D2926]/8 space-y-2">
                      <span className="text-[10px] font-heading font-extrabold uppercase tracking-wider text-[#594139] block">
                        Địa điểm gợi ý trên bản đồ:
                      </span>
                      <div className="space-y-1.5">
                        {msg.recommendedPlaces.map((place) => (
                          <div
                            key={place.id}
                            onClick={() => handlePlaceCardClick(place)}
                            className="bg-[#FAF9F5] hover:bg-[#F4F4F0] border border-[#2D2926]/10 p-2.5 rounded-xl flex items-center justify-between gap-2.5 cursor-pointer active:scale-98 transition-all"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              {place.imageUrl ? (
                                <img
                                  src={place.imageUrl}
                                  alt={place.name}
                                  className="w-10 h-10 rounded-lg object-cover shrink-0"
                                />
                              ) : (
                                <div className="w-10 h-10 rounded-lg bg-[#FF6B35]/15 text-[#FF6B35] flex items-center justify-center shrink-0 font-bold">
                                  🍜
                                </div>
                              )}
                              <div className="min-w-0">
                                <h4 className="font-heading text-xs font-bold text-[#2D2926] truncate">
                                  {place.name}
                                </h4>
                                <p className="text-[11px] text-[#8D7168] truncate">
                                  {place.categoryLabel || 'Ẩm thực'} • {place.priceBand}
                                </p>
                              </div>
                            </div>

                            <button
                              type="button"
                              className="px-2.5 py-1 bg-[#FF6B35] text-white rounded-full font-heading text-[10px] font-bold shrink-0 flex items-center gap-1 shadow-xs"
                            >
                              <span>📍 Xem</span>
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <span
                    className={`text-[9px] mt-1.5 block text-right font-medium ${
                      isUser ? 'text-white/70' : 'text-[#8D7168]'
                    }`}
                  >
                    {msg.timestamp}
                  </span>
                </div>
              </div>
            );
          })}

          {/* Loading Indicator */}
          {isLoading && (
            <div className="flex gap-2.5 justify-start items-center">
              <div className="w-8 h-8 rounded-xl bg-[#FF6B35] text-white flex items-center justify-center shrink-0 text-sm shadow-xs">
                <span>🥢</span>
              </div>
              <div className="bg-white border border-[#2D2926]/8 rounded-2xl rounded-tl-xs p-3 shadow-xs flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#FF6B35] animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 rounded-full bg-[#FF6B35] animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 rounded-full bg-[#FF6B35] animate-bounce" style={{ animationDelay: '300ms' }} />
                <span className="text-[11px] font-heading font-semibold text-[#8D7168] ml-2">BiteBot đang suy nghĩ...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* QUICK SUGGESTION CHIPS */}
        <div className="px-3 py-2 bg-white/90 border-t border-[#2D2926]/5 overflow-x-auto flex gap-2 no-scrollbar shrink-0">
          {QUICK_SUGGESTIONS.map((chip, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleSendMessage(chip.prompt)}
              disabled={isLoading}
              className="px-3 py-1 bg-[#FAF9F5] hover:bg-[#F4F4F0] border border-[#2D2926]/10 rounded-full text-xs font-heading font-semibold text-[#594139] whitespace-nowrap active:scale-95 transition-all shrink-0 cursor-pointer disabled:opacity-50"
            >
              {chip.label}
            </button>
          ))}
        </div>

        {/* INPUT BAR */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="p-3 bg-white border-t border-[#2D2926]/8 flex items-center gap-2 shrink-0"
        >
          <input
            ref={inputRef}
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder="Hỏi món ngon, quán cafe, ngân sách..."
            className="flex-1 h-11 bg-[#FAF9F5] border border-[#2D2926]/10 rounded-full px-4 text-xs font-medium text-[#2D2926] placeholder:text-[#8D7168] focus:outline-none focus:border-[#FF6B35] focus:ring-2 focus:ring-[#FF6B35]/20 transition-all"
            disabled={isLoading}
            id="input-bitebot-prompt"
          />

          <button
            type="submit"
            disabled={!inputMessage.trim() || isLoading}
            className={`w-11 h-11 rounded-full flex items-center justify-center transition-all cursor-pointer ${
              inputMessage.trim() && !isLoading
                ? 'bg-[#FF6B35] text-white shadow-md shadow-[#FF6B35]/30 active:scale-90 hover:bg-[#FF6B35]/90'
                : 'bg-[#F4F4F0] text-[#8D7168]/50 cursor-not-allowed'
            }`}
            title="Gửi câu hỏi"
            id="btn-bitebot-send"
          >
            <span className="material-symbols-outlined text-[20px]">send</span>
          </button>
        </form>
      </div>
    </div>
  );
};
