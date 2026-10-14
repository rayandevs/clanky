import { ButtonStyle, type ContainerBuilder } from 'discord.js';
import { cid } from '../../core/customId.js';
import { timestamp } from '../../core/time.js';
import type { TicketRecord } from '../../database/models/index.js';
import type { GuildSettings } from '../../settings/schema.js';
import { button, divider, panel, row, text } from '../../ui/components.js';
import { emoji } from '../../ui/emoji.js';
import { colors } from '../../ui/theme.js';

export function ticketPanel(settings: GuildSettings): ContainerBuilder {
  const s = settings.tickets;
  return panel({ title: s.panelTitle, emoji: 'ticket', description: s.panelDescription, accent: settings.general.accentColor }).addActionRowComponents(
    row(button({ id: cid('tk', 'open'), label: 'Open a ticket', emoji: 'ticket', style: ButtonStyle.Primary })),
  );
}

export function ticketHeader(ticket: TicketRecord, settings: GuildSettings): ContainerBuilder {
  const category = settings.tickets.categories.find((c) => c.id === ticket.category);
  const lines = [
    `${emoji('user')} **Opened by** <@${ticket.openerId}> ${timestamp(ticket.createdAt, 'R')}`,
    category ? `${emoji('list')} **Category** · ${category.label}` : null,
    ticket.claimedBy ? `${emoji('claim')} **Claimed by** <@${ticket.claimedBy}>` : `${emoji('loading')} Waiting for a staff member`,
  ].filter(Boolean);

  return panel({ title: `Ticket #${ticket.ticketId}`, emoji: 'ticket', accent: ticket.claimedBy ? colors.success : settings.general.accentColor })
    .addTextDisplayComponents(text(lines.join('\n')))
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(text(`**Topic**\n${ticket.topic || 'No topic given.'}`))
    .addActionRowComponents(
      row(
        button({ id: cid('tk', 'claim', ticket.ticketId), label: ticket.claimedBy ? 'Claimed' : 'Claim', emoji: 'claim', style: ButtonStyle.Success, disabled: Boolean(ticket.claimedBy) }),
        button({ id: cid('tk', 'close', ticket.ticketId), label: 'Close', emoji: 'lock', style: ButtonStyle.Danger }),
      ),
    );
}
