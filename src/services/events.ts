import { EventEmitter } from 'node:events';
import type { SettingsSection } from '../settings/schema.js';

export interface SettingsChange {
  guildId: string;
  sections: SettingsSection[];
  actorId: string;
  source: 'bot' | 'dashboard' | 'system';
}

interface BusEvents {
  settingsChanged: [SettingsChange];
}

/** Internal event bus so modules can react to changes (e.g. settings). */
export const bus = new EventEmitter<BusEvents>();
