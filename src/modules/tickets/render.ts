import { ButtonStyle, ContainerBuilder } from 'discord.js';
import { cid } from '../../core/customId.js';
import type { TicketRecord } from '../../database/models/index.js';
import type { GuildSettings, TicketPanelSetting } from '../../settings/schema.js';
import { button, divider, panel, row, text } from '../../ui/components.js';
import { colors } from '../../ui/theme.js';

export function ticketPanel(settings: GuildSettings, panelSettings: TicketPanelSetting, imageUrl?: string): ContainerBuilder {
  const container = panel({ title: panelSettings.title, emoji: 'ticket', description: panelSettings.description, accent: settings.general.accentColor });
  if (imageUrl) container.addMediaGalleryComponents((gallery) => gallery.addItems((item) => item.setURL(imageUrl).setDescription(`Support panel artwork for ${panelSettings.title}`)));
  return container.addActionRowComponents(
    row(button({ id: cid('tk', 'open', panelSettings.id), label: 'Open a ticket', emoji: 'ticket', style: ButtonStyle.Primary })),
  );
}

export function ticketHeader(ticket: TicketRecord, settings: GuildSettings, imageUrl = 'attachment://ticket-opening.png'): ContainerBuilder {
  const answers = ticket.answers?.length
    ? ticket.answers.map((answer) => text(`**${answer.label}**\n${answer.answer || '*No answer provided*'}`))
    : [text(`**Topic**\n${ticket.topic || 'No topic given.'}`)];

  return panel({ title: 'Ticket details', emoji: 'ticket', accent: ticket.claimedBy ? colors.success : settings.general.accentColor })
    .addMediaGalleryComponents((gallery) => gallery.addItems((item) => item.setURL(imageUrl).setDescription(`Ticket #${ticket.ticketId}, opened by ${ticket.openerDisplayName ?? ticket.openerId}${ticket.categoryLabel ? `, category ${ticket.categoryLabel}` : ''}`)))
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(...answers)
    .addActionRowComponents(
      row(
        button({ id: cid('tk', 'claim', ticket.ticketId), label: ticket.claimedBy ? 'Claimed' : 'Claim', emoji: 'claim', style: ButtonStyle.Success, disabled: Boolean(ticket.claimedBy) }),
        button({ id: cid('tk', 'close', ticket.ticketId), label: 'Close', emoji: 'lock', style: ButtonStyle.Danger }),
      ),
    );
}
