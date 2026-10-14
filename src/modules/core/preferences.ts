import { ButtonStyle, SlashCommandBuilder, StringSelectMenuBuilder } from 'discord.js';
import { everywhere } from '../../core/builders.js';
import { cid } from '../../core/customId.js';
import { components, slashCommand } from '../../core/types.js';
import { users } from '../../services/index.js';
import type { UserPreferences } from '../../settings/schema.js';
import { button, divider, notice, panel, row, sectionWithButton, text, v2, withFooter } from '../../ui/components.js';
import { componentEmoji, emoji, type EmojiKey } from '../../ui/emoji.js';

type ToggleKey = 'privateReplies' | 'levelUpPings' | 'updateNotices';

const TOGGLES: Array<{ key: ToggleKey; emoji: EmojiKey; name: string; hint: string }> = [
  { key: 'privateReplies', emoji: 'privacy', name: 'Private replies', hint: 'Info replies like /rank only show to you.' },
  { key: 'levelUpPings', emoji: 'mention', name: 'Level-up pings', hint: 'Get pinged when you level up.' },
  { key: 'updateNotices', emoji: 'bell', name: 'Update notices', hint: 'A short note when Clanky gets new features.' },
];

function view(prefs: UserPreferences, accent: number) {
  const container = panel({
    title: 'Your Preferences',
    emoji: 'user',
    description: 'These follow you to every server.',
    accent,
  }).addSeparatorComponents(divider());

  for (const toggle of TOGGLES) {
    const on = prefs[toggle.key];
    container.addSectionComponents(
      sectionWithButton(
        `${emoji(toggle.emoji)} **${toggle.name}**\n-# ${toggle.hint}`,
        button({
          id: cid('pref', 'toggle', toggle.key),
          label: on ? 'On' : 'Off',
          emoji: on ? 'on' : 'off',
          style: on ? ButtonStyle.Success : ButtonStyle.Secondary,
        }),
      ),
    );
  }

  container
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(text(`${emoji('reminder')} **Reminder delivery**`))
    .addActionRowComponents(
      row(
        new StringSelectMenuBuilder().setCustomId(cid('pref', 'delivery')).addOptions(
          { label: 'Direct message', value: 'dm', description: 'Clanky DMs you.', emoji: componentEmoji('dm'), default: prefs.reminderDelivery === 'dm' },
          { label: 'Same channel', value: 'channel', description: 'Posted where you set it.', emoji: componentEmoji('channel'), default: prefs.reminderDelivery === 'channel' },
        ),
      ),
    )
    .addSeparatorComponents(divider())
    .addSectionComponents(
      sectionWithButton(
        `${emoji('delete')} **Delete my data**\n-# Removes your preferences, XP and reminders.`,
        button({ id: cid('pref', 'delete'), label: 'Delete', style: ButtonStyle.Danger }),
      ),
    );
  return withFooter(container, 'Changes save instantly.');
}

export const preferencesCommand = slashCommand({
  module: 'core',
  data: everywhere(new SlashCommandBuilder().setName('preferences').setDescription('Change your personal Clanky settings')),
  execute: async ({ interaction, user, accent }) => {
    await interaction.reply(v2(view(user.preferences, accent), { ephemeral: true }));
  },
});

export const preferencesComponents = components({
  prefix: 'pref',
  module: 'core',
  button: async ({ interaction, user, accent }, [action, key]) => {
    if (action === 'toggle' && key) {
      const toggleKey = key as ToggleKey;
      const prefs = await users.updatePreferences(user.userId, { [toggleKey]: !user.preferences[toggleKey] });
      return interaction.update({ components: [view(prefs, accent)] });
    }
    if (action === 'delete') {
      const confirm = notice('warning', 'This deletes your preferences, XP in every server and all reminders. It cannot be undone.', 'Delete your data?')
        .addActionRowComponents(
          row(
            button({ id: cid('pref', 'confirm'), label: 'Yes, delete', style: ButtonStyle.Danger, emoji: 'delete' }),
            button({ id: cid('pref', 'cancel'), label: 'Cancel', emoji: 'back' }),
          ),
        );
      return interaction.update({ components: [confirm] });
    }
    if (action === 'confirm') {
      await users.deleteAllData(user.userId);
      return interaction.update({ components: [notice('success', 'Your data was deleted. 👋')] });
    }
    return interaction.update({ components: [view(user.preferences, accent)] });
  },
  select: async ({ interaction, user, accent }) => {
    if (!interaction.isStringSelectMenu()) return;
    const value = interaction.values[0] as UserPreferences['reminderDelivery'];
    const prefs = await users.updatePreferences(user.userId, { reminderDelivery: value });
    await interaction.update({ components: [view(prefs, accent)] });
  },
});
