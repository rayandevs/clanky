import {
  ApplicationCommandOptionType,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  type APIApplicationCommandOption,
  type RESTPostAPIChatInputApplicationCommandsJSONBody,
} from 'discord.js';
import type { Clanky } from '../../client/Clanky.js';
import { everywhere } from '../../core/builders.js';
import { cid } from '../../core/customId.js';
import { components, slashCommand, type ModuleId } from '../../core/types.js';
import { MODULES } from '../../settings/registry.js';
import { button, divider, panel, row, text, v2, withFooter } from '../../ui/components.js';
import { componentEmoji, emoji } from '../../ui/emoji.js';
import { version } from '../../config/version.js';

const CORE = { id: 'core' as const, name: 'Essentials', emoji: 'sparkles' as const, description: 'Help, info and your preferences.' };
const SECTIONS = [CORE, ...MODULES.filter((m) => m.id !== 'general')];

function moduleSelect(current?: string) {
  return row(
    new StringSelectMenuBuilder()
      .setCustomId(cid('help', 'module'))
      .setPlaceholder('Pick a module')
      .addOptions(
        SECTIONS.map((m) => ({
          label: m.name,
          value: m.id,
          description: m.description.slice(0, 100),
          emoji: componentEmoji(m.emoji),
          default: m.id === current,
        })),
      ),
  );
}

function commandLines(client: Clanky, module: ModuleId): string[] {
  const lines: string[] = [];
  for (const command of client.commands.values()) {
    if (command.module !== module) continue;
    if (command.kind !== 'slash') {
      lines.push(`${emoji('list')} **${command.data.name}** · right-click menu (${command.kind === 'user' ? 'on a user' : 'on a message'})`);
      continue;
    }
    const json = command.data.toJSON() as RESTPostAPIChatInputApplicationCommandsJSONBody;
    const subs = (json.options ?? []).flatMap((option: APIApplicationCommandOption) => {
      if (option.type === ApplicationCommandOptionType.Subcommand) return [{ name: option.name, description: option.description }];
      if (option.type === ApplicationCommandOptionType.SubcommandGroup) {
        return (option.options ?? []).map((sub) => ({ name: `${option.name} ${sub.name}`, description: sub.description }));
      }
      return [];
    });
    if (subs.length) for (const sub of subs) lines.push(`${client.cmd(json.name, sub.name)} · ${sub.description}`);
    else lines.push(`${client.cmd(json.name)} · ${json.description}`);
  }
  return lines;
}

function homeView(client: Clanky, accent: number) {
  const list = SECTIONS.map((m) => `${emoji(m.emoji)} **${m.name}** · ${m.description}`).join('\n');
  const container = panel({
    title: 'Clanky Help',
    emoji: 'help',
    description: `Your all-in-one server helper. Pick a module to see its commands.\nAdmins can set everything up with ${client.cmd('settings')}.`,
    accent,
    thumbnail: client.user?.displayAvatarURL({ size: 128 }),
  })
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(text(list))
    .addActionRowComponents(moduleSelect());
  return withFooter(container, `${version.label} · Only slash commands, no prefixes.`);
}

function moduleView(client: Clanky, moduleId: string, accent: number) {
  const info = SECTIONS.find((m) => m.id === moduleId) ?? CORE;
  const lines = commandLines(client, info.id as ModuleId);
  const container = panel({ title: info.name, emoji: info.emoji, description: info.description, accent })
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(text(lines.length ? lines.join('\n') : 'This module works automatically — no commands needed. Set it up in /settings.'))
    .addActionRowComponents(moduleSelect(info.id))
    .addActionRowComponents(row(button({ id: cid('help', 'home'), label: 'Back', emoji: 'back' })));
  return container;
}

export const helpCommand = slashCommand({
  module: 'core',
  data: everywhere(new SlashCommandBuilder().setName('help').setDescription('See what Clanky can do')),
  execute: async ({ client, interaction, accent, user }) => {
    await interaction.reply(v2(homeView(client, accent), { ephemeral: user.preferences.privateReplies }));
  },
});

export const helpComponents = components({
  prefix: 'help',
  module: 'core',
  select: async ({ client, interaction, accent }) => {
    if (!interaction.isStringSelectMenu()) return;
    await interaction.update({ components: [moduleView(client, interaction.values[0]!, accent)] });
  },
  button: async ({ client, interaction, accent }) => {
    await interaction.update({ components: [homeView(client, accent)] });
  },
});
