import { z } from 'zod';

const MINUTE = 60_000;
const clockSkew = 2 * MINUTE;

export const LocationPointSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  capturedAt: z
    .number()
    .int()
    .positive()
    .refine((time) => time <= Date.now() + clockSkew),
});

export const LocationInputSchema = LocationPointSchema.extend({
  expiresAt: z.number().int().positive().optional(),
}).refine(
  ({ capturedAt, expiresAt }) =>
    expiresAt === undefined ||
    (expiresAt > capturedAt && expiresAt <= Date.now() + 8 * 60 * MINUTE + clockSkew),
  { path: ['expiresAt'], message: 'Invalid live location expiration' }
);

export const LocationReferenceSchema = z.object({ messageId: z.uuid() });
export const LocationUpdateSchema = LocationReferenceSchema.extend({ point: LocationPointSchema });

export type LocationPoint = z.infer<typeof LocationPointSchema>;
export type LocationInput = z.infer<typeof LocationInputSchema>;
export type LocationReferenceDto = z.infer<typeof LocationReferenceSchema>;
export type LocationUpdateDto = z.infer<typeof LocationUpdateSchema>;
export type LocationState = LocationPoint & { expiresAt?: number; stoppedAt?: number };
