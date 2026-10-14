import {
  AutoModerationActionType,
  AutoModerationRuleEventType,
  AutoModerationRuleTriggerType,
  DiscordAPIError,
  PermissionFlagsBits,
  type AutoModerationActionOptions,
  type AutoModerationRule,
  type AutoModerationRuleCreateOptions,
  type Client,
  type Guild,
} from 'discord.js';
import { createLogger } from '../../core/logger.js';
import { bus, guilds } from '../../services/index.js';
import type { GuildSettings } from '../../settings/schema.js';

/**
 * Clanky manages a few native Discord AutoMod rules for each server.
 * Messages are blocked by Discord itself — fast and reliable, even if
 * Clanky is offline.
 */

const log = createLogger('automod');

export const RULE_KINDS = ['invites', 'mentionSpam', 'spam', 'keywords'] as const;
export type RuleKind = (typeof RULE_KINDS)[number];

export const RULE_LABELS: Record<RuleKind, string> = {
  invites: 'Block invite links',
  mentionSpam: 'Block mention spam',
  spam: 'Block spam',
  keywords: 'Blocked words',
};

const INVITE_REGEX = '(discord\\.gg|discord(app)?\\.com/invite|dsc\\.gg)/[a-z0-9-]+';

function actions(settings: GuildSettings, kind: RuleKind): AutoModerationActionOptions[] {
  const messages: Record<RuleKind, string> = {
    invites: "Invite links aren't allowed here.",
    mentionSpam: 'Too many mentions in one message.',
    spam: 'This message looks like spam.',
    keywords: 'This message has a blocked word.',
  };
  const list: AutoModerationActionOptions[] = [{ type: AutoModerationActionType.BlockMessage, metadata: { customMessage: messages[kind] } }];
  if (settings.automod.alertChannelId) {
    list.push({ type: AutoModerationActionType.SendAlertMessage, metadata: { channel: settings.automod.alertChannelId } });
  }
  if (kind === 'mentionSpam') list.push({ type: AutoModerationActionType.Timeout, metadata: { durationSeconds: 300 } });
  return list;
}

function ruleOptions(settings: GuildSettings, kind: RuleKind): AutoModerationRuleCreateOptions {
  const base = {
    eventType: AutoModerationRuleEventType.MessageSend,
    actions: actions(settings, kind),
    enabled: settings.automod.enabled,
    reason: 'Clanky AutoMod setup',
  };
  switch (kind) {
    case 'invites':
      return { ...base, name: 'Clanky · Invite links', triggerType: AutoModerationRuleTriggerType.Keyword, triggerMetadata: { regexPatterns: [INVITE_REGEX] } };
    case 'mentionSpam':
      return {
        ...base,
        name: 'Clanky · Mention spam',
        triggerType: AutoModerationRuleTriggerType.MentionSpam,
        triggerMetadata: { mentionTotalLimit: settings.automod.mentionLimit, mentionRaidProtectionEnabled: true },
      };
    case 'spam':
      return { ...base, name: 'Clanky · Spam', triggerType: AutoModerationRuleTriggerType.Spam };
    case 'keywords':
      return {
        ...base,
        name: 'Clanky · Blocked words',
        triggerType: AutoModerationRuleTriggerType.Keyword,
        triggerMetadata: { keywordFilter: settings.automod.blockedWords },
      };
  }
}

export function canManageAutomod(guild: Guild): boolean {
  return Boolean(guild.members.me?.permissions.has(PermissionFlagsBits.ManageGuild));
}

async function fetchRule(guild: Guild, id: string | null): Promise<AutoModerationRule | null> {
  if (!id) return null;
  try {
    return await guild.autoModerationRules.fetch({ autoModerationRule: id, force: false });
  } catch (error) {
    if (error instanceof DiscordAPIError && error.code === 10066) return null; // Unknown rule (deleted by hand)
    throw error;
  }
}

export async function ruleStates(guild: Guild, settings: GuildSettings): Promise<Record<RuleKind, boolean>> {
  const entries = await Promise.all(
    RULE_KINDS.map(async (kind) => [kind, Boolean(await fetchRule(guild, settings.automod.rules[kind]).catch(() => null))] as const),
  );
  return Object.fromEntries(entries) as Record<RuleKind, boolean>;
}

/** Creates or updates a rule. Returns its ID. */
export async function upsertRule(guild: Guild, settings: GuildSettings, kind: RuleKind): Promise<string> {
  const existing = await fetchRule(guild, settings.automod.rules[kind]);
  const options = ruleOptions(settings, kind);
  if (existing) {
    const { triggerType: _ignored, ...edit } = options;
    await existing.edit(edit);
    return existing.id;
  }
  const created = await guild.autoModerationRules.create(options);
  return created.id;
}

export async function deleteRule(guild: Guild, settings: GuildSettings, kind: RuleKind): Promise<void> {
  const rule = await fetchRule(guild, settings.automod.rules[kind]);
  if (rule) await rule.delete('Clanky AutoMod turned off');
}

/** Re-applies settings (alert channel, words, limits, on/off) to every active rule. */
export async function syncAllRules(guild: Guild, settings: GuildSettings): Promise<void> {
  for (const kind of RULE_KINDS) {
    if (!settings.automod.rules[kind]) continue;
    try {
      await upsertRule(guild, settings, kind);
    } catch (error) {
      log.warn(`Could not sync ${kind} rule in ${guild.id}`, error);
    }
  }
}

/** Turn native rules on/off when the module is toggled in /settings → General. */
export function watchAutomodToggle(client: Client): void {
  const lastEnabled = new Map<string, boolean>();
  bus.on('settingsChanged', async ({ guildId, sections }) => {
    if (!sections.includes('automod')) return;
    const guild = client.guilds.cache.get(guildId);
    if (!guild || !canManageAutomod(guild)) return;
    const settings = await guilds.settings(guildId);
    if (lastEnabled.get(guildId) === settings.automod.enabled) return;
    lastEnabled.set(guildId, settings.automod.enabled);
    for (const kind of RULE_KINDS) {
      const rule = await fetchRule(guild, settings.automod.rules[kind]).catch(() => null);
      if (rule && rule.enabled !== settings.automod.enabled) await rule.setEnabled(settings.automod.enabled).catch(() => null);
    }
  });
}
