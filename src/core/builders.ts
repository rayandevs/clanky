import { ApplicationIntegrationType, InteractionContextType } from 'discord.js';

interface ContextAware {
  setIntegrationTypes(...types: ApplicationIntegrationType[]): unknown;
  setContexts(...contexts: InteractionContextType[]): unknown;
}

/** Command usable everywhere: servers, DMs and as a user-installed app. */
export function everywhere<T extends ContextAware>(builder: T): T {
  builder.setIntegrationTypes(ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall);
  builder.setContexts(InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel);
  return builder;
}

/** Command only usable in servers where Clanky is installed. */
export function inServers<T extends ContextAware>(builder: T): T {
  builder.setIntegrationTypes(ApplicationIntegrationType.GuildInstall);
  builder.setContexts(InteractionContextType.Guild);
  return builder;
}
