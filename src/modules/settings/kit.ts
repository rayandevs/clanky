import {
  ButtonStyle,
  ChannelSelectMenuBuilder,
  ChannelType,
  ContainerBuilder,
  RoleSelectMenuBuilder,
  StringSelectMenuBuilder,
  type AnySelectMenuInteraction,
  type ButtonInteraction,
  type Guild,
  type ModalSubmitInteraction,
} from 'discord.js';
import type { Clanky } from '../../client/Clanky.js';
import { cid } from '../../core/customId.js';
import type { GuildContext } from '../../core/types.js';
import { guilds } from '../../services/index.js';
import { MODULES, type ModuleInfo } from '../../settings/registry.js';
import type { GuildSettings } from '../../settings/schema.js';
import { button, divider, panel, row, text, withFooter } from '../../ui/components.js';
import { componentEmoji } from '../../ui/emoji.js';

export type PageId = 'home' | ModuleInfo['id'];

export interface PageEnv {
  client: Clanky;
  guild: Guild;
  settings: GuildSettings;
  accent: number;
}

export type SettingsInteraction =
  | ButtonInteraction<'cached'>
  | AnySelectMenuInteraction<'cached'>
  | ModalSubmitInteraction<'cached'>;

export type SettingsCtx = GuildContext<SettingsInteraction>;

/**
 * "render" → re-draw the page after a change.
 * "done"   → the handler already replied.
 * { warn } → re-draw, then show a short warning.
 */
export type HandleResult = 'render' | 'done' | { warn: string };

export interface SettingsPage {
  id: PageId;
  render(env: PageEnv): ContainerBuilder | Promise<ContainerBuilder>;
  handle?(ctx: SettingsCtx, action: string, args: string[]): Promise<HandleResult>;
}

/** Custom ID for a settings control. */
export const sid = (page: PageId, action: string, ...args: string[]) => cid('set', page, action, ...args);

export function save(ctx: SettingsCtx, mutate: (draft: GuildSettings) => void): Promise<GuildSettings> {
  return guilds.update(ctx.interaction.guildId, mutate, { id: ctx.interaction.user.id, source: 'bot' });
}

export function pageHeader(env: PageEnv, page: PageId, summary: string): ContainerBuilder {
  const info = MODULES.find((m) => m.id === page);
  return panel({
    title: info ? `${info.name} Settings` : 'Server Settings',
    emoji: info?.emoji ?? 'settings',
    description: info?.description,
    accent: env.accent,
  })
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(text(summary));
}

export function navRow(current: PageId) {
  const pages = MODULES.filter((m) => m.hasSettingsPage);
  return row(
    new StringSelectMenuBuilder()
      .setCustomId(cid('set', 'nav'))
      .setPlaceholder('Jump to a module')
      .addOptions(
        { label: 'Overview', value: 'home', emoji: componentEmoji('home'), default: current === 'home' },
        ...pages.map((m) => ({ label: m.name, value: m.id, emoji: componentEmoji(m.emoji), default: m.id === current })),
      ),
  );
}

export function finishPage(container: ContainerBuilder, current: PageId): ContainerBuilder {
  container.addSeparatorComponents(divider()).addActionRowComponents(navRow(current));
  return withFooter(container, 'Changes save instantly · Needs Manage Server');
}

export function toggleButton(page: PageId, action: string, label: string, on: boolean) {
  return button({
    id: sid(page, action),
    label: `${label}: ${on ? 'On' : 'Off'}`,
    emoji: on ? 'on' : 'off',
    style: on ? ButtonStyle.Success : ButtonStyle.Secondary,
  });
}

export function actionButton(page: PageId, action: string, label: string, emojiKey: Parameters<typeof button>[0]['emoji']) {
  return button({ id: sid(page, action), label, emoji: emojiKey, style: ButtonStyle.Primary });
}

const TEXT_CHANNELS = [ChannelType.GuildText, ChannelType.GuildAnnouncement];

export function channelPicker(
  env: PageEnv,
  page: PageId,
  action: string,
  options: { current: string | null | string[]; placeholder: string; max?: number; types?: ChannelType[] },
) {
  const current = (Array.isArray(options.current) ? options.current : [options.current]).filter(
    (id): id is string => Boolean(id && env.guild.channels.cache.has(id)),
  );
  const max = options.max ?? 1;
  return row(
    new ChannelSelectMenuBuilder()
      .setCustomId(sid(page, action))
      .setPlaceholder(options.placeholder)
      .setChannelTypes(...(options.types ?? TEXT_CHANNELS))
      .setMinValues(0)
      .setMaxValues(max)
      .setDefaultChannels(...current.slice(0, max)),
  );
}

export function rolePicker(env: PageEnv, page: PageId, action: string, options: { current: string[]; placeholder: string; max: number }) {
  const current = options.current.filter((id) => env.guild.roles.cache.has(id));
  return row(
    new RoleSelectMenuBuilder()
      .setCustomId(sid(page, action))
      .setPlaceholder(options.placeholder)
      .setMinValues(0)
      .setMaxValues(options.max)
      .setDefaultRoles(...current.slice(0, options.max)),
  );
}

/** Selected IDs from a channel/role select, or [] */
export function selectedIds(interaction: SettingsInteraction): string[] {
  return interaction.isAnySelectMenu() ? [...interaction.values] : [];
}

/** Roles Clanky can actually give: below its top role and not managed. */
export function assignableRoles(guild: Guild, ids: string[]): { ok: string[]; skipped: number } {
  const me = guild.members.me;
  const ok = ids.filter((id) => {
    const role = guild.roles.cache.get(id);
    return role && !role.managed && id !== guild.id && me && role.position < me.roles.highest.position;
  });
  return { ok, skipped: ids.length - ok.length };
}
