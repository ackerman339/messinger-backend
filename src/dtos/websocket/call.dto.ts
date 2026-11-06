import { z } from 'zod';
import { CallMedia } from '@appTypes';
import { WS_CLIENT_EVENTS } from '@constants';

export const CallInitSchema = z.object({
  calleeId: z.uuid(),
  media: z.enum(CallMedia),
  requestId: z.uuid(),
});

export const CallReferenceSchema = z.object({
  callId: z.uuid(),
});

export const CallSdpSchema = z.object({
  callId: z.uuid(),
  sdp: z.string().min(1).max(65_536),
});

export const IceCandidateSchema = z.object({
  candidate: z.string(),
  sdpMid: z.string().nullable().optional(),
  sdpMLineIndex: z.number().int().nonnegative().nullable().optional(),
  usernameFragment: z.string().nullable().optional(),
});

export const CallIceCandidateSchema = z.object({
  callId: z.uuid(),
  candidate: IceCandidateSchema.nullable(),
});

export const CallSignalAckSchema = z.object({
  callId: z.string().uuid(),
  signalType: z.union([
    z.literal(WS_CLIENT_EVENTS.CALL_OFFER),
    z.literal(WS_CLIENT_EVENTS.CALL_ANSWER),
  ]),
  signalId: z.string().regex(/^[a-f0-9]{64}$/),
});

export type CallInitDto = z.infer<typeof CallInitSchema>;
export type CallReferenceDto = z.infer<typeof CallReferenceSchema>;
export type CallSdpDto = z.infer<typeof CallSdpSchema>;
export type CallIceCandidateDto = z.infer<typeof CallIceCandidateSchema>;
export type CallSignalAckDto = z.infer<typeof CallSignalAckSchema>;
