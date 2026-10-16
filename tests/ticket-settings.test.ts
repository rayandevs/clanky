import assert from 'node:assert/strict';
import test from 'node:test';
import { TicketModel, TicketPanelArtworkModel, TicketPanelMessageModel, TicketTranscriptMessageModel, TicketTranscriptModel } from '../src/database/models/index.js';
import { MAX_TRANSCRIPT_ATTACHMENT_BYTES, MAX_TRANSCRIPT_ATTACHMENT_COUNT, MAX_TRANSCRIPT_ATTACHMENT_TOTAL_BYTES } from '../src/modules/tickets/attachmentArchive.js';
import { defaultGuildSettings, parseGuildSettings, TicketSettings } from '../src/settings/schema.js';

const makePanel = (id: string, questions = 1) => ({
  id,
  title: `Panel ${id}`,
  description: 'Help text',
  parentId: null,
  logChannelId: null,
  staffRoleIds: null,
  questions: Array.from({ length: questions }, (_, i) => ({
    id: `q${i}`,
    label: `Question ${i}`,
    description: '',
    placeholder: '',
    style: 'paragraph' as const,
    required: true,
    minLength: 0,
    maxLength: 1000,
  })),
});

test('migrates legacy single-panel settings and preserves the saved title and description', () => {
  const settings = parseGuildSettings({ tickets: { enabled: true, panelTitle: 'Old title', panelDescription: 'Old text' }, moderation: { enabled: 'broken' } });
  assert.equal(settings.tickets.panels.length, 1);
  assert.equal(settings.tickets.panels[0]?.id, 'general');
  assert.equal(settings.tickets.panels[0]?.title, 'Old title');
  assert.equal(settings.tickets.panels[0]?.description, 'Old text');
  assert.equal(settings.tickets.panels[0]?.questions[0]?.label, 'How can we help?');
  assert.deepEqual(settings.tickets.panels[0]?.artwork, { mode: 'template', template: 'support' });
  assert.equal(settings.tickets.transcriptRetentionDays, '90');
});

test('supports at most three independent panels and keeps their IDs independent of titles', () => {
  const base = defaultGuildSettings().tickets;
  const three = { ...base, panels: [makePanel('support'), makePanel('billing'), makePanel('reports')] };
  assert.equal(TicketSettings.safeParse(three).success, true);
  assert.equal(TicketSettings.safeParse({ ...three, panels: [...three.panels, makePanel('other')] }).success, false);
  const renamed = TicketSettings.parse({ ...base, panels: [{ ...makePanel('support'), title: 'Renamed panel' }] });
  assert.equal(renamed.panels[0]?.id, 'support');
  assert.equal(TicketSettings.safeParse({ ...base, panels: [makePanel('same'), makePanel('same')] }).success, false);
});

test('enforces the five-field Discord modal limit including the shared topic selector', () => {
  const base = defaultGuildSettings().tickets;
  assert.equal(TicketSettings.safeParse({ ...base, panels: [makePanel('five', 5)] }).success, true);
  assert.equal(TicketSettings.safeParse({ ...base, categories: [{ id: 'topic', label: 'Help', description: '' }], panels: [makePanel('four', 4)] }).success, true);
  assert.equal(TicketSettings.safeParse({ ...base, categories: [{ id: 'topic', label: 'Help', description: '' }], panels: [makePanel('too-many', 5)] }).success, false);
  assert.equal(TicketSettings.safeParse({ ...base, panels: [makePanel('empty', 0)] }).success, false);
  assert.equal(TicketSettings.safeParse({ ...base, categories: [{ id: 'topic', label: 'Help', description: '' }], panels: [makePanel('topic-only', 0)] }).success, true);
});

test('question answers and posted panel references have persistence schemas', () => {
  assert.ok(TicketModel.schema.path('answers'));
  assert.ok(TicketModel.schema.path('panelId'));
  assert.ok(TicketModel.schema.path('staffRoleIds'));
  assert.ok(TicketPanelMessageModel.schema.path('messageId'));
  assert.ok(TicketPanelArtworkModel.schema.path('data'));
  assert.ok(TicketTranscriptModel.schema.path('expiresAt'));
  assert.ok(TicketTranscriptModel.schema.path('claimedByName'));
  assert.ok(TicketTranscriptModel.schema.path('closedByName'));
  assert.ok(TicketTranscriptMessageModel.schema.path('attachments'));
  assert.ok(TicketTranscriptMessageModel.schema.path('attachments.archiveId'));
  assert.equal(MAX_TRANSCRIPT_ATTACHMENT_BYTES, 25 * 1024 * 1024);
  assert.equal(MAX_TRANSCRIPT_ATTACHMENT_TOTAL_BYTES, 100 * 1024 * 1024);
  assert.equal(MAX_TRANSCRIPT_ATTACHMENT_COUNT, 500);
  assert.ok(TicketPanelMessageModel.schema.indexes().some(([keys, options]) => keys.guildId === 1 && keys.panelId === 1 && keys.channelId === 1 && options.unique === true));
  assert.ok(TicketTranscriptModel.schema.indexes().some(([keys, options]) => keys.expiresAt === 1 && options.expireAfterSeconds === 0));
  assert.ok(TicketTranscriptMessageModel.schema.indexes().some(([keys, options]) => keys.expiresAt === 1 && options.expireAfterSeconds === 0));
});
