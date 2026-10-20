import { createHash, randomUUID } from 'node:crypto';
import type { Client, Guild, MessageCreateOptions } from 'discord.js';
import type { LoggerAttachmentEvidence, LoggerEventRecord } from '../../database/models/LoggerEvent.js';
import { IncidentModel, LoggerEventModel, type IncidentRecord } from '../../database/models/index.js';
import { createLogger } from '../../core/logger.js';
import { timestamp } from '../../core/time.js';
import { guilds } from '../../services/index.js';
import type { LogCategory, LogEvent, LogSeverity } from '../../settings/schema.js';
import { panel, text, v2 } from '../../ui/components.js';
import { colors } from '../../ui/theme.js';
import { loggerEvidenceHash, verifyLoggerEvidence } from './evidence.js';

export { loggerEvidenceHash, verifyLoggerEvidence };

const log = createLogger('logging');
const MAX_DELIVERY_ATTEMPTS = 8;
const DELIVERY_LEASE_MS = 60_000;
const INCIDENT_WINDOW_MS = 15 * 60_000;
const INCIDENT_ALERT_COOLDOWN_MS = 15 * 60_000;
const MAX_INCIDENT_IDS = 50;
const DAY = 86_400_000;

export interface LoggerEventInput {
  eventKey: string;
  eventType: LogEvent;
  category: LogCategory;
  source: 'gateway' | 'audit_log' | 'detector';
  summary: string;
  occurredAt?: Date;
  actorId?: string | null;
  actorAttribution?: 'self' | 'audit_log' | 'system' | 'unknown';
  targetUserId?: string | null;
  channelId?: string | null;
  roleId?: string | null;
  messageId?: string | null;
  actorRoleIds?: string[];
  targetRoleIds?: string[];
  isBot?: boolean;
  evidence?: LoggerEventRecord['evidence'];
  riskScore?: number;
  riskReasons?: string[];
}

interface DetectionRule {
  id: string;
  title: string;
  summary: string;
  severity: LogSeverity;
  score: number;
  since: Date;
  matchingEvents: LoggerEventRecord[];
}

const eventLabels: Record<LogEvent, string> = {
  messageDelete: 'Message deleted',
  messageEdit: 'Message edited',
  messageBulkDelete: 'Messages deleted in bulk',
  suspiciousLinks: 'Suspicious link burst',
  memberJoin: 'Member joined',
  memberLeave: 'Member left',
  memberRoles: 'Member roles changed',
  nickname: 'Nickname changed',
  memberBan: 'Member banned',
  memberUnban: 'Member unbanned',
  memberKick: 'Member kicked',
  channelCreate: 'Channel created',
  channelDelete: 'Channel deleted',
  channelUpdate: 'Channel updated',
  roleCreate: 'Role created',
  roleDelete: 'Role deleted',
  roleUpdate: 'Role updated',
  webhookCreate: 'Webhook created',
  webhookUpdate: 'Webhook updated',
  webhookDelete: 'Webhook deleted',
};

function categoryChannel(settings: Awaited<ReturnType<typeof guilds.settings>>['logging'], category: LogCategory): string | null {
  return settings.categoryChannels[category] ?? settings.channelId;
}

function retentionExpiry(days: number, at: Date): Date | null {
  return days === 0 ? null : new Date(at.getTime() + days * DAY);
}

function severityFor(score: number): LogSeverity {
  if (score >= 90) return 'critical';
  if (score >= 75) return 'high';
  if (score >= 50) return 'medium';
  return 'low';
}

function severityRank(severity: LogSeverity): number {
  return ({ low: 0, medium: 1, high: 2, critical: 3 })[severity];
}

function errorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/https?:\/\/\S+/gi, '[link]').slice(0, 500);
}

function isDuplicateKey(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && 'code' in error && error.code === 11000);
}

function incidentKey(guildId: string, ruleId: string, actorId: string | null, at: Date): string {
  const bucket = Math.floor(at.getTime() / INCIDENT_WINDOW_MS);
  return createHash('sha256').update(`${guildId}:${ruleId}:${actorId ?? 'unknown'}:${bucket}`).digest('hex');
}

function targetIds(events: LoggerEventRecord[], field: 'targetUserId' | 'channelId' | 'roleId' | 'actorId'): string[] {
  return [...new Set(events.map((event) => event[field]).filter((value): value is string => Boolean(value)))].slice(0, MAX_INCIDENT_IDS);
}

async function linkIncident(guildId: string, rule: DetectionRule, current: LoggerEventRecord, retentionDays: number, minimumAlertSeverity: 'medium' | 'high' | 'critical'): Promise<{ incident: IncidentRecord; shouldAlert: boolean }> {
  const participantId = current.actorId ?? current.targetUserId;
  let key = incidentKey(guildId, rule.id, participantId, current.occurredAt);
  let prior = await IncidentModel.findOne({ incidentKey: key }).lean<IncidentRecord | null>();
  if (!prior && participantId) {
    const participantField = current.actorId ? 'actorIds' : 'affectedUserIds';
    prior = await IncidentModel.findOne({
      guildId,
      ruleId: rule.id,
      status: { $in: ['open', 'investigating'] },
      lastEventAt: { $gte: new Date(current.occurredAt.getTime() - INCIDENT_WINDOW_MS), $lte: current.occurredAt },
      [participantField]: participantId,
    }).sort({ lastEventAt: -1 }).lean<IncidentRecord | null>();
    if (prior) key = prior.incidentKey;
  }
  if (prior && prior.status !== 'open' && prior.status !== 'investigating') {
    key = `${key}:${current.eventId}`;
    prior = null;
  }

  const matchingEvents = rule.matchingEvents.length ? rule.matchingEvents : [current];
  const correlatedEvents = matchingEvents.filter((event) => !event.incidentId || (prior && event.incidentId === prior.incidentId));
  if (!correlatedEvents.some((event) => event.eventId === current.eventId)) correlatedEvents.push(current);
  const firstEventAt = correlatedEvents.reduce((first, event) => event.occurredAt < first ? event.occurredAt : first, current.occurredAt);
  const proposedIncidentId = prior?.incidentId ?? randomUUID();
  const expiresAt = retentionExpiry(retentionDays, current.occurredAt);
  let saved: IncidentRecord | null = null;
  try {
    saved = await IncidentModel.findOneAndUpdate(
      { incidentKey: key },
      {
        $setOnInsert: {
          incidentId: proposedIncidentId,
          incidentKey: key,
          guildId,
          ruleId: rule.id,
          title: rule.title,
          status: 'open',
          eventCount: 1,
          affectedUserIds: [],
          affectedChannelIds: [],
          affectedRoleIds: [],
          actorIds: [],
          notes: [],
          resolvedAt: null,
          lastAlertAt: null,
        },
        $set: { severity: rule.severity, summary: rule.summary, ...(expiresAt ? { expiresAt } : { expiresAt: null }) },
        $min: { firstEventAt },
        $max: { lastEventAt: current.occurredAt, riskScore: rule.score },
      },
      { upsert: true, returnDocument: 'after' },
    ).lean<IncidentRecord | null>();
  } catch (error) {
    if (!isDuplicateKey(error)) throw error;
    saved = await IncidentModel.findOne({ incidentKey: key }).lean<IncidentRecord | null>();
  }
  if (!saved) throw new Error('Incident record was not available after creation.');
  const incidentId = saved.incidentId;

  const ids = correlatedEvents.map((event) => event.eventId).filter(Boolean);
  if (ids.length) await LoggerEventModel.updateMany({ eventId: { $in: ids }, guildId, incidentId: { $in: [null, incidentId] } }, { $set: { incidentId } });
  const attachedEvents = await LoggerEventModel.find({ guildId, incidentId, eventId: { $in: ids } }).lean<LoggerEventRecord[]>();
  const count = await LoggerEventModel.countDocuments({ guildId, incidentId });
  const users = targetIds(attachedEvents, 'targetUserId');
  const channels = targetIds(attachedEvents, 'channelId');
  const roles = targetIds(attachedEvents, 'roleId');
  const actors = targetIds(attachedEvents, 'actorId');
  const existing = await IncidentModel.findOne({ incidentId }).lean<IncidentRecord>();
  const bounded = (oldIds: string[], newIds: string[]) => [...new Set([...oldIds, ...newIds])].slice(0, MAX_INCIDENT_IDS);
  await IncidentModel.updateOne(
    { incidentId },
    {
      $set: {
        eventCount: Math.max(count, 1),
        affectedUserIds: bounded(existing?.affectedUserIds ?? [], users),
        affectedChannelIds: bounded(existing?.affectedChannelIds ?? [], channels),
        affectedRoleIds: bounded(existing?.affectedRoleIds ?? [], roles),
        actorIds: bounded(existing?.actorIds ?? [], actors),
      },
    },
  );

  const alertable = severityRank(rule.severity) >= severityRank(minimumAlertSeverity);
  let shouldAlert = false;
  if (alertable && (!prior?.lastAlertAt || prior.lastAlertAt.getTime() < Date.now() - INCIDENT_ALERT_COOLDOWN_MS)) {
    const claim = await IncidentModel.updateOne(
      { incidentId, $or: [{ lastAlertAt: null }, { lastAlertAt: { $lte: new Date(Date.now() - INCIDENT_ALERT_COOLDOWN_MS) } }] },
      { $set: { lastAlertAt: new Date() } },
    );
    shouldAlert = claim.modifiedCount > 0;
  }
  const incident = await IncidentModel.findOne({ incidentId }).lean<IncidentRecord>();
  if (!incident) throw new Error('Incident record was not available after creation.');
  return { incident, shouldAlert };
}

async function detectRule(event: LoggerEventRecord): Promise<DetectionRule | null> {
  const since = new Date(event.occurredAt.getTime() - 120_000);
  if (event.eventType === 'suspiciousLinks' && event.targetUserId) {
    const related = await LoggerEventModel.find({ guildId: event.guildId, eventType: 'suspiciousLinks', targetUserId: event.targetUserId, occurredAt: { $gte: since, $lte: event.occurredAt } }).sort({ occurredAt: -1 }).limit(20).lean<LoggerEventRecord[]>();
    const recentWebhook = await LoggerEventModel.findOne({ guildId: event.guildId, eventType: 'webhookCreate', occurredAt: { $gte: new Date(event.occurredAt.getTime() - 15 * 60_000), $lte: event.occurredAt } }).sort({ occurredAt: -1 }).lean<LoggerEventRecord | null>();
    const linked = recentWebhook ? [...related, recentWebhook] : related;
    return {
      id: recentWebhook ? 'new_account_links_after_webhook' : 'new_account_link_burst',
      title: recentWebhook ? 'New-account link burst after webhook creation' : 'New-account link burst',
      summary: `${related.length} suspicious link-burst signal(s) from a recently created account${recentWebhook ? '; a webhook was created shortly beforehand' : ''}. This is an indicator for review, not proof of misconduct.`,
      severity: recentWebhook ? 'critical' : 'high',
      score: recentWebhook ? 95 : 82,
      since,
      matchingEvents: linked,
    };
  }

  const windows: Partial<Record<LogEvent, { id: string; title: string; summary: string; threshold: number; since: Date; score: number; query?: Record<string, unknown> }>> = {
    channelDelete: { id: 'channel_delete_burst', title: 'Rapid channel deletions', summary: 'Several channels were deleted within a short period. Review the timeline and actor attribution.', threshold: 3, since, score: 85 },
    memberBan: { id: 'rapid_member_bans', title: 'Rapid member bans', summary: 'Several members were banned within a short period. Review the actions and context.', threshold: 5, since: new Date(event.occurredAt.getTime() - 60_000), score: 82 },
    roleUpdate: { id: 'role_permission_burst', title: 'Rapid role-permission changes', summary: 'Several role permission sets changed within a short period. Review the affected roles and actor.', threshold: 3, since, score: 88 },
  };
  const rule = windows[event.eventType as LogEvent];
  if (!rule) return null;
  if (event.eventType === 'roleUpdate' && !event.evidence.changedFields?.includes('permissions')) return null;
  const query: Record<string, unknown> = { guildId: event.guildId, eventType: event.eventType, occurredAt: { $gte: rule.since, $lte: event.occurredAt } };
  if (event.actorId) query.actorId = event.actorId;
  if (event.eventType === 'roleUpdate') query['evidence.changedFields'] = 'permissions';
  const matchingEvents = await LoggerEventModel.find(query).sort({ occurredAt: -1 }).limit(100).lean<LoggerEventRecord[]>();
  if (matchingEvents.length < rule.threshold) return null;
  return { ...rule, severity: 'high', matchingEvents };
}

async function createIncidentIfNeeded(guild: Guild, event: LoggerEventRecord, settings: Awaited<ReturnType<typeof guilds.settings>>['logging']): Promise<void> {
  if (!settings.detectionEnabled) return;
  const rule = await detectRule(event);
  if (!rule) return;
  const result = await linkIncident(guild.id, rule, event, settings.retentionDays[event.category as LogCategory], settings.alertMinimumSeverity);
  const severity = rule.severity;
  const reasons = [rule.id];
  const evidence = { ...event.evidence, relatedEventIds: rule.matchingEvents.map((item) => item.eventId).slice(0, 50) };
  const hashed = { ...event, severity, riskScore: rule.score, riskReasons: reasons, evidence };
  const mentionRoleIds = result.shouldAlert ? settings.alertRoleIds : [];
  await LoggerEventModel.updateOne(
    { eventId: event.eventId },
    { $set: { incidentId: result.incident.incidentId, severity, riskScore: rule.score, riskReasons: reasons, evidence, evidenceHash: loggerEvidenceHash(hashed), incidentAlert: result.shouldAlert, alertRoleIds: mentionRoleIds } },
  );
}

function incidentNotice(event: LoggerEventRecord): string | null {
  if (!event.incidentId || !event.incidentAlert || event.riskScore < 50) return null;
  return `⚠️ **Risk indicator · ${event.severity.toUpperCase()} · ${event.riskScore}/100**\n${event.riskReasons.join(', ')}\n-# Risk scores are indicators for investigation, not proof of misconduct.`;
}

function messagePayload(event: LoggerEventRecord): MessageCreateOptions {
  const alert = incidentNotice(event);
  const alertRoleIds = event.alertRoleIds ?? [];
  const details = [
    event.summary,
    event.actorId ? `Actor: <@${event.actorId}> · ${event.actorAttribution === 'unknown' ? 'unverified' : event.actorAttribution.replace('_', ' ')}` : 'Actor: Unknown / not attributed',
    event.targetUserId ? `Member: <@${event.targetUserId}>` : '',
    event.channelId ? `Channel: <#${event.channelId}>` : '',
    event.roleId ? `Role ID: ${event.roleId}` : '',
    event.evidence.changedFields?.length ? `Changed: ${event.evidence.changedFields.join(', ')}` : '',
    event.evidence.linkCount ? `Links observed: ${event.evidence.linkCount}` : '',
    event.evidence.content ? `\n**Message content**\n${event.evidence.content.slice(0, 1800)}` : '',
    event.evidence.beforeContent ? `\n**Previous content**\n${event.evidence.beforeContent.slice(0, 900)}` : '',
    event.evidence.attachments?.length ? `Attachments: ${event.evidence.attachments.map((file) => `${file.name} (${file.size} bytes${file.contentType ? `, ${file.contentType}` : ''})`).join(', ')}` : '',
    alert ?? '',
  ].filter(Boolean);
  const mentions = alertRoleIds.map((id) => `<@&${id}>`).join(' ');
  if (mentions) details.unshift(mentions);
  const accent = event.severity === 'critical' || event.severity === 'high' ? colors.error : event.severity === 'medium' ? colors.warning : colors.info;
  const detailText = details.join('\n');
  const boundedDetails = detailText.length > 3500 ? `${detailText.slice(0, 3480)}\n… evidence truncated in Discord; view the dashboard record for details.` : detailText;
  const container = panel({ title: eventLabels[event.eventType as LogEvent] ?? 'Server event', emoji: event.riskScore ? 'warning' : 'list', accent })
    .addTextDisplayComponents(text(boundedDetails))
    .addTextDisplayComponents(text(`-# Event ${event.eventId.slice(0, 12)} · ${timestamp(event.occurredAt, 'f')} · evidence SHA-256 ${event.evidenceHash.slice(0, 16)}…`));
  const payload = v2(container);
  return {
    ...payload,
    allowedMentions: { parse: [], roles: alertRoleIds },
  };
}

async function claimDelivery(event: LoggerEventRecord): Promise<LoggerEventRecord | null> {
  const now = new Date();
  const claimed = await LoggerEventModel.findOneAndUpdate(
    {
      eventId: event.eventId,
      'delivery.attempts': { $lt: MAX_DELIVERY_ATTEMPTS },
      $or: [
        { 'delivery.status': 'pending' },
        { 'delivery.status': 'failed', 'delivery.nextAttemptAt': { $lte: now } },
        { 'delivery.status': 'sending', 'delivery.leaseUntil': { $lte: now } },
      ],
    },
    { $set: { 'delivery.status': 'sending', 'delivery.leaseUntil': new Date(now.getTime() + DELIVERY_LEASE_MS) }, $inc: { 'delivery.attempts': 1 } },
    { returnDocument: 'after' },
  ).lean<LoggerEventRecord | null>();
  return claimed;
}

async function deliverEvent(client: Client, event: LoggerEventRecord): Promise<void> {
  const claimed = await claimDelivery(event);
  if (!claimed) return;
  const guild = client.guilds.cache.get(claimed.guildId) ?? await client.guilds.fetch(claimed.guildId).catch(() => null);
  const channel = guild && claimed.delivery.channelId ? await guild.channels.fetch(claimed.delivery.channelId).catch(() => null) : null;
  try {
    if (!channel?.isSendable()) throw new Error('The configured log channel is unavailable or cannot receive messages.');
    const sent = await channel.send(messagePayload(claimed));
    await LoggerEventModel.updateOne(
      { eventId: claimed.eventId, 'delivery.status': 'sending' },
      { $set: { 'delivery.status': 'delivered', 'delivery.messageId': sent.id, 'delivery.leaseUntil': null, 'delivery.nextAttemptAt': null, 'delivery.lastError': null } },
    );
  } catch (error) {
    const retry = claimed.delivery.attempts < MAX_DELIVERY_ATTEMPTS;
    const delay = Math.min(60_000 * 2 ** Math.max(0, claimed.delivery.attempts - 1), 6 * 60 * 60_000);
    await LoggerEventModel.updateOne(
      { eventId: claimed.eventId, 'delivery.status': 'sending' },
      { $set: {
        'delivery.status': 'failed',
        'delivery.leaseUntil': null,
        'delivery.nextAttemptAt': retry ? new Date(Date.now() + delay) : null,
        'delivery.lastError': errorMessage(error),
      } },
    );
    log.warn(`Could not deliver event ${claimed.eventId.slice(0, 12)}; ${retry ? 'retry scheduled' : 'manual retry required'}`, error);
  }
}

export async function recordLoggerEvent(guild: Guild, input: LoggerEventInput): Promise<LoggerEventRecord | null> {
  const settings = (await guilds.settings(guild.id)).logging;
  if (!settings.enabled || !settings.events.includes(input.eventType)) return null;
  if (input.channelId && settings.ignoredChannelIds.includes(input.channelId)) return null;
  if (input.isBot && !settings.includeBots) return null;
  if ([...(input.actorRoleIds ?? []), ...(input.targetRoleIds ?? [])].some((id) => settings.ignoredRoleIds.includes(id))) return null;

  const occurredAt = input.occurredAt ?? new Date();
  const evidence = { ...(input.evidence ?? {}) };
  if (!settings.recordMessageContent) {
    delete evidence.content;
    delete evidence.beforeContent;
  }
  if (!settings.recordAttachments) delete evidence.attachments;
  const destination = categoryChannel(settings, input.category);
  const expiresAt = retentionExpiry(settings.retentionDays[input.category], occurredAt);
  const initial = {
    eventId: randomUUID(),
    eventKey: `${guild.id}:${input.eventKey}`,
    guildId: guild.id,
    eventType: input.eventType,
    category: input.category,
    source: input.source,
    occurredAt,
    actorId: input.actorId ?? null,
    actorAttribution: input.actorAttribution ?? 'unknown',
    targetUserId: input.targetUserId ?? null,
    channelId: input.channelId ?? null,
    roleId: input.roleId ?? null,
    messageId: input.messageId ?? null,
    summary: input.summary.slice(0, 500),
    evidence,
    severity: input.riskScore ? severityFor(input.riskScore) : 'low' as LogSeverity,
    riskScore: Math.max(0, Math.min(100, input.riskScore ?? 0)),
    riskReasons: (input.riskReasons ?? []).slice(0, 10),
    incidentId: null,
    evidenceHash: '',
    delivery: { status: destination ? 'pending' as const : 'not_configured' as const, channelId: destination, attempts: 0, nextAttemptAt: null, leaseUntil: null, lastError: destination ? null : 'No log channel is configured for this category.', messageId: null },
    expiresAt,
  };
  initial.evidenceHash = loggerEvidenceHash(initial as LoggerEventRecord);

  let event: LoggerEventRecord;
  try {
    event = await LoggerEventModel.create(initial) as unknown as LoggerEventRecord;
  } catch (error) {
    if (!isDuplicateKey(error)) throw error;
    const prior = await LoggerEventModel.findOne({ guildId: guild.id, eventKey: `${guild.id}:${input.eventKey}` }).lean<LoggerEventRecord | null>();
    return prior;
  }

  await createIncidentIfNeeded(guild, event, settings).catch((error) => {
    log.warn(`Could not group event ${event.eventId.slice(0, 12)} into an incident`, error);
  });
  const refreshed = await LoggerEventModel.findOne({ eventId: event.eventId }).lean<LoggerEventRecord>();
  if (refreshed?.delivery.status === 'pending') await deliverEvent(guild.client, refreshed);
  return refreshed ?? event;
}

export async function retryLoggerEvent(client: Client, guildId: string, eventId: string): Promise<boolean> {
  const event = await LoggerEventModel.findOne({ guildId, eventId }).lean<LoggerEventRecord | null>();
  if (!event) return false;
  const logging = (await guilds.settings(guildId)).logging;
  const channelId = categoryChannel(logging, event.category as LogCategory);
  if (!channelId) return false;
  const queued = await LoggerEventModel.updateOne(
    { guildId, eventId, 'delivery.status': { $in: ['failed', 'not_configured'] } },
    { $set: { 'delivery.status': 'pending', 'delivery.channelId': channelId, 'delivery.attempts': 0, 'delivery.nextAttemptAt': null, 'delivery.leaseUntil': null, 'delivery.lastError': null } },
  );
  if (!queued.modifiedCount) return false;
  const updated = await LoggerEventModel.findOne({ guildId, eventId }).lean<LoggerEventRecord>();
  if (updated) await deliverEvent(client, updated);
  return true;
}

/** Durable retry worker: MongoDB lease claims keep multiple bot processes from sending the same item concurrently. */
export function startLoggerScheduler(client: Client): void {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const now = new Date();
      const pending = await LoggerEventModel.find({
        'delivery.attempts': { $lt: MAX_DELIVERY_ATTEMPTS },
        $or: [
          { 'delivery.status': 'pending' },
          { 'delivery.status': 'failed', 'delivery.nextAttemptAt': { $lte: now } },
          { 'delivery.status': 'sending', 'delivery.leaseUntil': { $lte: now } },
        ],
      }).sort({ occurredAt: 1 }).limit(40).lean<LoggerEventRecord[]>();
      for (const event of pending) await deliverEvent(client, event);
    } catch (error) {
      log.error('Logger delivery retry tick failed', error);
    } finally {
      running = false;
    }
  };
  setInterval(() => void tick(), 15_000).unref();
  void tick();
  log.info('Logger evidence delivery worker started');
}

export function attachmentEvidence(attachments: Iterable<{ name: string; size: number; contentType: string | null }>): LoggerAttachmentEvidence[] {
  return [...attachments].slice(0, 10).map(({ name, size, contentType }) => ({ name: name.slice(0, 200), size, contentType: contentType?.slice(0, 100) ?? null }));
}
