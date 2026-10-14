import { ApplicationCommandType, Client, Collection, GatewayIntentBits, Partials } from 'discord.js';
import { env } from '../config/env.js';
import type { AnyCommand, BotModuleDefinition, ComponentHandler } from '../core/types.js';

const TYPE_FOR_KIND = {
  slash: ApplicationCommandType.ChatInput,
  user: ApplicationCommandType.User,
  message: ApplicationCommandType.Message,
} as const;

export const commandKey = (type: ApplicationCommandType, name: string) => `${type}:${name}`;

export class Clanky extends Client {
  /** Keyed by `${ApplicationCommandType}:${name}` */
  readonly commands = new Collection<string, AnyCommand>();
  readonly components = new Collection<string, ComponentHandler>();
  /** Command name → registered command ID, used for clickable mentions. */
  readonly commandIds = new Collection<string, string>();
  readonly startedAt = Date.now();

  constructor() {
    const intents = [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.GuildModeration,
    ];
    if (env.ENABLE_MESSAGE_CONTENT) intents.push(GatewayIntentBits.MessageContent);

    super({
      intents,
      partials: [Partials.Message, Partials.Channel, Partials.GuildMember],
      // Never ping anyone unless a message explicitly allows it.
      allowedMentions: { parse: [], repliedUser: false },
    });
  }

  register(modules: BotModuleDefinition[]): void {
    for (const mod of modules) {
      for (const command of mod.commands) {
        const key = commandKey(TYPE_FOR_KIND[command.kind], command.data.name);
        if (this.commands.has(key)) throw new Error(`Duplicate command: ${command.data.name}`);
        this.commands.set(key, command);
      }
      for (const handler of mod.components) {
        if (this.components.has(handler.prefix)) throw new Error(`Duplicate component prefix: ${handler.prefix}`);
        this.components.set(handler.prefix, handler);
      }
    }
  }

  /** Clickable command mention, e.g. </settings:123>. Falls back to plain text. */
  cmd(name: string, sub?: string): string {
    const full = sub ? `${name} ${sub}` : name;
    const id = this.commandIds.get(name);
    return id ? `</${full}:${id}>` : `\`/${full}\``;
  }
}
