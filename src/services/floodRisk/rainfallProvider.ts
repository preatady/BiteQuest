/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { RainfallDataPoint } from './types';
import { fetchLiveWeatherForecast } from '../maps/weatherFloodService';

/**
 * Abstract Rainfall Provider Interface.
 * Allows decoupling precipitation data sources (Open-Meteo, National Hydro-Met radar, rain gauges).
 */
export interface RainfallProvider {
  getCurrentRainfall(lat: number, lng: number): Promise<RainfallDataPoint>;
  getRainfallHistory(lat: number, lng: number): Promise<{ timeStr: string; rainfallMm: number }[]>;
  getRainfallForecast(lat: number, lng: number): Promise<RainfallDataPoint[]>;
}

export class LiveAndSimulationRainfallProvider implements RainfallProvider {
  /**
   * Fetches real-time meteorological precipitation from Open-Meteo with fallback simulation.
   */
  async getCurrentRainfall(lat: number, lng: number): Promise<RainfallDataPoint> {
    try {
      const forecasts = await fetchLiveWeatherForecast(lat, lng);
      const currentHour = new Date().getHours();
      const currentForecast = forecasts[currentHour] || forecasts[0];

      const hourlyMm = currentForecast?.precipitationMm || 0;
      const prob = currentForecast?.precipitationProbability || 0;

      // Calculate realistic short-term temporal accumulation (15m, 30m, 1h, 3h)
      // If current hour has rain, 15m is ~35% of hourly intensity, 30m is ~65%, 1h is 100%, 3h includes previous hours
      const prevHourForecast = forecasts[(currentHour + 23) % 24];
      const prev2HourForecast = forecasts[(currentHour + 22) % 24];

      const prev1Mm = prevHourForecast?.precipitationMm || 0;
      const prev2Mm = prev2HourForecast?.precipitationMm || 0;

      const rainfall15m = Number((hourlyMm * 0.35).toFixed(1));
      const rainfall30m = Number((hourlyMm * 0.68).toFixed(1));
      const rainfall1h = Number(hourlyMm.toFixed(1));
      const rainfall3h = Number((hourlyMm + prev1Mm + prev2Mm).toFixed(1));

      return {
        currentRainfallMmH: hourlyMm,
        rainfall15mMm: rainfall15m,
        rainfall30mMm: rainfall30m,
        rainfall1hMm: rainfall1h,
        rainfall3hMm: rainfall3h,
        precipitationProbability: prob,
        source: 'open_meteo_live',
      };
    } catch {
      // Baseline baseline fallback
      return {
        currentRainfallMmH: 2.5,
        rainfall15mMm: 0.8,
        rainfall30mMm: 1.6,
        rainfall1hMm: 2.5,
        rainfall3hMm: 5.2,
        precipitationProbability: 40,
        source: 'simulation_model',
      };
    }
  }

  async getRainfallHistory(lat: number, lng: number): Promise<{ timeStr: string; rainfallMm: number }[]> {
    try {
      const forecasts = await fetchLiveWeatherForecast(lat, lng);
      const currentHour = new Date().getHours();
      const history = [];

      for (let i = 5; i >= 0; i--) {
        const targetHour = (currentHour - i + 24) % 24;
        const f = forecasts[targetHour];
        history.push({
          timeStr: `${targetHour.toString().padStart(2, '0')}:00`,
          rainfallMm: f?.precipitationMm || 0,
        });
      }
      return history;
    } catch {
      return [
        { timeStr: '14:00', rainfallMm: 0 },
        { timeStr: '15:00', rainfallMm: 1.2 },
        { timeStr: '16:00', rainfallMm: 3.5 },
        { timeStr: '17:00', rainfallMm: 2.1 },
        { timeStr: '18:00', rainfallMm: 0.8 },
      ];
    }
  }

  async getRainfallForecast(lat: number, lng: number): Promise<RainfallDataPoint[]> {
    try {
      const forecasts = await fetchLiveWeatherForecast(lat, lng);
      const currentHour = new Date().getHours();
      const points: RainfallDataPoint[] = [];

      for (let i = 0; i < 4; i++) {
        const targetHour = (currentHour + i) % 24;
        const f = forecasts[targetHour];
        const hourlyMm = f?.precipitationMm || 0;

        points.push({
          currentRainfallMmH: hourlyMm,
          rainfall15mMm: Number((hourlyMm * 0.35).toFixed(1)),
          rainfall30mMm: Number((hourlyMm * 0.65).toFixed(1)),
          rainfall1hMm: Number(hourlyMm.toFixed(1)),
          rainfall3hMm: Number((hourlyMm * 2.2).toFixed(1)),
          precipitationProbability: f?.precipitationProbability || 0,
          source: 'open_meteo_live',
        });
      }
      return points;
    } catch {
      return [];
    }
  }
}

export const defaultRainfallProvider: RainfallProvider = new LiveAndSimulationRainfallProvider();
