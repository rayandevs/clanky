import {
  LabelBuilder,
  ModalBuilder,
  RoleSelectMenuBuilder,
  StringSelectMenuBuilder,
  TextDisplayBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import { channelMention, row, status, truncate } from '../../../ui/components.js';
import { componentEmoji, emoji } from '../../../ui/emoji.js';
import { reply } from '../../../ui/respond.js';
import {
  actionButton,
  assignableRoles,
  channelPicker,
  finishPage,
  pageHeader,
  save,
  selectedIds,
  sid,
  toggleButton,
  type SettingsPage,
} from '../kit.js';

const ANNOUNCE_LABELS = { off: "Don't announce", current: 'In the same channel', channel: 'In a set channel' } as const;

function intIn(value: string, min: number, max: number): number | null {
  const n = Number(value.trim());
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
}

export const levelingPage: SettingsPage = {
  id: 'leveling',
  render(env) {
    const s = env.settings.leveling;
    const rewards = [...s.rewards].sort((a, b) => a.level - b.level);
    const summary = [
      `**Status** · ${status(s.enabled)}`,
      `${emoji('xp')} **XP per message** · ${s.xpMin}–${s.xpMax} every ${s.cooldownSeconds}s`,
      `${emoji('bell')} **Level-ups** · ${ANNOUNCE_LABELS[s.announce]}${s.announce === 'channel' ? ` (${channelMention(s.announceChannelId)})` : ''}`,
      `${emoji('message')} **Message** · ${truncate(s.message, 100)}`,
      `${emoji('trophy')} **Rewards** · ${rewards.length ? rewards.map((r) => `Lv ${r.level} → <@&${r.roleId}>`).join(', ') : '`None`'}`,
      `${emoji('role')} **Keep old rewards** · ${status(s.stackRewards)}`,
    ].join('\n');

    const container = pageHeader(env, 'leveling', summary)
      .addActionRowComponents(
        row(
          toggleButton('leveling', 'toggle', 'Module', s.enabled),
          toggleButton('leveling', 'stack', 'Keep old rewards', s.stackRewards),
          actionButton('leveling', 'xp', 'XP & message', 'edit'),
          actionButton('leveling', 'add-reward', 'Add reward', 'add'),
        ),
      )
      .addActionRowComponents(
        row(
          new StringSelectMenuBuilder()
            .setCustomId(sid('leveling', 'announce'))
            .setPlaceholder('Where to announce level-ups')
            .addOptions(
              (Object.keys(ANNOUNCE_LABELS) as Array<keyof typeof ANNOUNCE_LABELS>).map((key) => ({
                label: ANNOUNCE_LABELS[key],
                value: key,
                default: s.announce === key,
              })),
            ),
        ),
      );

    if (s.announce === 'channel') {
      container.addActionRowComponents(channelPicker(env, 'leveling', 'channel', { current: s.announceChannelId, placeholder: 'Level-up channel' }));
    }
    container.addActionRowComponents(
      channelPicker(env, 'leveling', 'ignore', { current: s.ignoredChannelIds, placeholder: 'Channels with no XP', max: 25 }),
    );
    if (rewards.length) {
      container.addActionRowComponents(
        row(
          new StringSelectMenuBuilder()
            .setCustomId(sid('leveling', 'remove-reward'))
            .setPlaceholder('Remove a reward')
            .addOptions(
              rewards.map((r) => ({
                label: `Level ${r.level} → ${env.guild.roles.cache.get(r.roleId)?.name ?? 'Deleted role'}`,
                value: `${r.level}-${r.roleId}`,
                emoji: componentEmoji('trophy'),
              })),
            ),
        ),
      );
    }
    return finishPage(container, 'leveling');
  },

  async handle(ctx, action) {
    const { interaction } = ctx;
    const s = ctx.guild.settings.leveling;
    switch (action) {
      case 'toggle':
        await save(ctx, (d) => void (d.leveling.enabled = !d.leveling.enabled));
        return 'render';
      case 'stack':
        await save(ctx, (d) => void (d.leveling.stackRewards = !d.leveling.stackRewards));
        return 'render';
      case 'announce':
        await save(ctx, (d) => void (d.leveling.announce = selectedIds(interaction)[0] as typeof d.leveling.announce));
        return 'render';
      case 'channel':
        await save(ctx, (d) => void (d.leveling.announceChannelId = selectedIds(interaction)[0] ?? null));
        return 'render';
      case 'ignore':
        await save(ctx, (d) => void (d.leveling.ignoredChannelIds = selectedIds(interaction)));
        return 'render';
      case 'remove-reward': {
        const value = selectedIds(interaction)[0];
        await save(ctx, (d) => void (d.leveling.rewards = d.leveling.rewards.filter((r) => `${r.level}-${r.roleId}` !== value)));
        return 'render';
      }
      case 'xp': {
        if (!interaction.isButton()) return 'done';
        const input = (id: string, value: string, max = 4) =>
          new TextInputBuilder().setCustomId(id).setStyle(TextInputStyle.Short).setMaxLength(max).setValue(value);
        await interaction.showModal(
          new ModalBuilder()
            .setCustomId(sid('leveling', 'xp-save'))
            .setTitle('XP & level-up message')
            .addLabelComponents(
              new LabelBuilder().setLabel('Minimum XP per message').setDescription('1 to 100').setTextInputComponent(input('min', String(s.xpMin))),
              new LabelBuilder().setLabel('Maximum XP per message').setDescription('1 to 200').setTextInputComponent(input('max', String(s.xpMax))),
              new LabelBuilder().setLabel('Cooldown in seconds').setDescription('0 to 3600').setTextInputComponent(input('cooldown', String(s.cooldownSeconds))),
              new LabelBuilder()
                .setLabel('Level-up message')
                .setDescription('Use {user} and {level}')
                .setTextInputComponent(new TextInputBuilder().setCustomId('message').setStyle(TextInputStyle.Paragraph).setMaxLength(500).setValue(s.message)),
            ),
        );
        return 'done';
      }
      case 'xp-save': {
        if (!interaction.isModalSubmit()) return 'done';
        const f = interaction.fields;
        const min = intIn(f.getTextInputValue('min'), 1, 100);
        const max = intIn(f.getTextInputValue('max'), 1, 200);
        const cooldown = intIn(f.getTextInputValue('cooldown'), 0, 3600);
        if (min === null || max === null || cooldown === null || min > max) {
          await reply(interaction, 'error', 'Please check the numbers. Minimum XP must be lower than maximum XP.');
          return 'done';
        }
        await save(ctx, (d) => {
          Object.assign(d.leveling, { xpMin: min, xpMax: max, cooldownSeconds: cooldown });
          d.leveling.message = f.getTextInputValue('message').trim() || d.leveling.message;
        });
        return 'render';
      }
      case 'add-reward': {
        if (!interaction.isButton()) return 'done';
        if (s.rewards.length >= 20) {
          await reply(interaction, 'warning', 'You can have up to **20** rewards. Remove one first.');
          return 'done';
        }
        await interaction.showModal(
          new ModalBuilder()
            .setCustomId(sid('leveling', 'add-reward-save'))
            .setTitle('New level reward')
            .addTextDisplayComponents(new TextDisplayBuilder().setContent('Members get this role when they reach the level.'))
            .addLabelComponents(
              new LabelBuilder().setLabel('Level').setTextInputComponent(new TextInputBuilder().setCustomId('level').setStyle(TextInputStyle.Short).setMaxLength(3).setPlaceholder('10')),
              new LabelBuilder().setLabel('Role').setRoleSelectMenuComponent(new RoleSelectMenuBuilder().setCustomId('role').setMaxValues(1)),
            ),
        );
        return 'done';
      }
      case 'add-reward-save': {
        if (!interaction.isModalSubmit()) return 'done';
        const level = intIn(interaction.fields.getTextInputValue('level'), 1, 500);
        const role = interaction.fields.getSelectedRoles('role', true).first();
        if (level === null || !role) {
          await reply(interaction, 'error', 'Pick a role and a level from **1** to **500**.');
          return 'done';
        }
        if (!assignableRoles(interaction.guild, [role.id]).ok.length) {
          await reply(interaction, 'error', `I can't give ${role}. Move my role above it.`);
          return 'done';
        }
        await save(ctx, (d) => {
          d.leveling.rewards = d.leveling.rewards.filter((r) => r.level !== level && r.roleId !== role.id);
          d.leveling.rewards.push({ level, roleId: role.id });
        });
        return 'render';
      }
    }
    return 'done';
  },
};
