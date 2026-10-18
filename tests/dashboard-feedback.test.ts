import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import Fastify from 'fastify';
import rateLimit from '@fastify/rate-limit';
import { feedbackRoutes } from '../src/dashboard/routes/feedback.js';

const webhookUrl = 'https://discord.com/api/webhooks/123456789012345678/a-private-webhook-token';
const servers: Array<ReturnType<typeof Fastify>> = [];
let accountNumber = 1;

async function makeServer(options: Partial<Parameters<typeof feedbackRoutes>[1]> = {}) {
  const app = Fastify({ logger: false });
  servers.push(app);
  await app.register(rateLimit, { global: false });
  app.addHook('onRequest', async (request, reply) => {
    if (request.method === 'POST' && request.headers['x-clanky'] !== '1') {
      return reply.code(403).send({ error: 'csrf', message: 'Missing request header.' });
    }
  });
  const userId = `99990000000000${String(accountNumber++).padStart(4, '0')}`;
  await app.register(async (scope) => feedbackRoutes(scope, {
    webhookUrl,
    requireUser: async (request, reply) => {
      if (request.headers.authorization !== 'Bearer test-session') {
        return reply.code(401).send({ error: 'unauthorized', message: 'Please log in first.' });
      }
    },
    getIdentity: () => ({ userId, username: 'clanky-tester', displayName: 'Clanky Tester' }),
    ...options,
  }));
  await app.ready();
  return app;
}

const payload = { rating: 4, note: 'Please add more dashboard themes! @everyone', page: '/dashboard/123/settings', consent: true };
const authenticatedHeaders = { authorization: 'Bearer test-session', 'x-clanky': '1', 'user-agent': 'ClankyFeedbackTest/1.0' };

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
});

test('feedback requires login and accepted data consent', async () => {
  const app = await makeServer();
  const loggedOut = await app.inject({ method: 'POST', url: '/api/feedback', headers: { 'x-clanky': '1' }, payload });
  const noConsent = await app.inject({ method: 'POST', url: '/api/feedback', headers: authenticatedHeaders, payload: { ...payload, consent: false } });
  assert.equal(loggedOut.statusCode, 401);
  assert.equal(noConsent.statusCode, 400);
});

test('feedback is posted server-side with selected account/request data and no session secrets', async () => {
  let forwardedUrl = '';
  let forwardedInit: RequestInit | undefined;
  const app = await makeServer({
    fetcher: async (input, init) => {
      forwardedUrl = String(input);
      forwardedInit = init;
      return new Response(null, { status: 204 });
    },
  });
  const response = await app.inject({ method: 'POST', url: '/api/feedback', headers: authenticatedHeaders, payload });
  const forwardedPayload = JSON.parse(String(forwardedInit?.body)) as { embeds: Array<{ description: string; fields: Array<{ name: string; value: string }> }>; allowed_mentions: unknown };
  const embed = forwardedPayload.embeds[0]!;
  const fields = Object.fromEntries(embed.fields.map((field) => [field.name, field.value]));

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { ok: true });
  assert.equal(forwardedUrl, webhookUrl);
  assert.equal(forwardedInit?.redirect, 'error');
  assert.equal(embed.description, payload.note);
  assert.match(fields.Rating!, /4\/5/);
  assert.match(fields['Discord user']!, /Clanky Tester/);
  assert.match(fields['Discord user ID']!, /^9999/);
  assert.equal(fields['Dashboard page'], payload.page);
  assert.equal(fields.Session, 'Authenticated Discord dashboard session');
  assert.match(fields['Source IP']!, /127\.0\.0\.1/);
  assert.equal(fields['Browser user-agent'], 'ClankyFeedbackTest/1.0');
  assert.deepEqual(forwardedPayload.allowed_mentions, { parse: [] });
  assert.doesNotMatch(JSON.stringify(forwardedPayload), /session.?id|oauth|refresh.?token|access.?token|cookie/i);
  assert.equal(response.body.includes(webhookUrl), false);
});

test('invalid feedback is rejected without contacting Discord', async () => {
  let called = false;
  const app = await makeServer({ fetcher: async () => { called = true; return new Response(null, { status: 204 }); } });
  const response = await app.inject({ method: 'POST', url: '/api/feedback', headers: authenticatedHeaders, payload: { ...payload, rating: 6 } });
  assert.equal(response.statusCode, 400);
  assert.equal(called, false);
});

test('honeypot submissions are acknowledged but never forwarded', async () => {
  let called = false;
  const app = await makeServer({ fetcher: async () => { called = true; return new Response(null, { status: 204 }); } });
  const response = await app.inject({ method: 'POST', url: '/api/feedback', headers: authenticatedHeaders, payload: { ...payload, website: 'spam.example' } });
  assert.equal(response.statusCode, 200);
  assert.equal(called, false);
});

test('per-account feedback throttling blocks a fourth note in one hour', async () => {
  const app = await makeServer({ fetcher: async () => new Response(null, { status: 204 }) });
  const submit = () => app.inject({ method: 'POST', url: '/api/feedback', headers: authenticatedHeaders, payload });
  assert.equal((await submit()).statusCode, 200);
  assert.equal((await submit()).statusCode, 200);
  assert.equal((await submit()).statusCode, 200);
  const limited = await submit();
  assert.equal(limited.statusCode, 429);
  assert.doesNotMatch(limited.body, /webhook|discord\.com/i);
});

test('per-IP feedback throttling blocks a sixth note even across different accounts', async () => {
  let identityNumber = 0;
  const app = await makeServer({
    getIdentity: () => ({ userId: `88880000000000${String(++identityNumber).padStart(4, '0')}`, username: 'another-user', displayName: null }),
    fetcher: async () => new Response(null, { status: 204 }),
  });
  const statuses: number[] = [];
  for (let i = 0; i < 6; i += 1) {
    const response = await app.inject({ method: 'POST', url: '/api/feedback', headers: authenticatedHeaders, payload });
    statuses.push(response.statusCode);
  }
  assert.deepEqual(statuses, [200, 200, 200, 200, 200, 429]);
});

test('unconfigured feedback returns a safe unavailable response', async () => {
  const app = await makeServer({ webhookUrl: undefined });
  const response = await app.inject({ method: 'POST', url: '/api/feedback', headers: authenticatedHeaders, payload });
  assert.equal(response.statusCode, 503);
  assert.doesNotMatch(response.body, /webhook|discord\.com/i);
});
