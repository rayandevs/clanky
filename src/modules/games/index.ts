import { MessageFlags, SlashCommandBuilder, type ButtonInteraction, type ChatInputCommandInteraction, type AnySelectMenuInteraction } from 'discord.js';
import { everywhere } from '../../core/builders.js';
import { components, slashCommand, type BotModuleDefinition, type Context } from '../../core/types.js';
import type { GameEventType } from '../../database/models/index.js';
import { TOOL_BY_ID, ZONE_BY_ID } from '../../games/salvage/data.js';
import { salvage, zoneOf } from '../../services/SalvageService.js';
import { timestamp } from '../../core/time.js';
import { notice as noticeBox } from '../../ui/components.js';
import { emoji } from '../../ui/emoji.js';
import { reply } from '../../ui/respond.js';
import { bagView, collectionView, cooldownText, eventView, findView, messageView, profileView, shopView, topView, type View } from './views.js';

const notice = (message: string) => ({ components: [noticeBox('success', message)] });

type AnyCtx = Context<ChatInputCommandInteraction | ButtonInteraction | AnySelectMenuInteraction>;

/** Server admins can limit games to some channels. Returns a message if blocked. */
function blockedHere(ctx: AnyCtx): string | null {
  const allowed = ctx.guild?.settings.games.channelIds ?? [];
  if (!allowed.length || !ctx.interaction.channelId) return null;
  const channel = ctx.interaction.channel;
  const id = channel?.isThread() ? channel.parentId : ctx.interaction.channelId;
  if (id && allowed.includes(id)) return null;
  return `Games are played in ${allowed.slice(0, 5).map((c) => `<#${c}>`).join(', ')} here.`;
}

const guildIdOf = (ctx: AnyCtx) => (ctx.guild ? ctx.guild.guildId : null);

/** Runs one dig and builds the screen for it. */
async function dig(ctx: AnyCtx): Promise<{ cooldown: Date } | { view: () => Promise<View> }> {
  const userId = ctx.interaction.user.id;
  const result = await salvage.dig(userId, guildIdOf(ctx));
  if (result.status === 'cooldown') return { cooldown: result.readyAt };
  if (result.status === 'event') return { view: () => eventView(result.type, result.player, userId, ctx.accent) };
  return { view: () => findView(result, userId, ctx.accent) };
}

const salvageCommand = slashCommand({
  module: 'games',
  cooldown: 1,
  data: everywhere(
    new SlashCommandBuilder()
      .setName('salvage')
      .setDescription('Dig through scrap for loot')
      .addSubcommand((s) => s.setName('dig').setDescription('Dig for loot'))
      .addSubcommand((s) => s.setName('bag').setDescription('See and sell your loot'))
      .addSubcommand((s) => s.setName('shop').setDescription('Buy better tools'))
      .addSubcommand((s) =>
        s
          .setName('profile')
          .setDescription('Your level, tools and stats')
          .addUserOption((o) => o.setName('user').setDescription('Someone else (optional)')),
      )
      .addSubcommand((s) => s.setName('collection').setDescription('Every item you have found'))
      .addSubcommand((s) => s.setName('top').setDescription('Best salvagers')),
  ),
  execute: async (ctx) => {
    const { interaction, accent, user } = ctx;
    const blocked = blockedHere(ctx);
    if (blocked) return reply(interaction, 'info', blocked);

    const flags = MessageFlags.IsComponentsV2 | (user.preferences.privateReplies ? MessageFlags.Ephemeral : 0);
    const me = interaction.user.id;
    const send = (view: View) => interaction.reply({ ...view, flags });

    switch (interaction.options.getSubcommand()) {
      case 'dig': {
        const result = await dig(ctx);
        if ('cooldown' in result) return reply(interaction, 'info', cooldownText(result.cooldown));
        await interaction.deferReply(user.preferences.privateReplies ? { flags: MessageFlags.Ephemeral } : {});
        return interaction.editReply({ ...(await result.view()), flags: MessageFlags.IsComponentsV2 });
      }
      case 'bag':
        return send(bagView(await salvage.get(me), me, accent));
      case 'shop':
        return send(shopView(await salvage.get(me), me, accent));
      case 'collection': {
        const player = await salvage.get(me);
        return send(collectionView(player, me, zoneOf(player).id, accent));
      }
      case 'profile': {
        const target = interaction.options.getUser('user') ?? interaction.user;
        if (target.bot) return reply(interaction, 'info', "Bots don't play Salvage. Yet. 🤖");
        const player = target.id === me ? await salvage.get(me) : await salvage.find(target.id);
        if (!player) return reply(interaction, 'info', `**${target.displayName}** hasn't played yet.`);
        await interaction.deferReply(user.preferences.privateReplies ? { flags: MessageFlags.Ephemeral } : {});
        return interaction.editReply({ ...(await profileView(player, target, me, accent, guildIdOf(ctx))), flags: MessageFlags.IsComponentsV2 });
      }
      case 'top': {
        await interaction.deferReply(user.preferences.privateReplies ? { flags: MessageFlags.Ephemeral } : {});
        const view = await topView(ctx.client, interaction.inCachedGuild() && ctx.guild ? interaction.guild : null, ctx.guild ? 's' : 'g', 0, me, accent);
        return interaction.editReply({ ...view, flags: MessageFlags.IsComponentsV2 });
      }
    }
  },
});

const salvageComponents = components({
  prefix: 'sv',
  module: 'games',
  button: async (ctx, [action, owner, ...args]) => {
    const { interaction, accent } = ctx;
    if (interaction.user.id !== owner) {
      return reply(interaction, 'info', `This isn't yours. Start your own with ${ctx.client.cmd('salvage', 'dig')}.`);
    }
    // Swap the whole screen; `attachments: []` removes the previous image.
    const show = (view: View) => interaction.update({ ...view, attachments: [] });
    const showDeferred = async (build: () => Promise<View>) => {
      await interaction.deferUpdate();
      await interaction.editReply({ ...(await build()), attachments: [] });
    };

    switch (action) {
      case 'dig': {
        const result = await dig(ctx);
        if ('cooldown' in result) return reply(interaction, 'info', cooldownText(result.cooldown));
        return showDeferred(result.view);
      }
      case 'ev': {
        const [type, choice] = args as [GameEventType, 'fight' | 'run' | 'open'];
        const result = await salvage.resolveEvent(owner, type, choice);
        const player = () => salvage.get(owner);
        switch (result.status) {
          case 'expired':
            return reply(interaction, 'info', 'This event is over. Keep digging!');
          case 'fled':
            return show(messageView(await player(), owner, accent, `${emoji('run')} You ran away. The golem keeps its loot… for now.`));
          case 'lost':
            return show(messageView(await player(), owner, accent, `${emoji('golem')} The golem knocked you over! You can dig again ${timestamp(result.readyAt, 'R')}.`));
          case 'won':
            return showDeferred(() => findView(result, owner, accent, `${emoji('fight')} **You beat the Scrap Golem!** It dropped this:`));
          case 'opened':
            return showDeferred(() => findView(result, owner, accent, `${emoji('crate')} **You opened the crate!**`));
        }
        return;
      }
      case 'bag':
        return show(bagView(await salvage.get(owner), owner, accent));
      case 'sell': {
        const result = await salvage.sell(owner, args[0] === 'all' ? 'all' : 'junk');
        const note = result.count
          ? `${emoji('success')} Sold **${result.count.toLocaleString()}** items for ${emoji('credits')} **${result.credits.toLocaleString()}** credits.`
          : `${emoji('info')} Nothing to sell there.`;
        return show(bagView(result.player, owner, accent, note));
      }
      case 'shop':
        return show(shopView(await salvage.get(owner), owner, accent));
      case 'buy': {
        const tool = TOOL_BY_ID.get(args[0] ?? '');
        const result = await salvage.buyTool(owner, args[0] ?? '');
        if (!result.ok) {
          const why = { level: `You need level **${tool?.level}** for that.`, credits: "You don't have enough credits yet.", unknown: "That tool doesn't exist." }[result.reason];
          return reply(interaction, 'warning', why);
        }
        const note = result.bought
          ? `${emoji('party')} You bought the ${tool!.emoji} **${tool!.name}**! It's equipped.`
          : `${emoji('success')} Equipped the ${tool!.emoji} **${tool!.name}**.`;
        return show(shopView(result.player, owner, accent, note));
      }
      case 'profile':
        return showDeferred(async () => profileView(await salvage.get(owner), interaction.user, owner, accent, guildIdOf(ctx)));
      case 'col': {
        const player = await salvage.get(owner);
        return show(collectionView(player, owner, args[0] ?? zoneOf(player).id, accent));
      }
      case 'top': {
        const [scope, page] = args;
        const guild = interaction.inCachedGuild() && ctx.guild ? interaction.guild : null;
        return showDeferred(() => topView(ctx.client, guild, scope === 's' ? 's' : 'g', Math.max(0, Number(page) || 0), owner, accent));
      }
    }
  },
  select: async (ctx, [action, owner]) => {
    const { interaction, accent } = ctx;
    if (interaction.user.id !== owner) return reply(interaction, 'info', `This isn't yours. Start your own with ${ctx.client.cmd('salvage', 'dig')}.`);
    const value = interaction.values[0] ?? '';

    if (action === 'travel') {
      const zone = ZONE_BY_ID.get(value);
      const player = await salvage.travel(owner, value);
      await interaction.deferUpdate();
      // Always re-render so the menu snaps back to the real zone.
      const current = player ?? (await salvage.get(owner));
      await interaction.editReply({ ...(await profileView(current, interaction.user, owner, accent, guildIdOf(ctx))), attachments: [] });
      if (!player || !zone) {
        return interaction.followUp({ components: [noticeBox('warning', `Reach level **${zone?.level ?? '?'}** to travel there.`)], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
      }
      return interaction.followUp({ ...notice(`You traveled to ${zone.emoji} **${zone.name}**. Loot here is worth ×${zone.valueMultiplier}!`), flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
    }
    if (action === 'col') {
      return interaction.update({ ...collectionView(await salvage.get(owner), owner, value, accent), attachments: [] });
    }
  },
});

export const gamesModule: BotModuleDefinition = {
  commands: [salvageCommand],
  components: [salvageComponents],
};
