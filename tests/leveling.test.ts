import test from 'node:test';
import assert from 'node:assert/strict';
import { levelFromXp, progressForMember, totalXpFor, xpForNext, xpMultiplier } from '../src/services/LevelService.js';
import { parseGuildSettings } from '../src/settings/schema.js';
import { renderRankCard } from '../src/render/rankCard.js';

const levelingSettings = () => parseGuildSettings({}).leveling;

test('classic curve preserves the original quadratic thresholds', () => {
  assert.equal(xpForNext(0, 'classic'), 100);
  assert.equal(xpForNext(1, 'classic'), 155);
  assert.equal(xpForNext(10, 'classic'), 1_100);
  assert.equal(totalXpFor(1, 'classic'), 100);
  assert.deepEqual(levelFromXp(totalXpFor(12, 'classic'), 'classic'), { level: 12, current: 0, needed: xpForNext(12, 'classic') });
});

test('relaxed and challenging curves adjust future thresholds predictably', () => {
  assert.equal(xpForNext(10, 'relaxed'), 825);
  assert.equal(xpForNext(10, 'challenging'), 1_650);
  const halfway = { xp: 8_000, level: 10, levelProgress: 0.5 };
  assert.equal(progressForMember(halfway, 'relaxed').fraction, 0.5);
  assert.equal(progressForMember(halfway, 'challenging').fraction, 0.5);
});

test('channel and strongest matching role multipliers combine up to the 5x cap', () => {
  const config = levelingSettings();
  config.channelMultipliers = [{ channelId: 'channel', multiplier: 2 }, { channelId: 'parent', multiplier: 3 }];
  config.roleMultipliers = [{ roleId: 'role-a', multiplier: 2 }, { roleId: 'role-b', multiplier: 2.5 }];
  assert.equal(xpMultiplier(config, 'thread', 'parent', ['role-a', 'role-b']), 5);
  assert.equal(xpMultiplier(config, 'channel', null, ['role-a']), 4);
  assert.equal(xpMultiplier(config, 'unlisted', null, []), 1);
});

test('each rank-card theme renders at the expected canvas size with optional stats disabled', async () => {
  for (const theme of ['midnight', 'ember', 'forest', 'violet'] as const) {
    const png = await renderRankCard({ displayName: 'Nadia', username: 'nadia', avatarUrl: '', rank: null, level: 7, currentXp: 30, neededXp: 300, accent: 0xe2702f, theme, showRank: false, showMessages: false, showXp: false, showServerIcon: false });
    assert.equal(png.toString('hex', 0, 8), '89504e470d0a1a0a');
    assert.equal(png.readUInt32BE(16), 1000);
    assert.equal(png.readUInt32BE(20), 300);
  }
});
