import type { BotModuleDefinition } from '../../core/types.js';
import { aboutCommand, aboutComponents, pingCommand } from './about.js';
import { helpCommand, helpComponents } from './help.js';
import { serverInfoCommand, userInfoCommand, userInfoMenu } from './info.js';
import { preferencesCommand, preferencesComponents } from './preferences.js';

export const coreModule: BotModuleDefinition = {
  commands: [helpCommand, aboutCommand, pingCommand, preferencesCommand, userInfoCommand, userInfoMenu, serverInfoCommand],
  components: [helpComponents, aboutComponents, preferencesComponents],
};
