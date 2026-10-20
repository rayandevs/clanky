import { createHash } from 'node:crypto';
import type { LoggerEventRecord } from '../../database/models/LoggerEvent.js';

function stableEvidenceString(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableEvidenceString).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value).filter(([, child]) => child !== undefined).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, child]) => `${JSON.stringify(key)}:${stableEvidenceString(child)}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

type HashableLoggerEvent = Pick<LoggerEventRecord,
  'eventId' | 'eventKey' | 'guildId' | 'eventType' | 'category' | 'source' | 'occurredAt' |
  'actorId' | 'actorAttribution' | 'targetUserId' | 'channelId' | 'roleId' | 'messageId' |
  'summary' | 'evidence' | 'severity' | 'riskScore' | 'riskReasons'
>;

function canonicalEvidence(event: HashableLoggerEvent): string {
  return stableEvidenceString([
    event.eventId, event.eventKey, event.guildId, event.eventType, event.category, event.source,
    event.occurredAt.toISOString(), event.actorId, event.actorAttribution, event.targetUserId,
    event.channelId, event.roleId, event.messageId, event.summary, event.evidence,
    event.severity, event.riskScore, event.riskReasons,
  ]);
}

export function loggerEvidenceHash(event: HashableLoggerEvent): string {
  return createHash('sha256').update(canonicalEvidence(event)).digest('hex');
}

export function verifyLoggerEvidence(event: HashableLoggerEvent & { evidenceHash: string }): boolean {
  return loggerEvidenceHash(event) === event.evidenceHash;
}
