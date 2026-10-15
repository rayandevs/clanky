import type { EmojiKey } from '../ui/emoji.js';
import type { SettingsSection } from './schema.js';

/**
 * Describes every feature module. Used by /settings, /help and — later —
 * the dashboard to render navigation and module toggles.
 */
export interface ModuleInfo {
  id: SettingsSection;
  name: string;
  emoji: EmojiKey;
  description: string;
  /** Can admins switch it on/off? */
  toggleable: boolean;
  /** Has its own page in /settings */
  hasSettingsPage: boolean;
}

export const MODULES: ModuleInfo[] = [
  { id: 'general', name: 'General', emoji: 'settings', description: 'Look and feel, update notes and modules.', toggleable: false, hasSettingsPage: true },
  { id: 'moderation', name: 'Moderation', emoji: 'shield', description: 'Warn, timeout, kick and ban with case history.', toggleable: true, hasSettingsPage: true },
  { id: 'automod', name: 'AutoMod', emoji: 'automod', description: 'Block invites, spam and bad words using Discord AutoMod.', toggleable: true, hasSettingsPage: true },
  { id: 'logging', name: 'Logging', emoji: 'log', description: 'Log edits, deletes, joins and leaves.', toggleable: true, hasSettingsPage: true },
  { id: 'welcome', name: 'Welcome', emoji: 'welcome', description: 'Greet new members and give them roles.', toggleable: true, hasSettingsPage: true },
  { id: 'tickets', name: 'Tickets', emoji: 'ticket', description: 'Private support channels with transcripts.', toggleable: true, hasSettingsPage: true },
  { id: 'suggestions', name: 'Suggestions', emoji: 'suggestion', description: 'Let members share and vote on ideas.', toggleable: true, hasSettingsPage: true },
  { id: 'leveling', name: 'Leveling', emoji: 'level', description: 'Earn XP by chatting and unlock roles.', toggleable: true, hasSettingsPage: true },
  { id: 'roles', name: 'Role Panels', emoji: 'role', description: 'Let members pick their own roles.', toggleable: true, hasSettingsPage: false },
  { id: 'reminders', name: 'Reminders', emoji: 'reminder', description: 'Personal reminders.', toggleable: true, hasSettingsPage: false },
  { id: 'games', name: 'Games', emoji: 'game', description: 'Play Salvage: dig up loot, level up and collect.', toggleable: true, hasSettingsPage: true },
  { id: 'polls', name: 'Polls', emoji: 'poll', description: 'Quick native Discord polls.', toggleable: true, hasSettingsPage: false },
];

export const getModule = (id: string) => MODULES.find((m) => m.id === id);
export const TOGGLEABLE = MODULES.filter((m) => m.toggleable);
