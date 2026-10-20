import assert from 'node:assert/strict';
import test from 'node:test';
import type { LoggerEventRecord } from '../src/database/models/LoggerEvent.js';
import { loggerEvidenceHash, verifyLoggerEvidence } from '../src/modules/logging/evidence.js';
import { GuildSettingsSchema } from '../src/settings/schema.js';

function sampleEvidence(): Pick<LoggerEventRecord, 'eventId' | 'eventKey' | 'guildId' | 'eventType' | 'category' | 'source' | 'occurredAt' | 'actorId' | 'actorAttribution' | 'targetUserId' | 'channelId' | 'roleId' | 'messageId' | 'summary' | 'evidence' | 'severity' | 'riskScore' | 'riskReasons'> {
  return {
    eventId: 'event-1',
    eventKey: 'guild-1:message-edit:message-1:digest',
    guildId: 'guild-1',
    eventType: 'messageEdit',
    category: 'messages',
    source: 'gateway',
    occurredAt: new Date('2026-10-20T05:00:00.000Z'),
    actorId: null,
    actorAttribution: 'unknown',
    targetUserId: 'user-1',
    channelId: 'channel-1',
    roleId: null,
    messageId: 'message-1',
    summary: 'A message was edited.',
    evidence: {
      content: 'Updated text',
      attachments: [{ name: 'image.png', size: 1024, contentType: 'image/png' }],
      relatedMessageIds: ['message-0', 'message-1'],
    },
    severity: 'low',
    riskScore: 0,
    riskReasons: [],
  };
}

test('logger evidence hashes remain stable when nested evidence keys are reordered', () => {
  const original = sampleEvidence();
  const reordered = {
    ...original,
    evidence: {
      relatedMessageIds: [...original.evidence.relatedMessageIds!],
      attachments: original.evidence.attachments?.map(({ name, size, contentType }) => ({ contentType, size, name })),
      content: original.evidence.content,
    },
  };
  assert.equal(loggerEvidenceHash(original), loggerEvidenceHash(reordered));
});

test('logger evidence verification detects changes to the saved evidence', () => {
  const original = sampleEvidence();
  const evidenceHash = loggerEvidenceHash(original);
  assert.equal(verifyLoggerEvidence({ ...original, evidenceHash }), true);
  assert.equal(verifyLoggerEvidence({ ...original, summary: 'Changed after capture.', evidenceHash }), false);
  assert.equal(verifyLoggerEvidence({ ...original, evidence: { ...original.evidence, content: 'Tampered text' }, evidenceHash }), false);
});

test('logger settings remain private by default and expose the supported event safeguards', () => {
  const settings = GuildSettingsSchema.parse({}).logging;
  assert.equal(settings.enabled, false);
  assert.equal(settings.recordMessageContent, false);
  assert.equal(settings.recordAttachments, false);
  assert.equal(settings.detectionEnabled, true);
  assert.ok(settings.events.includes('messageBulkDelete'));
  assert.ok(settings.events.includes('suspiciousLinks'));
  assert.equal(settings.retentionDays.moderation, 365);
  assert.deepEqual(settings.viewerRoleIds, []);
  assert.deepEqual(settings.sensitiveEvidenceRoleIds, []);
});
