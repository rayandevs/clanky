import type { BotModuleDefinition } from '../core/types.js';
import { coreModule } from './core/index.js';
import { gamesModule } from './games/index.js';
import { levelingModule } from './leveling/index.js';
import { moderationModule } from './moderation/index.js';
import { pollsModule } from './polls/index.js';
import { remindersModule } from './reminders/index.js';
import { rolesModule } from './roles/index.js';
import { settingsModule } from './settings/index.js';
import { suggestionsModule } from './suggestions/index.js';
import { ticketsModule } from './tickets/index.js';

/**
 * Every feature module. Logging, Welcome and AutoMod work through events
 * and the /settings panel, so they don't register commands.
 */
export const modules: BotModuleDefinition[] = [
  coreModule,
  settingsModule,
  moderationModule,
  ticketsModule,
  rolesModule,
  suggestionsModule,
  levelingModule,
  remindersModule,
  pollsModule,
  gamesModule,
];
