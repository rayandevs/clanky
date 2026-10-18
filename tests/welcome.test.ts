import assert from 'node:assert/strict';
import test from 'node:test';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { WelcomeArtworkModel } from '../src/database/models/index.js';
import { fillTemplate, welcomeMessage } from '../src/modules/welcome/render.js';
import { defaultGuildSettings, parseGuildSettings } from '../src/settings/schema.js';
import { normalizeUploadedImage, UploadedImageError } from '../src/render/imageUpload.js';
import { renderWelcomeCard } from '../src/render/welcomeCard.js';
import { wrapText } from '../src/render/canvas.js';
import type { PartialGuildMember } from 'discord.js';

const member = {
  id: '12345678901234567',
  displayName: 'Juno',
  displayAvatarURL: () => 'https://example.invalid/avatar.png',
  user: { username: 'juno' },
  guild: { name: 'Example Server', memberCount: 1285 },
} as unknown as PartialGuildMember;

test('migrates legacy welcome and leave settings without changing existing behavior', () => {
  const settings = parseGuildSettings({
    welcome: {
      enabled: true,
      channelId: '12345678901234567',
      message: 'Hi {user} in {server}',
      leaveEnabled: true,
      leaveMessage: 'Bye {user}',
      showAvatar: false,
      autoRoleIds: [],
    },
  });

  assert.equal(settings.welcome.enabled, true);
  assert.equal(settings.welcome.join.channelId, '12345678901234567');
  assert.equal(settings.welcome.join.message, 'Hi {user} in {server}');
  assert.equal(settings.welcome.join.format, 'container');
  assert.equal(settings.welcome.join.artwork.showAvatar, false);
  assert.equal(settings.welcome.join.includeBots, true);
  assert.equal(settings.welcome.leaveEnabled, true);
  assert.equal(settings.welcome.leave.channelId, null);
  assert.equal(settings.welcome.leave.message, 'Bye {user}');
  assert.equal(settings.welcome.leave.pingUser, true);
  assert.equal(settings.welcome.leave.artwork.showAvatar, false);
  assert.equal(settings.welcome.waitForScreening, false);
});

test('new welcome defaults keep leave messages on the join channel and retain the current container style', () => {
  const welcome = defaultGuildSettings().welcome;
  assert.equal(welcome.join.format, 'container');
  assert.equal(welcome.leave.format, 'container');
  assert.equal(welcome.leave.channelId, null);
  assert.equal(welcome.leave.pingUser, false);
  assert.equal(welcome.leave.artwork.showAvatar, true);
  assert.equal(welcome.waitForScreening, false);

  const emptyStoredSettings = parseGuildSettings({}).welcome;
  assert.equal(emptyStoredSettings.leave.pingUser, false);
  assert.equal(emptyStoredSettings.leave.artwork.showAvatar, true);
});

test('welcome placeholders support server display names and can render without a mention in card text', () => {
  const template = 'Welcome {user} ({username}/{displayname}) to {server}; member {count}';
  assert.equal(fillTemplate(template, member), 'Welcome <@12345678901234567> (juno/Juno) to Example Server; member 1,285');
  assert.equal(fillTemplate(template, member, false), 'Welcome Juno (juno/Juno) to Example Server; member 1,285');
});

test('welcome payload builder emits the selected text and card formats with controlled mentions', async () => {
  const settings = defaultGuildSettings();
  settings.welcome.join.message = 'Hello {user}';
  settings.welcome.join.pingUser = false;
  settings.welcome.join.format = 'text';
  const text = await welcomeMessage(member, settings, 'join');
  assert.equal(text.content, 'Hello <@12345678901234567>');
  assert.deepEqual(text.allowedMentions, { parse: [], users: [] });

  settings.welcome.join.format = 'text_image';
  settings.welcome.join.artwork.showAvatar = false;
  const withImage = await welcomeMessage(member, settings, 'join');
  assert.equal(withImage.content, 'Hello <@12345678901234567>');
  assert.equal(withImage.files?.length, 1);

  settings.welcome.join.format = 'image_only';
  const imageOnly = await welcomeMessage(member, settings, 'join');
  assert.equal(imageOnly.content, undefined);
  assert.equal(imageOnly.files?.length, 1);
});

test('uploaded artwork is validated and normalized to PNG once for shared upload routes', async () => {
  const source = createCanvas(80, 40);
  source.getContext('2d').fillRect(0, 0, 80, 40);
  const normalized = await normalizeUploadedImage(source.toBuffer('image/png'));
  const image = await loadImage(normalized.data);
  assert.equal(normalized.width, 80);
  assert.equal(normalized.height, 40);
  assert.equal(image.width, 80);
  assert.equal(image.height, 40);
  await assert.rejects(() => normalizeUploadedImage(Buffer.from('not an image')), UploadedImageError);
});

test('welcome artwork has a unique per-guild, per-event record and Canvas cards render at the expected size', async () => {
  assert.ok(WelcomeArtworkModel.schema.path('event'));
  assert.ok(WelcomeArtworkModel.schema.path('data'));
  assert.ok(WelcomeArtworkModel.schema.indexes().some(([keys, options]) => keys.guildId === 1 && keys.event === 1 && options.unique === true));

  const card = await renderWelcomeCard({
    event: 'join',
    template: 'minimal',
    accent: 0x7857ff,
    displayName: 'Juno',
    avatarUrl: '',
    serverName: 'Example Server',
    memberCount: 1285,
    message: 'Welcome to Example Server, Juno! Member 1,285.',
    showAvatar: false,
    showMemberCount: true,
    showServerName: true,
  });
  const image = await loadImage(card);
  assert.equal(image.width, 1000);
  assert.equal(image.height, 300);
});

test('welcome card text wrapping stays within the requested line count and width', () => {
  const ctx = createCanvas(1, 1).getContext('2d');
  ctx.font = '20px Arial';
  const lines = wrapText(ctx, 'A configurable welcome message with enough words to wrap cleanly into two short lines.', 170, 2);
  assert.ok(lines.length <= 2);
  assert.ok(lines.every((line) => ctx.measureText(line).width <= 170));
});
