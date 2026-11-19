import { createHash } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { env } from '@config/environment';
import { CallMedia } from '@appTypes';
import { BadRequestException, BaseException, UnauthorizedException } from '@exceptions';

const JOIN_TTL_SECONDS = 120;
const roomSchema = z.object({ name: z.string(), sid: z.string().min(1) });
const listRoomsSchema = z.object({ rooms: z.array(roomSchema).default([]) });
const listParticipantsSchema = z.object({
  participants: z
    .array(z.object({ state: z.union([z.string(), z.number()]).optional() }))
    .default([]),
});
const webhookSchema = z.object({
  event: z.string(),
  room: roomSchema.optional(),
  participant: z.object({ identity: z.string() }).optional(),
});

class LiveKitService {
  get configured() {
    return Boolean(
      env.LIVEKIT_API_URL && env.LIVEKIT_WS_URL && env.LIVEKIT_API_KEY && env.LIVEKIT_API_SECRET
    );
  }

  assertConfigured() {
    if (!this.configured) {
      throw new BaseException('Group calls are unavailable', 503, 'GROUP_CALL:DISABLED');
    }
  }

  private token(claims: object, duration: number, subject?: string) {
    this.assertConfigured();
    return jwt.sign(claims, env.LIVEKIT_API_SECRET!, {
      algorithm: 'HS256',
      issuer: env.LIVEKIT_API_KEY!,
      expiresIn: duration,
      notBefore: 0,
      ...(subject ? { subject } : {}),
    });
  }

  issueAccess(room: string, identity: string, name: string | null, media: CallMedia) {
    const token = this.token(
      {
        name: name ?? undefined,
        video: {
          room,
          roomJoin: true,
          canPublish: true,
          canSubscribe: true,
          canPublishData: false,
          canPublishSources: media === CallMedia.VIDEO ? ['microphone', 'camera'] : ['microphone'],
        },
      },
      JOIN_TTL_SECONDS,
      identity
    );
    return { url: env.LIVEKIT_WS_URL!, token, expiresIn: JOIN_TTL_SECONDS };
  }

  private async request(method: string, grant: object, body: object, ignoreMissing = false) {
    const token = this.token({ video: grant }, 30);
    const endpoint = new URL(`/twirp/livekit.RoomService/${method}`, env.LIVEKIT_API_URL!);
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(4000),
        redirect: 'error',
      });
      if (ignoreMissing && response.status === 404) {
        const error = (await response.json()) as { code?: string };
        if (error.code === 'not_found') return;
      }
      if (!response.ok) throw new Error(`LiveKit RoomService returned ${response.status}`);
      return (await response.json()) as unknown;
    } catch {
      throw new BaseException(
        'LiveKit room service is unavailable',
        503,
        'GROUP_CALL:LIVEKIT_UNAVAILABLE'
      );
    }
  }

  async createRoom(name: string) {
    const room = await this.request(
      'CreateRoom',
      { roomCreate: true },
      {
        name,
        empty_timeout: 60,
        departure_timeout: 20,
        max_participants: 30,
      }
    );
    return this.parseResponse(roomSchema, room);
  }

  async findRoom(name: string) {
    const response = await this.request('ListRooms', { roomList: true }, { names: [name] });
    return this.parseResponse(listRoomsSchema, response).rooms.find((room) => room.name === name);
  }

  async hasParticipants(room: string) {
    const response = await this.request(
      'ListParticipants',
      { roomAdmin: true, room },
      { room },
      true
    );
    if (response === undefined) return false;
    return this.parseResponse(listParticipantsSchema, response).participants.some(
      ({ state }) => state !== 'DISCONNECTED' && state !== 3
    );
  }

  async deleteRoom(room: string) {
    await this.request('DeleteRoom', { roomCreate: true }, { room }, true);
  }

  async removeParticipant(room: string, identity: string) {
    await this.request('RemoveParticipant', { roomAdmin: true, room }, { room, identity }, true);
  }

  private parseResponse<T>(schema: z.ZodType<T>, result: unknown) {
    const parsed = schema.safeParse(result);
    if (!parsed.success) {
      throw new BaseException('Unexpected LiveKit response', 503, 'GROUP_CALL:LIVEKIT_UNAVAILABLE');
    }
    return parsed.data;
  }

  readWebhook(body: unknown, authorization: string | undefined) {
    this.assertConfigured();
    if (!Buffer.isBuffer(body) || !authorization) {
      throw new UnauthorizedException('GROUP_CALL:INVALID_WEBHOOK');
    }
    try {
      const claims = jwt.verify(authorization.replace(/^Bearer\s+/i, ''), env.LIVEKIT_API_SECRET!, {
        algorithms: ['HS256'],
        issuer: env.LIVEKIT_API_KEY!,
      });
      if (
        typeof claims === 'string' ||
        claims.sha256 !== createHash('sha256').update(body).digest('base64')
      ) {
        throw new Error('Invalid payload hash');
      }
    } catch {
      throw new UnauthorizedException('GROUP_CALL:INVALID_WEBHOOK');
    }
    try {
      return webhookSchema.parse(JSON.parse(body.toString('utf8')));
    } catch {
      throw new BadRequestException('GROUP_CALL:INVALID_WEBHOOK_PAYLOAD');
    }
  }
}

export const livekitService = new LiveKitService();
