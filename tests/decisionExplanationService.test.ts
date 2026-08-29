import { describe, it, expect } from 'vitest';
import {
  generateLocalExplanationFallback,
  DestinationRoutingOption,
} from '../src/services/decisionExplanationService';

describe('Decision Explanation Service (Explainable AI)', () => {
  const options: DestinationRoutingOption[] = [
    {
      name: 'Quán A (Nhanh nhất nhưng kẹt & ngập)',
      durationMins: 12,
      distanceKm: 2.1,
      trafficLevel: 'High',
      floodRisk: 'High',
    },
    {
      name: 'Quán B (Lựa chọn tối ưu của BiteQuest)',
      durationMins: 15,
      distanceKm: 3.0,
      trafficLevel: 'Low',
      floodRisk: 'Low',
    },
    {
      name: 'Quán C (Xa hơn)',
      durationMins: 22,
      distanceKm: 5.2,
      trafficLevel: 'Low',
      floodRisk: 'Low',
    },
  ];

  it('generates "Fastest ≠ Best" headline when selected option avoids flood or traffic risks', () => {
    const explanation = generateLocalExplanationFallback(options, options[1]);
    expect(explanation.headline).toBe('Nhanh nhất chưa chắc đã tốt nhất');
    expect(explanation.bulletPoints.length).toBeGreaterThanOrEqual(2);
    expect(explanation.bulletPoints.some((b) => b.includes('ngập') || b.includes('ùn tắc'))).toBe(true);
    expect(explanation.summary).toContain('Quán B');
  });

  it('generates direct positive highlights when fastest option is already safe', () => {
    const safeOptions: DestinationRoutingOption[] = [
      {
        name: 'Quán A (An toàn & Nhanh)',
        durationMins: 10,
        distanceKm: 1.8,
        trafficLevel: 'Low',
        floodRisk: 'Low',
      },
      {
        name: 'Quán B',
        durationMins: 18,
        distanceKm: 3.5,
        trafficLevel: 'Low',
        floodRisk: 'Low',
      },
    ];

    const explanation = generateLocalExplanationFallback(safeOptions, safeOptions[0]);
    expect(explanation.headline).toContain('Quán A');
    expect(explanation.bulletPoints.length).toBeGreaterThan(0);
    expect(explanation.summary).toContain('Quán A');
  });
});
