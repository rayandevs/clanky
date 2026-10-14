import type { BotModuleDefinition } from '../../core/types.js';
import { banCommand, kickCommand, purgeCommand, timeoutCommand, unbanCommand, untimeoutCommand, warnCommand } from './actions.js';
import { caseComponents, casesCommand } from './cases.js';
import { reportComponents, reportMenu } from './report.js';

export const moderationModule: BotModuleDefinition = {
  commands: [warnCommand, timeoutCommand, untimeoutCommand, kickCommand, banCommand, unbanCommand, purgeCommand, casesCommand, reportMenu],
  components: [caseComponents, reportComponents],
};
