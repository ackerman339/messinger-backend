import { z } from 'zod';
import { CallMedia, CallNegotiationType } from '@appTypes';
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
  negotiationId: z.uuid(),
});

export const IceCandidateSchema = z.object({
  candidate: z.string(),
  sdpMid: z.string().nullable().optional(),
  sdpMLineIndex: z.number().int().nonnegative().nullable().optional(),
  usernameFragment: z.string().nullable().optional(),
});

export const CallIceCandidateSchema = z.object({
  callId: z.uuid(),
  negotiationId: z.uuid(),
  candidate: IceCandidateSchema.nullable(),
});

export const CallSignalAckSchema = z.object({
  callId: z.uuid(),
  signalId: z.string().regex(/^[a-f0-9]{64}$/),
  negotiationId: z.uuid(),
  signalType: z.union([
    z.literal(WS_CLIENT_EVENTS.CALL_OFFER),
    z.literal(WS_CLIENT_EVENTS.CALL_ANSWER),
  ]),
});

export const CallNegotiationInitSchema = z.object({
  callId: z.uuid(),
  requestId: z.uuid(),
  type: z.union([
    z.literal(CallNegotiationType.INITIAL),
    z.literal(CallNegotiationType.MEDIA_CHANGE),
    z.literal(CallNegotiationType.ICE_RESTART),
  ]),
});

export const CallRecoveredSchema = z.object({
  callId: z.uuid(),
  negotiationId: z.uuid(),
});

export type CallInitDto = z.infer<typeof CallInitSchema>;
export type CallReferenceDto = z.infer<typeof CallReferenceSchema>;
export type CallSdpDto = z.infer<typeof CallSdpSchema>;
export type CallIceCandidateDto = z.infer<typeof CallIceCandidateSchema>;
export type CallSignalAckDto = z.infer<typeof CallSignalAckSchema>;
export type CallNegotiationInitDto = z.infer<typeof CallNegotiationInitSchema>;
export type CallRecoveredDto = z.infer<typeof CallRecoveredSchema>;
