import express from 'express';
import { z } from 'zod';
import { CallMedia, UserRole } from '@appTypes';
import { authenticate, authorize } from '@middlewares';
import { ValidationException } from '@exceptions';
import { groupCallService } from '../../services/group-call.service';

const router = express.Router();
const groupSchema = z.object({ conversationId: z.uuid() });
const callSchema = groupSchema.extend({ callId: z.uuid() });
const startSchema = z.object({ media: z.enum(CallMedia) });
const groupPath = '/conversation/:conversationId/group-calls';
const callPath = groupPath + '/:callId';
const user = [authenticate, authorize(UserRole.USER)];

function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new ValidationException(
      'Invalid group call parameters',
      result.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
        code: issue.code,
      }))
    );
  }
  return result.data;
}

router.get(groupPath + '/active', ...user, async (req, res) => {
  const { conversationId } = parse(groupSchema, req.params);
  const result = await groupCallService.getActive(conversationId, res.locals.userId!);
  res.set('Cache-Control', 'no-store').json({ result });
});

router.post(groupPath, ...user, async (req, res) => {
  const { conversationId } = parse(groupSchema, req.params);
  const { media } = parse(startSchema, req.body);
  const result = await groupCallService.start(conversationId, res.locals.userId!, media);
  res.set('Cache-Control', 'no-store').json({ result });
});

router.post(callPath + '/join', ...user, async (req, res) => {
  const { conversationId, callId } = parse(callSchema, req.params);
  const { fromNotification } = parse(
    z.object({ fromNotification: z.boolean().optional() }),
    req.body ?? {}
  );
  const result = await groupCallService.join(
    conversationId,
    callId,
    res.locals.userId!,
    fromNotification
  );
  res.set('Cache-Control', 'no-store').json({ result });
});

router.post(callPath + '/decline', ...user, async (req, res) => {
  const { conversationId, callId } = parse(callSchema, req.params);
  await groupCallService.decline(conversationId, callId, res.locals.userId!);
  res.sendStatus(204);
});

router.post(callPath + '/leave', ...user, async (req, res) => {
  const { conversationId, callId } = parse(callSchema, req.params);
  await groupCallService.leave(conversationId, callId, res.locals.userId!);
  res.sendStatus(204);
});

router.delete(callPath, ...user, async (req, res) => {
  const { conversationId, callId } = parse(callSchema, req.params);
  await groupCallService.end(conversationId, callId, res.locals.userId!);
  res.sendStatus(204);
});

router.post(
  '/group-calls/livekit-webhook',
  express.raw({ type: 'application/webhook+json', limit: '128kb' }),
  async (req, res) => {
    await groupCallService.receiveWebhook(req.body, req.get('Authorization'));
    res.sendStatus(204);
  }
);

export default router;
