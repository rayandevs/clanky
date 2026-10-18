import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';

type FeedbackIdentity = { userId: string; username: string; displayName: string | null };
type FeedbackContext = FeedbackIdentity & { page: string; ip: string; userAgent: string };
type Feedback = Pick<z.infer<typeof FeedbackBody>, 'rating' | 'note'>;
type Fetcher = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;
type AuthGuard = (request: FastifyRequest, reply: FastifyReply) => Promise<unknown>;

const FeedbackBody = z.object({
  rating: z.number().int().min(1).max(5),
  note: z.string().trim().min(1).max(2000),
  page: z.string().trim().min(1).max(200).refine((value) => value.startsWith('/') && !value.startsWith('//') && !value.includes('://') && !value.includes('?') && !value.includes('#')),
  consent: z.literal(true),
  website: z.string().max(200).optional().default(''),
});

const USER_LIMIT = 3;
const WINDOW_MS = 60 * 60 * 1000;
const userFeedbackTimes = new Map<string, number[]>();
let lastSweep = 0;

function allowUserFeedback(userId: string, now = Date.now()) {
  const cutoff = now - WINDOW_MS;
  if (now - lastSweep > 5 * 60 * 1000) {
    for (const [id, times] of userFeedbackTimes) {
      if (!times.some((time) => time > cutoff)) userFeedbackTimes.delete(id);
    }
    lastSweep = now;
  }

  const recent = (userFeedbackTimes.get(userId) ?? []).filter((time) => time > cutoff);
  if (recent.length >= USER_LIMIT) return false;
  recent.push(now);
  userFeedbackTimes.set(userId, recent);
  return true;
}

const safeField = (value: string, maxLength: number) => value.replace(/[\u0000-\u001f\u007f]/g, '').slice(0, maxLength) || 'Not provided';

/** Send feedback without exposing webhook details through errors or logs. */
export async function deliverFeedback(webhookUrl: string, feedback: Feedback, context: FeedbackContext, fetcher: Fetcher = fetch): Promise<boolean> {
  try {
    const response = await fetcher(webhookUrl, {
      method: 'POST',
      redirect: 'error',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        embeds: [{
          title: 'Dashboard feedback',
          color: 0xe2702f,
          description: feedback.note,
          fields: [
            { name: 'Rating', value: `${'★'.repeat(feedback.rating)}${'☆'.repeat(5 - feedback.rating)} (${feedback.rating}/5)`, inline: true },
            { name: 'Discord user', value: `${safeField(context.displayName ?? context.username, 200)} (@${safeField(context.username, 200)})`, inline: true },
            { name: 'Discord user ID', value: safeField(context.userId, 32), inline: true },
            { name: 'Dashboard page', value: safeField(context.page, 200), inline: true },
            { name: 'Session', value: 'Authenticated Discord dashboard session', inline: true },
            { name: 'Source IP', value: safeField(context.ip, 64), inline: true },
            { name: 'Browser user-agent', value: safeField(context.userAgent, 500) },
          ],
          timestamp: new Date().toISOString(),
        }],
        allowed_mentions: { parse: [] },
      }),
      signal: AbortSignal.timeout(8_000),
    });
    return response.ok;
  } catch {
    // Fetch errors can contain the credential-bearing URL; do not log or forward them.
    return false;
  }
}

export async function feedbackRoutes(app: FastifyInstance, options: {
  webhookUrl?: string;
  fetcher?: Fetcher;
  requireUser: AuthGuard;
  getIdentity: (request: FastifyRequest) => FeedbackIdentity;
}) {
  app.post('/api/feedback', {
    preHandler: options.requireUser,
    config: { rateLimit: { max: 5, timeWindow: '1 hour' } },
  }, async (request, reply) => {
    if (!options.webhookUrl) {
      return reply.code(503).send({ error: 'unavailable', message: 'Feedback is not available right now.' });
    }

    const parsed = FeedbackBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid', message: 'Choose a star rating, enter a note, and acknowledge the feedback data notice.' });
    }

    // Honeypot submissions are acknowledged but never forwarded.
    if (parsed.data.website) return { ok: true };

    const identity = options.getIdentity(request);
    if (!allowUserFeedback(identity.userId)) {
      return reply.code(429).send({ error: 'rate_limited', message: 'You have sent enough feedback for now. Please try again later.' });
    }

    const userAgent = request.headers['user-agent'];
    const context: FeedbackContext = {
      ...identity,
      page: parsed.data.page,
      ip: request.ip,
      userAgent: Array.isArray(userAgent) ? userAgent.join(' ') : userAgent ?? 'Not provided',
    };
    const delivered = await deliverFeedback(options.webhookUrl, { rating: parsed.data.rating, note: parsed.data.note }, context, options.fetcher);
    if (!delivered) {
      return reply.code(502).send({ error: 'delivery_failed', message: 'Feedback could not be delivered. Please try again later.' });
    }

    return { ok: true };
  });
}
