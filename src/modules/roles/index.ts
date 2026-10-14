import { randomBytes } from 'node:crypto';
import {
  ButtonStyle,
  LabelBuilder,
  ModalBuilder,
  PermissionFlagsBits,
  RadioGroupBuilder,
  RadioGroupOptionBuilder,
  RoleSelectMenuBuilder,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import { inServers } from '../../core/builders.js';
import { cid } from '../../core/customId.js';
import { guildComponents, guildSlashCommand, type BotModuleDefinition } from '../../core/types.js';
import { RolePanelModel, type RolePanelRecord } from '../../database/models/index.js';
import { button, divider, notice, panel, row, text, v2 } from '../../ui/components.js';
import { componentEmoji, emoji } from '../../ui/emoji.js';
import { reply } from '../../ui/respond.js';
import { assignableRoles } from '../settings/kit.js';

function panelMessage(record: RolePanelRecord, accent: number) {
  const roles = record.roleIds.map((id) => `${emoji('role')} <@&${id}>`).join('\n');
  const hint = record.mode === 'single' ? 'You can have one of these roles.' : 'Pick as many as you like.';
  return panel({ title: record.title, emoji: 'role', description: record.description || undefined, accent })
    .addSeparatorComponents(divider())
    .addTextDisplayComponents(text(`${roles}\n-# ${hint}`))
    .addActionRowComponents(row(button({ id: cid('rp', 'pick', record.panelId), label: 'Choose roles', emoji: 'role', style: ButtonStyle.Primary })));
}

const rolePanelCommand = guildSlashCommand({
  module: 'roles',
  data: inServers(new SlashCommandBuilder().setName('rolepanel').setDescription('Let members pick their own roles'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addSubcommand((s) => s.setName('create').setDescription('Create a role panel in this channel'))
    .addSubcommand((s) => s.setName('list').setDescription('Show role panels in this server'))
    .addSubcommand((s) =>
      s
        .setName('delete')
        .setDescription('Delete a role panel')
        .addStringOption((o) => o.setName('panel').setDescription('Which panel').setRequired(true).setAutocomplete(true)),
    ),
  autocomplete: async ({ interaction }) => {
    const query = interaction.options.getFocused().toLowerCase();
    const panels = await RolePanelModel.find({ guildId: interaction.guildId }).limit(100).lean<RolePanelRecord[]>();
    await interaction.respond(
      panels.filter((p) => p.title.toLowerCase().includes(query)).slice(0, 25).map((p) => ({ name: p.title.slice(0, 100), value: p.panelId })),
    );
  },
  execute: async ({ interaction, accent }) => {
    const sub = interaction.options.getSubcommand();

    if (sub === 'create') {
      if (!interaction.channel?.isSendable()) return reply(interaction, 'error', "I can't post in this channel.");
      return interaction.showModal(
        new ModalBuilder()
          .setCustomId(cid('rp', 'create'))
          .setTitle('New role panel')
          .addLabelComponents(
            new LabelBuilder().setLabel('Title').setTextInputComponent(new TextInputBuilder().setCustomId('title').setStyle(TextInputStyle.Short).setMaxLength(100).setPlaceholder('Pick your roles')),
            new LabelBuilder()
              .setLabel('Description')
              .setTextInputComponent(new TextInputBuilder().setCustomId('description').setStyle(TextInputStyle.Paragraph).setRequired(false).setMaxLength(500)),
            new LabelBuilder().setLabel('Roles').setDescription('Up to 25 roles').setRoleSelectMenuComponent(new RoleSelectMenuBuilder().setCustomId('roles').setMinValues(1).setMaxValues(25)),
            new LabelBuilder().setLabel('Mode').setRadioGroupComponent(
              new RadioGroupBuilder()
                .setCustomId('mode')
                .setRequired(true)
                .setOptions(
                  new RadioGroupOptionBuilder().setValue('multiple').setLabel('Pick any').setDescription('Members can have several roles').setDefault(true),
                  new RadioGroupOptionBuilder().setValue('single').setLabel('Pick one').setDescription('Picking a role removes the others'),
                ),
            ),
          ),
      );
    }

    if (sub === 'list') {
      const panels = await RolePanelModel.find({ guildId: interaction.guildId }).lean<RolePanelRecord[]>();
      const lines = panels.map((p) => `${emoji('role')} **${p.title}** · <#${p.channelId}> · ${p.roleIds.length} roles`);
      return interaction.reply(
        v2(panel({ title: 'Role panels', emoji: 'role', description: lines.join('\n') || 'No role panels yet. Make one with `/rolepanel create`.', accent }), { ephemeral: true }),
      );
    }

    const record = await RolePanelModel.findOneAndDelete({ guildId: interaction.guildId, panelId: interaction.options.getString('panel', true) }).lean<RolePanelRecord>();
    if (!record) return reply(interaction, 'error', "I couldn't find that panel.");
    const channel = interaction.guild.channels.cache.get(record.channelId);
    if (channel?.isTextBased() && record.messageId) await channel.messages.delete(record.messageId).catch(() => null);
    return reply(interaction, 'success', `Deleted **${record.title}**.`);
  },
});

const rolePanelComponents = guildComponents({
  prefix: 'rp',
  module: 'roles',
  modal: async ({ interaction, accent }) => {
    const roles = interaction.fields.getSelectedRoles('roles', true);
    const { ok, skipped } = assignableRoles(interaction.guild, [...roles.keys()]);
    if (!ok.length) return reply(interaction, 'error', "I can't give any of those roles. Move my role above them.");

    const record: RolePanelRecord = {
      guildId: interaction.guildId,
      panelId: randomBytes(5).toString('hex'),
      channelId: interaction.channelId!,
      messageId: null,
      title: interaction.fields.getTextInputValue('title').trim(),
      description: interaction.fields.getTextInputValue('description').trim(),
      mode: interaction.fields.getRadioGroup('mode', true) === 'single' ? 'single' : 'multiple',
      roleIds: ok,
      createdBy: interaction.user.id,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const channel = interaction.channel;
    if (!channel?.isSendable()) return reply(interaction, 'error', "I can't post in this channel.");
    const message = await channel.send(v2(panelMessage(record, accent)));
    await RolePanelModel.create({ ...record, messageId: message.id });

    const note = skipped ? `\n-# Skipped ${skipped} role(s) I can't give.` : '';
    return reply(interaction, 'success', `Role panel created.${note}`);
  },

  button: async ({ interaction, accent }, [, panelId]) => {
    const record = await RolePanelModel.findOne({ panelId }).lean<RolePanelRecord>();
    if (!record) return reply(interaction, 'error', 'This role panel was deleted.');
    const roles = record.roleIds.map((id) => interaction.guild.roles.cache.get(id)).filter((r) => r !== undefined);
    if (!roles.length) return reply(interaction, 'error', 'The roles on this panel no longer exist.');

    const select = new StringSelectMenuBuilder()
      .setCustomId(cid('rp', 'set', record.panelId))
      .setPlaceholder(record.mode === 'single' ? 'Pick a role' : 'Pick your roles')
      .setMinValues(0)
      .setMaxValues(record.mode === 'single' ? 1 : roles.length)
      .addOptions(roles.map((r) => ({ label: r.name.slice(0, 100), value: r.id, emoji: componentEmoji('role'), default: interaction.member.roles.cache.has(r.id) })));

    const container = panel({ title: record.title, emoji: 'role', description: 'Select the roles you want. Unselect to remove.', accent }).addActionRowComponents(row(select));
    return interaction.reply(v2(container, { ephemeral: true }));
  },

  select: async ({ interaction }, [, panelId]) => {
    if (!interaction.isStringSelectMenu()) return;
    const record = await RolePanelModel.findOne({ panelId }).lean<RolePanelRecord>();
    if (!record) return interaction.update({ components: [notice('error', 'This role panel was deleted.')] });

    const { ok: allowed } = assignableRoles(interaction.guild, record.roleIds);
    const chosen = new Set(interaction.values.filter((id) => allowed.includes(id)));
    const member = interaction.member;
    const add = allowed.filter((id) => chosen.has(id) && !member.roles.cache.has(id));
    const remove = allowed.filter((id) => !chosen.has(id) && member.roles.cache.has(id));

    if (add.length) await member.roles.add(add, `Role panel: ${record.title}`);
    if (remove.length) await member.roles.remove(remove, `Role panel: ${record.title}`);

    const parts = [
      add.length ? `${emoji('add')} Added ${add.map((id) => `<@&${id}>`).join(' ')}` : null,
      remove.length ? `${emoji('remove')} Removed ${remove.map((id) => `<@&${id}>`).join(' ')}` : null,
    ].filter(Boolean);
    return interaction.update({ components: [notice('success', parts.join('\n') || 'No changes. You already have these roles.')] });
  },
});

export const rolesModule: BotModuleDefinition = {
  commands: [rolePanelCommand],
  components: [rolePanelComponents],
};
