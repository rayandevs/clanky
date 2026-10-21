import assert from 'node:assert/strict';
import test from 'node:test';
import { GuildSettingsSchema } from '../src/settings/schema.js';

test('moderation policy defaults are conservative and do not enable escalation or raid channels', () => {
  const settings = GuildSettingsSchema.parse({}).moderation;
  assert.equal(settings.warningWindowDays, 90);
  assert.deepEqual(settings.warningEscalations, []);
  assert.deepEqual(settings.raidChannelIds, []);
  assert.equal(settings.raidSlowmodeSeconds, 10);
  assert.equal(settings.reviewRetentionDays, 180);
});

test('moderation settings accept distinct rolling timeout tiers and explicit raid channels', () => {
  const result = GuildSettingsSchema.safeParse({ moderation: {
    warningWindowDays: 30,
    warningEscalations: [{ warnings: 3, durationSeconds: 600 }, { warnings: 5, durationSeconds: 86_400 }],
    raidChannelIds: ['12345678901234567'],
    raidSlowmodeSeconds: 60,
    reviewRetentionDays: 90,
  } });
  assert.equal(result.success, true);
  if (result.success) {
    assert.deepEqual(result.data.moderation.warningEscalations, [{ warnings: 3, durationSeconds: 600 }, { warnings: 5, durationSeconds: 86_400 }]);
    assert.deepEqual(result.data.moderation.raidChannelIds, ['12345678901234567']);
  }
});

test('moderation settings reject duplicate escalation thresholds and invalid durations', () => {
  const duplicate = GuildSettingsSchema.safeParse({ moderation: {
    warningEscalations: [{ warnings: 3, durationSeconds: 600 }, { warnings: 3, durationSeconds: 3600 }],
  } });
  assert.equal(duplicate.success, false);

  const tooLong = GuildSettingsSchema.safeParse({ moderation: {
    warningEscalations: [{ warnings: 4, durationSeconds: 2_419_201 }],
  } });
  assert.equal(tooLong.success, false);

  const duplicateRaidChannels = GuildSettingsSchema.safeParse({ moderation: {
    raidChannelIds: ['12345678901234567', '12345678901234567'],
  } });
  assert.equal(duplicateRaidChannels.success, false);
});
