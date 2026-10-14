import { MessageFlags, SlashCommandBuilder, StringSelectMenuBuilder } from 'discord.js';
import { respond } from '../../ui/respond.js';
import type { Clanky } from '../../client/Clanky.js';
import { changelog, getChangelog } from '../../config/changelog.js';
import { env } from '../../config/env.js';
import { version } from '../../config/version.js';
import { everywhere } from '../../core/builders.js';
import { cid } from '../../core/customId.js';
import { formatDuration, timestamp } from '../../core/time.js';
import { components, slashCommand } from '../../core/types.js';
import { button, divider, panel, row, text, v2, withFooter } from '../../ui/components.js';
import { emoji } from '../../ui/emoji.js';

function aboutView(client: Clanky, accent: number) {
  const stats = [
    `${emoji('version')} **Version** · ${version.label} (${version.codename})`,
    `${emoji('server')} **Servers** · ${client.guilds.cache.size.toLocaleString()}`,
    `${emoji('clock')} **Uptime** · ${formatDuration(Date.now() - client.startedAt)}`,
    `${emoji('ping')} **Ping** · ${Math.max(0, client.ws.ping)}ms`,
  ].join('\n');

  const buttons = [button({ id: cid('about', 'changelog', version.raw), label: "What's new", emoji: 'sparkles' })];
  if (env.SUPPORT_URL) buttons.push(button({ url: env.SUPPORT_URL, label: 'Support', emoji: 'link' }));

  const container = panel({
    title: 'About Clanky',
    emoji: 'bot',
    description: 'A friendly helper for moderation, support, roles, leveling and more.',
    accent,
    thumbnail: client.user?.displayAvatarURL({ size: 128 }),
  })
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(text(stats))
    .addActionRowComponents(row(...buttons));
  return withFooter(container, 'Made with discord.js & TypeScript');
}

function changelogView(versionRaw: string, accent: number) {
  const entry = getChangelog(versionRaw) ?? changelog[0]!;
  const notes = entry.highlights.map((h) => `• ${h}`).join('\n');
  const container = panel({
    title: `What's new in ${entry.version}`,
    emoji: 'sparkles',
    description: `**${entry.title}** · ${timestamp(new Date(entry.date), 'D')}`,
    accent,
  })
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(text(notes));

  if (changelog.length > 1) {
    container.addActionRowComponents(
      row(
        new StringSelectMenuBuilder()
          .setCustomId(cid('about', 'version'))
          .setPlaceholder('Older versions')
          .addOptions(changelog.slice(0, 25).map((c) => ({ label: c.version, value: c.version, description: c.title.slice(0, 100), default: c.version === entry.version }))),
      ),
    );
  }
  return container.addActionRowComponents(row(button({ id: cid('about', 'home'), label: 'Back', emoji: 'back' })));
}

export const aboutCommand = slashCommand({
  module: 'core',
  data: everywhere(new SlashCommandBuilder().setName('about').setDescription('Version, stats and release notes')),
  execute: async ({ client, interaction, accent, user }) => {
    await interaction.reply(v2(aboutView(client, accent), { ephemeral: user.preferences.privateReplies }));
  },
});

export const aboutComponents = components({
  prefix: 'about',
  module: 'core',
  button: async ({ client, interaction, accent }, [action, ver]) => {
    const view = action === 'changelog' ? changelogView(ver ?? version.raw, accent) : aboutView(client, accent);
    await interaction.update({ components: [view] });
  },
  select: async ({ interaction, accent }) => {
    if (!interaction.isStringSelectMenu()) return;
    await interaction.update({ components: [changelogView(interaction.values[0]!, accent)] });
  },
});

export const pingCommand = slashCommand({
  module: 'core',
  data: everywhere(new SlashCommandBuilder().setName('ping').setDescription("Check Clanky's response time")),
  execute: async ({ client, interaction, accent }) => {
    const started = Date.now();
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const roundtrip = Date.now() - started;
    const container = panel({
      title: 'Pong!',
      emoji: 'ping',
      description: `Gateway **${Math.max(0, client.ws.ping)}ms** · Roundtrip **${roundtrip}ms**`,
      accent,
    });
    await respond(interaction, container);
  },
});
