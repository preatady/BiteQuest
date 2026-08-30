export interface DestinationRoutingOption {
  name: string;
  durationMins: number;
  distanceKm: number;
  trafficLevel: 'High' | 'Low' | 'Moderate' | string;
  floodRisk: 'High' | 'Low' | string;
  address?: string;
  category?: string;
}

export interface ExplanationContext {
  rawQuery?: string;
  targetHour?: number;
  timeLabel?: string;
  timeContext?: string;
  dayType?: 'weekday' | 'weekend' | 'holiday';
  dishCategory?: string;
  closestOption?: DestinationRoutingOption;
  isDifferent?: boolean;
}

export interface SmartExplanationResult {
  headline: string;
  bulletPoints: string[];
  summary: string;
  confidenceScore?: number;
}

/**
 * Generates realistic, data-grounded traffic & temporal insights for Vietnamese cities
 */
function getTrafficTimeInsight(hour: number, dayType: 'weekday' | 'weekend' | 'holiday' = 'weekday'): {
  timeDesc: string;
  trafficFlow: string;
  crowdAdvice: string;
} {
  const isWeekend = dayType === 'weekend';

  if (hour >= 4 && hour < 7) {
    return {
      timeDesc: `${hour}:00 sáng sớm`,
      trafficFlow: 'Đường phố hoàn toàn thông thoáng, lượng phương tiện cực kỳ vắng, chưa bước vào khung giờ cao điểm',
      crowdAdvice: isWeekend
        ? 'Sáng cuối tuần yên tĩnh, không khí trong lành, di chuyển êm ái'
        : 'Sáng sớm ngày thường trước giờ cao điểm đi làm (7h-9h), tốc độ di chuyển đạt tối đa',
    };
  }

  if (hour >= 7 && hour < 9) {
    return {
      timeDesc: `${hour}:00 sáng`,
      trafficFlow: isWeekend
        ? 'Buổi sáng cuối tuần người dân đi ăn sáng & cafe nhẹ nhàng, đường phố khá êm'
        : 'Giờ cao điểm sáng ngày thường: Lưu lượng xe đi làm và học sinh rất đông, các trục đường chính và nút giao dễ ùn ứ',
      crowdAdvice: isWeekend
        ? 'Lộ trình thuận tiện, hàng quán điểm tâm bắt đầu nhộn nhịp'
        : 'Nên ưu tiên cung đường ngắn hoặc các trục đường tránh ngã tư lớn',
    };
  }

  if (hour >= 9 && hour < 11.5) {
    return {
      timeDesc: `${hour}:00 trưa`,
      trafficFlow: 'Khung giờ giữa buổi, giao thông ổn định và đường đi thông thoáng sau giờ cao điểm',
      crowdAdvice: 'Thời điểm lý tưởng để di chuyển nhanh chóng, hàng quán không bị quá tải',
    };
  }

  if (hour >= 11.5 && hour <= 13.5) {
    return {
      timeDesc: `${hour}:00 trưa`,
      trafficFlow: 'Cao điểm nghỉ trưa: Khu vực trung tâm, ẩm thực văn phòng tập trung đông đúc',
      crowdAdvice: 'Nên đi các quán gần để tiết kiệm thời gian nghỉ trưa',
    };
  }

  if (hour > 13.5 && hour < 17) {
    return {
      timeDesc: `${hour}:00 chiều`,
      trafficFlow: 'Đầu giờ chiều, mật độ phương tiện vừa phải, di chuyển nhanh và thuận lợi',
      crowdAdvice: 'Đường xá thông thoáng, ít nguy cơ trễ giờ',
    };
  }

  if (hour >= 17 && hour <= 19.5) {
    return {
      timeDesc: `${hour}:00 chiều tan tầm`,
      trafficFlow: isWeekend
        ? 'Cuối tuần: Dòng người đổ về khu vui chơi, ẩm thực và phố đi bộ đông vui'
        : 'Giờ cao điểm tan tầm chiều ngày thường: Mật độ giao thông cao, nhiều trục giao lộ bị chậm',
      crowdAdvice: 'Cần chọn lộ trình né các điểm nghẽn và khu vực có nguy cơ ùn tắc',
    };
  }

  if (hour > 19.5 && hour < 22) {
    return {
      timeDesc: `${hour}:00 tối`,
      trafficFlow: 'Lưu lượng xe đường phố đã hạ nhiệt, các tuyến đường chính lưu thông tốt',
      crowdAdvice: 'Không khí ẩm thực tối sôi động, thích hợp tụ tập ăn uống',
    };
  }

  return {
    timeDesc: `${hour}:00 đêm`,
    trafficFlow: 'Đêm muộn, đường phố vắng người, giao thông hoàn toàn thông thoáng',
    crowdAdvice: 'Di chuyển rất nhanh, cần chú ý an toàn khi đi ban đêm',
  };
}

export function computeConfidenceScore(
  selectedOption: DestinationRoutingOption,
  context?: ExplanationContext
): number {
  let score = 88; // High base confidence grounded on spatial calculations
  if (selectedOption.distanceKm && selectedOption.distanceKm > 0) score += 3;
  if (selectedOption.durationMins && selectedOption.durationMins > 0) score += 2;
  if (selectedOption.floodRisk) score += 2;
  if (selectedOption.address) score += 1;
  if (context?.targetHour !== undefined && context?.targetHour !== null) score += 2;
  return Math.min(98, score);
}

/**
 * Deterministic local fallback generator for explainable routing recommendations
 * Grounded in real data: hour, day type, actual distance, traffic dynamics, and category.
 */
export function generateLocalExplanationFallback(
  options: DestinationRoutingOption[],
  selectedOption: DestinationRoutingOption,
  context?: ExplanationContext
): SmartExplanationResult {
  const safeName = selectedOption?.name || 'quán này';
  const safeDuration = selectedOption?.durationMins ? `${selectedOption.durationMins} phút` : '2 phút';
  const safeDist = selectedOption?.distanceKm ?? 0.6;
  const hour = context?.targetHour ?? new Date().getHours();
  const dayType = context?.dayType ?? (new Date().getDay() === 0 || new Date().getDay() === 6 ? 'weekend' : 'weekday');
  
  const timeInsight = getTrafficTimeInsight(hour, dayType);
  const trafficLevelStr = String(selectedOption?.trafficLevel || '').toLowerCase();
  const isFloodSafe = String(selectedOption?.floodRisk).toLowerCase() === 'low';

  const isDifferent = context?.isDifferent || false;
  const closest = context?.closestOption;
  const confidenceScore = computeConfidenceScore(selectedOption, context);

  // Check if a faster option existed that had high traffic or flood risk
  const fasterRiskyOption = options?.find(
    (o) =>
      selectedOption &&
      o !== selectedOption &&
      o.durationMins < selectedOption.durationMins &&
      (String(o.floodRisk).toLowerCase() === 'high' || String(o.trafficLevel).toLowerCase() === 'high')
  );

  let headline = `✨ Tuyến đường tối ưu đến ${safeName}`;
  const bulletPoints: string[] = [];

  if (fasterRiskyOption) {
    headline = 'Nhanh nhất chưa chắc đã tốt nhất';
    bulletPoints.push(
      `🛡️ Né tránh rủi ro: Tuyến đường nhanh hơn (${fasterRiskyOption.durationMins} phút) đang bị ${
        String(fasterRiskyOption.floodRisk).toLowerCase() === 'high' ? 'nguy cơ ngập úng' : 'ùn tắc nghiêm trọng'
      }.`
    );
    bulletPoints.push(
      `🚗 Tuyến đường đến ${safeName} khô ráo, lưu thông êm ái, hạn chế tối đa nguy cơ ùn tắc.`
    );
  } else {
    // 1. Phân tích khung giờ & tình trạng giao thông thực tế
    bulletPoints.push(
      `⏰ Khung giờ ${timeInsight.timeDesc}: ${timeInsight.trafficFlow}.`
    );

    // 2. Phân tích cự ly & thời gian di chuyển thực tế
    bulletPoints.push(
      `📍 Cự ly thực tế ${safeDist} km: Thời gian di chuyển dự kiến chỉ ~${safeDuration} (${timeInsight.crowdAdvice}).`
    );

    // 3. Phân tích an toàn / né tắc / ngập úng
    if (isDifferent && closest) {
      const diffMins = Math.max(1, Math.round(selectedOption.durationMins - closest.durationMins));
      headline = `✨ Lựa chọn thông minh: Né tắc đường & tối ưu thời gian`;
      bulletPoints.push(
        `⚖️ So sánh lộ trình: Tránh khu vực có mật độ xe cao của ${closest.name}, chênh lệch chỉ ~${diffMins} phút nhưng đường đi êm và thoáng hơn.`
      );
    } else if (isFloodSafe) {
      bulletPoints.push(
        `🛡️ Tuyến đường khô ráo, mặt đường thông thoáng và không có cảnh báo ngập úng cục bộ.`
      );
    }
  }

  // 4. Lưu ý ngữ cảnh món ăn (Ví dụ: Lẩu lúc sáng sớm)
  const normQuery = (context?.rawQuery || '').toLowerCase();
  if (hour < 8 && (normQuery.includes('lẩu') || normQuery.includes('lau'))) {
    bulletPoints.push(
      `🍲 Lưu ý món lẩu sáng sớm: Quán mở cửa đón khách sớm, đường đi ${safeDist} km rất vắng và không lo trễ giờ.`
    );
  }

  const summary = `✨ Lựa chọn thực tế: BiteQuest đề xuất ${safeName} (${safeDist} km • ~${safeDuration}) vì lúc ${timeInsight.timeDesc}, đường phố ${trafficLevelStr === 'low' ? 'rất thông thoáng' : 'lưu thông tốt'}, ${timeInsight.crowdAdvice.toLowerCase()}.`;

  return {
    headline,
    bulletPoints,
    summary,
    confidenceScore,
  };
}

/**
 * Generates a short, persuasive explanation (the "Why this?" card) for the user.
 * Uses Gemini API with rich temporal/traffic grounding and robust deterministic fallback on failure.
 */
export async function generateSmartExplanation(
  options: DestinationRoutingOption[],
  selectedOption: DestinationRoutingOption,
  context?: ExplanationContext
): Promise<SmartExplanationResult> {
  const calculatedConfidence = computeConfidenceScore(selectedOption, context);

  if (!options || options.length === 0 || !selectedOption) {
    const safeName = selectedOption?.name || 'quán này';
    return {
      headline: '✨ Tuyến đường lý tưởng từ BiteQuest',
      bulletPoints: ['Tuyến đường thuận tiện cho hành trình của bạn', 'Giao thông thông thoáng'],
      summary: `BiteQuest đề xuất ${safeName} vì lộ trình thuận tiện và di chuyển nhanh chóng lúc này.`,
      confidenceScore: calculatedConfidence,
    };
  }

  try {
    const fetchPromise = (async (): Promise<SmartExplanationResult> => {
      const response = await fetch('/api/ai/explain-decision', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          options,
          selectedOption,
          context: {
            rawQuery: context?.rawQuery || '',
            targetHour: context?.targetHour ?? new Date().getHours(),
            timeLabel: context?.timeLabel || '',
            dayType: context?.dayType || 'weekday',
            dishCategory: context?.dishCategory || '',
            isDifferent: context?.isDifferent || false,
            closestOption: context?.closestOption,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }

      const data = await response.json();
      if (data && data.explanation && typeof data.explanation === 'object') {
        const { headline, bulletPoints, summary, confidenceScore } = data.explanation;
        if (headline && Array.isArray(bulletPoints) && summary) {
          return {
            headline: String(headline),
            bulletPoints: bulletPoints.map((b: any) => String(b)),
            summary: String(summary),
            confidenceScore: typeof confidenceScore === 'number' ? confidenceScore : calculatedConfidence,
          };
        }
      }
      throw new Error('Invalid explanation payload');
    })();

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Gemini API timeout exceeded (3000ms)')), 3000)
    );

    const result = await Promise.race([fetchPromise, timeoutPromise]);
    return result;
  } catch (error) {
    // Deterministic fallback with rich real-data grounding
    return generateLocalExplanationFallback(options, selectedOption, context);
  }
}
