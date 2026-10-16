import assert from 'node:assert/strict';
import test from 'node:test';
import { SuggestionModel } from '../src/database/models/index.js';
import { isSuggestionAnonymous } from '../src/modules/suggestions/privacy.js';
import { defaultGuildSettings, parseGuildSettings, SuggestionSettings } from '../src/settings/schema.js';

test('suggestion settings add safe defaults while preserving legacy anonymity and channel choices', () => {
  const legacy = parseGuildSettings({ suggestions: { enabled: true, channelId: '123456789012345678', reviewerRoleIds: [], anonymous: true, createThreads: false } }).suggestions;
  assert.equal(legacy.enabled, true);
  assert.equal(legacy.channelId, '123456789012345678');
  assert.equal(legacy.anonymous, true);
  assert.equal(legacy.allowAnonymousChoice, false);
  assert.equal(legacy.createThreads, false);
  assert.equal(legacy.maxOpenPerUser, 3);
  assert.equal(legacy.cooldownSeconds, 60);
  assert.equal(legacy.digestIntervalHours, 0);
  assert.deepEqual(legacy.categories, []);
  assert.equal(defaultGuildSettings().suggestions.maxOpenPerUser, 3);
});

test('suggestion categories must be unique and digest frequency is restricted to supported schedules', () => {
  const base = defaultGuildSettings().suggestions;
  assert.equal(SuggestionSettings.safeParse({ ...base, categories: ['Events', 'Features'] }).success, true);
  assert.equal(SuggestionSettings.safeParse({ ...base, categories: ['Events', 'events'] }).success, false);
  assert.equal(SuggestionSettings.safeParse({ ...base, digestIntervalHours: 12 }).success, false);
  assert.equal(SuggestionSettings.safeParse({ ...base, categories: Array.from({ length: 11 }, (_, i) => `Category ${i}`) }).success, false);
});

test('suggestion documents persist review history and recoverable Discord posting state', () => {
  assert.ok(SuggestionModel.schema.path('reviewHistory'));
  assert.ok(SuggestionModel.schema.path('postStatus'));
  assert.ok(SuggestionModel.schema.path('postError'));
  assert.ok(SuggestionModel.schema.path('postAttemptedAt'));
  assert.ok(SuggestionModel.schema.path('category'));
  assert.ok(SuggestionModel.schema.path('anonymous'));
  assert.ok(SuggestionModel.schema.indexes().some(([keys, options]) => keys.guildId === 1 && keys.suggestionId === 1 && options.unique === true));
  assert.ok(SuggestionModel.schema.indexes().some(([keys]) => keys.guildId === 1 && keys.authorId === 1 && keys.createdAt === -1));
});

test('legacy public suggestion rendering fails closed on author privacy when anonymity history is missing', () => {
  assert.equal(isSuggestionAnonymous(undefined), true);
  assert.equal(isSuggestionAnonymous(null), true);
  assert.equal(isSuggestionAnonymous(false), false);
  assert.equal(isSuggestionAnonymous(true), true);
});
