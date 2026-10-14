import { MessageFlags, type RepliableInteraction } from 'discord.js';
import { notice, v2, type NoticeKind, type TopLevel } from './components.js';

/**
 * Sends a Components V2 response, no matter if the interaction was
 * already deferred or replied to.
 */
export async function respond(
  interaction: RepliableInteraction,
  components: TopLevel | TopLevel[],
  options: { ephemeral?: boolean } = {},
): Promise<void> {
  const payload = v2(components, options);
  if (interaction.deferred && !interaction.replied) {
    await interaction.editReply({ components: payload.components, flags: MessageFlags.IsComponentsV2 });
  } else if (interaction.replied) {
    await interaction.followUp(payload);
  } else {
    await interaction.reply(payload);
  }
}

/** Ephemeral one-line feedback, e.g. `reply(i, 'success', 'Saved.')` */
export function reply(interaction: RepliableInteraction, kind: NoticeKind, message: string, title?: string) {
  return respond(interaction, notice(kind, message, title), { ephemeral: true });
}
