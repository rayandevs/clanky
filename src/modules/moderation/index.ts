import type { BotModuleDefinition } from '../../core/types.js';
import { banCommand, kickCommand, purgeCommand, timeoutCommand, unbanCommand, untimeoutCommand, warnCommand } from './actions.js';
import { caseComponents, casesCommand } from './cases.js';
import { reportComponents, reportMenu } from './report.js';
import { appealComponents } from './appeals.js';
import { raidCommand, raidComponents } from './raid.js';

export const moderationModule: BotModuleDefinition = {
  commands: [warnCommand, timeoutCommand, untimeoutCommand, kickCommand, banCommand, unbanCommand, purgeCommand, casesCommand, reportMenu, raidCommand],
  components: [caseComponents, reportComponents, appealComponents, raidComponents],
};
