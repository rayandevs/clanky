import { LabelBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import { channelMention, row, status } from '../../../ui/components.js';
import { emoji } from '../../../ui/emoji.js';
import { reply } from '../../../ui/respond.js';
import { guilds } from '../../../services/index.js';
import { canManageAutomod, deleteRule, RULE_KINDS, RULE_LABELS, ruleStates, syncAllRules, upsertRule, type RuleKind } from '../../automod/service.js';
import { actionButton, channelPicker, finishPage, pageHeader, save, selectedIds, sid, toggleButton, type SettingsPage } from '../kit.js';

export const automodPage: SettingsPage = {
  id: 'automod',
  async render(env) {
    const s = env.settings.automod;
    const states = await ruleStates(env.guild, env.settings);
    const lines = RULE_KINDS.map((kind) => `${emoji(states[kind] ? 'on' : 'off')} ${RULE_LABELS[kind]}`);
    const summary = [
      `**Status** · ${status(s.enabled)}`,
      ...lines,
      `${emoji('mention')} **Mention limit** · ${s.mentionLimit} per message`,
      `${emoji('filter')} **Blocked words** · ${s.blockedWords.length}`,
      `${emoji('bell')} **Alerts** · ${channelMention(s.alertChannelId)}`,
      canManageAutomod(env.guild) ? '-# Uses Discord AutoMod, so it works even when Clanky is offline.' : `${emoji('warning')} I need the **Manage Server** permission to manage AutoMod.`,
    ].join('\n');

    const container = pageHeader(env, 'automod', summary)
      .addActionRowComponents(
        row(
          toggleButton('automod', 'rule', 'Invites', states.invites).setCustomId(sid('automod', 'rule', 'invites')),
          toggleButton('automod', 'rule', 'Mentions', states.mentionSpam).setCustomId(sid('automod', 'rule', 'mentionSpam')),
          toggleButton('automod', 'rule', 'Spam', states.spam).setCustomId(sid('automod', 'rule', 'spam')),
          toggleButton('automod', 'rule', 'Words', states.keywords).setCustomId(sid('automod', 'rule', 'keywords')),
        ),
      )
      .addActionRowComponents(row(actionButton('automod', 'config', 'Words & limits', 'edit')))
      .addActionRowComponents(channelPicker(env, 'automod', 'alerts', { current: s.alertChannelId, placeholder: 'Channel for AutoMod alerts' }));
    return finishPage(container, 'automod');
  },

  async handle(ctx, action, args) {
    const { interaction } = ctx;
    const guild = interaction.guild;
    if (!canManageAutomod(guild)) {
      await reply(interaction, 'error', 'I need the **Manage Server** permission to manage AutoMod.');
      return 'done';
    }
    const s = ctx.guild.settings.automod;

    switch (action) {
      case 'rule': {
        const kind = args[0] as RuleKind;
        if (!RULE_KINDS.includes(kind)) return 'done';
        if (kind === 'keywords' && !s.blockedWords.length) {
          await reply(interaction, 'warning', 'Add some blocked words first with **Words & limits**.');
          return 'done';
        }
        const active = (await ruleStates(guild, ctx.guild.settings))[kind];
        if (active) {
          await deleteRule(guild, ctx.guild.settings, kind);
          await save(ctx, (d) => void (d.automod.rules[kind] = null));
        } else {
          const id = await upsertRule(guild, ctx.guild.settings, kind);
          await save(ctx, (d) => void (d.automod.rules[kind] = id));
        }
        return 'render';
      }
      case 'alerts': {
        const next = await save(ctx, (d) => void (d.automod.alertChannelId = selectedIds(interaction)[0] ?? null));
        await syncAllRules(guild, next);
        return 'render';
      }
      case 'config': {
        if (!interaction.isButton()) return 'done';
        await interaction.showModal(
          new ModalBuilder()
            .setCustomId(sid('automod', 'config-save'))
            .setTitle('AutoMod words & limits')
            .addLabelComponents(
              new LabelBuilder()
                .setLabel('Blocked words')
                .setDescription('Separate with commas. Use * as a wildcard, e.g. bad*')
                .setTextInputComponent(
                  new TextInputBuilder().setCustomId('words').setStyle(TextInputStyle.Paragraph).setRequired(false).setMaxLength(3000).setValue(s.blockedWords.join(', ')),
                ),
              new LabelBuilder()
                .setLabel('Max mentions per message')
                .setDescription('2 to 50')
                .setTextInputComponent(new TextInputBuilder().setCustomId('limit').setStyle(TextInputStyle.Short).setMaxLength(2).setValue(String(s.mentionLimit))),
            ),
        );
        return 'done';
      }
      case 'config-save': {
        if (!interaction.isModalSubmit()) return 'done';
        const limit = Number(interaction.fields.getTextInputValue('limit'));
        if (!Number.isInteger(limit) || limit < 2 || limit > 50) {
          await reply(interaction, 'error', 'Mention limit must be a number from **2** to **50**.');
          return 'done';
        }
        const words = [
          ...new Set(
            interaction.fields
              .getTextInputValue('words')
              .split(',')
              .map((w) => w.trim().toLowerCase())
              .filter((w) => w.length > 0 && w.length <= 60),
          ),
        ].slice(0, 100);
        const next = await save(ctx, (d) => {
          d.automod.blockedWords = words;
          d.automod.mentionLimit = limit;
        });
        if (!words.length && next.automod.rules.keywords) {
          await deleteRule(guild, next, 'keywords');
          await guilds.update(guild.id, (d) => void (d.automod.rules.keywords = null), { id: interaction.user.id });
        }
        await syncAllRules(guild, await guilds.settings(guild.id));
        return 'render';
      }
    }
    return 'done';
  },
};
