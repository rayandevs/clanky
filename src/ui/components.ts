import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  MessageFlags,
  SectionBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  TextDisplayBuilder,
  type MessageActionRowComponentBuilder,
} from 'discord.js';
import { componentEmoji, emoji, type EmojiKey } from './emoji.js';
import { colors } from './theme.js';

/* ──────────────────────────────────────────────────────────────
 * Message design system built on Components V2 (Containers).
 * Every user-facing message goes through these helpers so the bot
 * looks consistent everywhere.
 * ────────────────────────────────────────────────────────────── */

export type NoticeKind = 'success' | 'error' | 'warning' | 'info';

export const text = (content: string) => new TextDisplayBuilder().setContent(content);

export const divider = (spacing: 'small' | 'large' = 'small', visible = true) =>
  new SeparatorBuilder()
    .setDivider(visible)
    .setSpacing(spacing === 'large' ? SeparatorSpacingSize.Large : SeparatorSpacingSize.Small);

export interface PanelOptions {
  title: string;
  emoji?: EmojiKey;
  description?: string;
  accent?: number;
  /** Image URL shown on the right of the header. */
  thumbnail?: string | null;
}

/** A container with a consistent header. Add more content with the builder methods. */
export function panel(options: PanelOptions): ContainerBuilder {
  const container = new ContainerBuilder().setAccentColor(options.accent ?? colors.brand);
  const heading = `### ${options.emoji ? `${emoji(options.emoji)} ` : ''}${options.title}`;
  const content = options.description ? `${heading}\n${options.description}` : heading;

  if (options.thumbnail) {
    container.addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(text(content))
        .setThumbnailAccessory((thumb) => thumb.setURL(options.thumbnail!)),
    );
  } else {
    container.addTextDisplayComponents(text(content));
  }
  return container;
}

/** Adds a muted footer line (small text) to a container. */
export function withFooter(container: ContainerBuilder, footer: string): ContainerBuilder {
  return container.addSeparatorComponents(divider()).addTextDisplayComponents(text(`-# ${footer}`));
}

const NOTICE_STYLE: Record<NoticeKind, { emoji: EmojiKey; color: number }> = {
  success: { emoji: 'success', color: colors.success },
  error: { emoji: 'error', color: colors.error },
  warning: { emoji: 'warning', color: colors.warning },
  info: { emoji: 'info', color: colors.info },
};

/** Short one-message feedback: `notice('success', 'Saved.')` */
export function notice(kind: NoticeKind, message: string, title?: string): ContainerBuilder {
  const style = NOTICE_STYLE[kind];
  const body = title ? `### ${emoji(style.emoji)} ${title}\n${message}` : `${emoji(style.emoji)} ${message}`;
  return new ContainerBuilder().setAccentColor(style.color).addTextDisplayComponents(text(body));
}

/** A section: text on the left, a button on the right. */
export function sectionWithButton(content: string, button: ButtonBuilder): SectionBuilder {
  return new SectionBuilder().addTextDisplayComponents(text(content)).setButtonAccessory(button);
}

export interface ButtonOptions {
  id?: string;
  url?: string;
  label?: string;
  emoji?: EmojiKey;
  style?: ButtonStyle;
  disabled?: boolean;
}

export function button(options: ButtonOptions): ButtonBuilder {
  const b = new ButtonBuilder();
  if (options.url) b.setStyle(ButtonStyle.Link).setURL(options.url);
  else b.setStyle(options.style ?? ButtonStyle.Secondary).setCustomId(options.id!);
  if (options.label) b.setLabel(options.label);
  if (options.emoji) b.setEmoji(componentEmoji(options.emoji));
  if (options.disabled) b.setDisabled(true);
  return b;
}

export function row<T extends MessageActionRowComponentBuilder>(...components: T[]): ActionRowBuilder<T> {
  return new ActionRowBuilder<T>().addComponents(...components);
}

export type TopLevel = ContainerBuilder | ActionRowBuilder<MessageActionRowComponentBuilder> | TextDisplayBuilder | SeparatorBuilder | SectionBuilder;

export interface V2Payload {
  components: TopLevel[];
  flags: number;
}

/** Wraps components into a Components V2 payload. */
export function v2(components: TopLevel | TopLevel[], options: { ephemeral?: boolean } = {}): V2Payload {
  let flags: number = MessageFlags.IsComponentsV2;
  if (options.ephemeral) flags |= MessageFlags.Ephemeral;
  return { components: Array.isArray(components) ? components : [components], flags };
}

/** Status pill for settings, e.g. "🟢 On" / "🔴 Off" */
export const status = (on: boolean) => (on ? `${emoji('on')} On` : `${emoji('off')} Off`);

/** Simple progress bar, e.g. ▰▰▰▱▱ */
export function progressBar(current: number, total: number, size = 12): string {
  const ratio = total <= 0 ? 0 : Math.min(1, Math.max(0, current / total));
  const filled = Math.round(ratio * size);
  return '▰'.repeat(filled) + '▱'.repeat(size - filled);
}

export const channelMention = (id: string | null | undefined) => (id ? `<#${id}>` : '`Not set`');
export const roleMentions = (ids: string[]) => (ids.length ? ids.map((id) => `<@&${id}>`).join(' ') : '`None`');

export function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}
