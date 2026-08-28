import { z } from 'zod';

export const GeoapifyPlaceFeatureSchema = z.object({
  type: z.string().optional(),
  properties: z.object({
    place_id: z.coerce.string().optional(),
    name: z.coerce.string().optional(),
    formatted: z.coerce.string().optional(),
    street: z.coerce.string().optional(),
    housenumber: z.coerce.string().optional(),
    district: z.coerce.string().optional(),
    city: z.coerce.string().optional(),
    categories: z.array(z.string()).optional(),
    lat: z.number(),
    lon: z.number(),
    distance: z.number().optional(),
  }).passthrough().optional(),
  geometry: z.any().optional(),
}).passthrough();

export const GeoapifyPlacesResponseSchema = z.object({
  type: z.literal('FeatureCollection').optional(),
  features: z.array(GeoapifyPlaceFeatureSchema).optional().default([]),
});

export const GeoapifyRouteLegSchema = z.object({
  distance: z.number(),
  time: z.number(),
  steps: z.array(z.any()).optional(),
});

export const GeoapifyRoutingResponseSchema = z.object({
  features: z.array(
    z.object({
      properties: z.object({
        distance: z.number(),
        time: z.number(),
        legs: z.array(GeoapifyRouteLegSchema).optional(),
      }),
      geometry: z.object({
        type: z.string(),
        coordinates: z.array(z.any()),
      }).optional(),
    })
  ).optional().default([]),
});

export type GeoapifyPlaceFeature = z.infer<typeof GeoapifyPlaceFeatureSchema>;
export type GeoapifyPlacesResponse = z.infer<typeof GeoapifyPlacesResponseSchema>;
