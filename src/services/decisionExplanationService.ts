export interface DestinationRoutingOption {
  name: string;
  durationMins: number;
  distanceKm: number;
  trafficLevel: 'High' | 'Low' | string;
  floodRisk: 'High' | 'Low' | string;
}

export interface SmartExplanationResult {
  headline: string;
  bulletPoints: string[];
  summary: string;
}

/**
 * Deterministic local fallback generator for explainable routing recommendations
 * when network or AI service is unavailable.
 */
export function generateLocalExplanationFallback(
  options: DestinationRoutingOption[],
  selectedOption: DestinationRoutingOption
): SmartExplanationResult {
  const isFloodSafe =
    String(selectedOption.floodRisk).toLowerCase() === 'low' &&
    options.some((o) => String(o.floodRisk).toLowerCase() === 'high');

  const isTrafficAvoided =
    String(selectedOption.trafficLevel).toLowerCase() === 'low' &&
    options.some((o) => String(o.trafficLevel).toLowerCase() === 'high');

  const minDurationOption = [...options].sort((a, b) => a.durationMins - b.durationMins)[0];
  const isFastest = minDurationOption && minDurationOption.name === selectedOption.name;

  let headline = `Lựa chọn tối ưu cho chuyến đi của bạn`;
  const bulletPoints: string[] = [];

  if (!isFastest && (isFloodSafe || isTrafficAvoided)) {
    headline = 'Nhanh nhất chưa chắc đã tốt nhất';
    if (isTrafficAvoided) {
      bulletPoints.push('Tuyến đường thông thoáng, tránh các nút giao đang ùn tắc');
    }
    if (isFloodSafe) {
      bulletPoints.push('Tránh hoàn toàn các điểm ngập nước và vũng trũng cục bộ');
    }
    const diffMins = Math.max(1, Math.round(selectedOption.durationMins - (minDurationOption?.durationMins || selectedOption.durationMins)));
    bulletPoints.push(`Chỉ chênh lệch khoảng ${diffMins} phút so với phương án nhanh nhất nhưng an toàn hơn nhiều`);
  } else {
    headline = `Đường đi lý tưởng đến ${selectedOption.name}`;
    bulletPoints.push(`Thời gian di chuyển dự kiến: ~${selectedOption.durationMins} phút (${selectedOption.distanceKm} km)`);
    if (String(selectedOption.trafficLevel).toLowerCase() === 'low') {
      bulletPoints.push('Mật độ giao thông thông thoáng');
    }
    if (String(selectedOption.floodRisk).toLowerCase() === 'low') {
      bulletPoints.push('Tuyến đường khô ráo, không có cảnh báo ngập');
    }
  }

  if (bulletPoints.length === 0) {
    bulletPoints.push(`Khoảng cách ${selectedOption.distanceKm} km với thời gian ước tính ${selectedOption.durationMins} phút`);
    bulletPoints.push(`Tình trạng đường đi và rủi ro ở mức an toàn`);
  }

  const summary = `BiteQuest chọn ${selectedOption.name} vì sự cân bằng hoàn hảo giữa an toàn, độ thông thoáng và trải nghiệm ẩm thực thoải mái nhất lúc này.`;

  return {
    headline,
    bulletPoints,
    summary,
  };
}

/**
 * Generates a short, persuasive explanation (the "Why this?" card) for the user using Gemini 3.7 Flash.
 * Highlights the "Fastest ≠ Best" philosophy when choosing a route that avoids traffic/flood risks.
 *
 * @param options Array of available destinations with routing metrics
 * @param selectedOption The option BiteQuest algorithm chose as the best
 * @returns Structured explanation with headline, bulletPoints, and summary in Vietnamese
 */
export async function generateSmartExplanation(
  options: DestinationRoutingOption[],
  selectedOption: DestinationRoutingOption
): Promise<SmartExplanationResult> {
  if (!options || options.length === 0 || !selectedOption) {
    return {
      headline: 'Lựa chọn đề xuất từ BiteQuest',
      bulletPoints: ['Tuyến đường thuận tiện cho hành trình của bạn'],
      summary: 'BiteQuest gợi ý điểm đến phù hợp nhất với điều kiện hiện tại.',
    };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4500);

    const response = await fetch('/api/ai/explain-decision', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        options,
        selectedOption,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Server returned ${response.status}`);
    }

    const data = await response.json();
    if (data && data.explanation && typeof data.explanation === 'object') {
      const { headline, bulletPoints, summary } = data.explanation;
      if (headline && Array.isArray(bulletPoints) && summary) {
        return {
          headline: String(headline),
          bulletPoints: bulletPoints.map((b: any) => String(b)),
          summary: String(summary),
        };
      }
    }
  } catch {
    // Graceful fallback to deterministic local explanation generator
  }

  return generateLocalExplanationFallback(options, selectedOption);
}
