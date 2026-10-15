import { ButtonStyle, SlashCommandBuilder, type Client } from 'discord.js';
import { Types } from 'mongoose';
import { everywhere } from '../../core/builders.js';
import { cid } from '../../core/customId.js';
import { createLogger } from '../../core/logger.js';
import { formatDuration, parseDuration, timestamp } from '../../core/time.js';
import { components, slashCommand, type BotModuleDefinition } from '../../core/types.js';
import { ReminderModel, type ReminderRecord } from '../../database/models/index.js';
import { users } from '../../services/index.js';
import { button, divider, notice, panel, row, text, truncate, v2 } from '../../ui/components.js';
import { emoji } from '../../ui/emoji.js';
import { reply } from '../../ui/respond.js';

const log = createLogger('reminders');
const MAX_ACTIVE = 25;
const MAX_DELAY = 365 * 86_400_000;
const MIN_DELAY = 60_000;

type Reminder = ReminderRecord & { _id: Types.ObjectId };

function deliveryView(reminder: Reminder) {
  const id = reminder._id.toString();
  return panel({
    title: 'Reminder',
    emoji: 'reminder',
    description: `${reminder.content}\n-# Set ${timestamp(reminder.createdAt, 'R')}`,
  }).addActionRowComponents(
    row(
      button({ id: cid('rm', 'snooze', id, '10m'), label: '10 min', emoji: 'snooze' }),
      button({ id: cid('rm', 'snooze', id, '1h'), label: '1 hour', emoji: 'snooze' }),
      button({ id: cid('rm', 'snooze', id, '1d'), label: 'Tomorrow', emoji: 'snooze' }),
      button({ id: cid('rm', 'done', id), label: 'Done', emoji: 'done', style: ButtonStyle.Success }),
    ),
  );
}

async function deliver(client: Client, reminder: Reminder): Promise<void> {
  const prefs = await users.preferences(reminder.userId);
  const payload = v2(deliveryView(reminder));

  const sendToChannel = async () => {
    if (!reminder.channelId) return false;
    const channel = await client.channels.fetch(reminder.channelId).catch(() => null);
    if (!channel?.isSendable()) return false;
    await channel.send({ ...payload, components: [text(`<@${reminder.userId}>`), ...payload.components], allowedMentions: { users: [reminder.userId] } });
    return true;
  };
  const sendToDm = async () => {
    const user = await client.users.fetch(reminder.userId).catch(() => null);
    return user ? user.send(payload).then(() => true).catch(() => false) : false;
  };

  const ok = prefs.reminderDelivery === 'channel' ? (await sendToChannel()) || (await sendToDm()) : (await sendToDm()) || (await sendToChannel());
  if (!ok) log.warn(`Could not deliver reminder ${reminder._id} to ${reminder.userId}`);
}

/** Checks for due reminders every 15 seconds. */
export function startReminderScheduler(client: Client): void {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const due = await ReminderModel.find({ delivered: false, dueAt: { $lte: new Date() } }).sort({ dueAt: 1 }).limit(50).lean<Reminder[]>();
      for (const reminder of due) {
        // Claim it first so a reminder is never sent twice.
        const claimed = await ReminderModel.updateOne({ _id: reminder._id, delivered: false }, { $set: { delivered: true } });
        if (claimed.modifiedCount) await deliver(client, reminder).catch((e) => log.error('Delivery failed', e));
      }
    } catch (error) {
      log.error('Scheduler tick failed', error);
    } finally {
      running = false;
    }
  };
  setInterval(tick, 15_000).unref();
  void tick();
  log.info('Reminder scheduler started');
}

const remindCommand = slashCommand({
  module: 'reminders',
  data: everywhere(new SlashCommandBuilder().setName('remind').setDescription('Personal reminders'))
    .addSubcommand((s) =>
      s
        .setName('me')
        .setDescription('Set a reminder')
        .addStringOption((o) => o.setName('in').setDescription('When, e.g. 10m, 2h, 1d 6h').setRequired(true).setMaxLength(30))
        .addStringOption((o) => o.setName('about').setDescription('What to remind you about').setRequired(true).setMaxLength(500)),
    )
    .addSubcommand((s) => s.setName('list').setDescription('See your reminders'))
    .addSubcommand((s) =>
      s
        .setName('cancel')
        .setDescription('Cancel a reminder')
        .addStringOption((o) => o.setName('reminder').setDescription('Which one').setRequired(true).setAutocomplete(true)),
    ),
  autocomplete: async ({ interaction }) => {
    const list = await ReminderModel.find({ userId: interaction.user.id, delivered: false }).sort({ dueAt: 1 }).limit(25).lean<Reminder[]>();
    const query = interaction.options.getFocused().toLowerCase();
    await interaction.respond(
      list
        .filter((r) => r.content.toLowerCase().includes(query))
        .map((r) => ({ name: truncate(`${r.content} (in ${formatDuration(r.dueAt.getTime() - Date.now())})`, 100), value: r._id.toString() })),
    );
  },
  execute: async ({ interaction, accent, user }) => {
    const sub = interaction.options.getSubcommand();

    if (sub === 'me') {
      const delay = parseDuration(interaction.options.getString('in', true));
      if (!delay || delay < MIN_DELAY || delay > MAX_DELAY) {
        return reply(interaction, 'error', 'Use a time between **1 minute** and **1 year**, like `30m` or `2d`.');
      }
      const active = await ReminderModel.countDocuments({ userId: interaction.user.id, delivered: false });
      if (active >= MAX_ACTIVE) return reply(interaction, 'warning', `You can have up to **${MAX_ACTIVE}** reminders. Cancel one first.`);

      // Only remember the channel if Clanky can post there.
      const channelId = interaction.inCachedGuild() && interaction.channel?.isSendable() ? interaction.channelId : null;
      const dueAt = new Date(Date.now() + delay);
      await ReminderModel.create({
        userId: interaction.user.id,
        guildId: interaction.guildId,
        channelId,
        content: interaction.options.getString('about', true),
        dueAt,
      });
      const where = user.preferences.reminderDelivery === 'dm' || !channelId ? 'in your DMs' : 'in this channel';
      return reply(interaction, 'success', `Got it! I'll remind you ${timestamp(dueAt, 'R')} ${where}. ⏰`);
    }

    if (sub === 'list') {
      const list = await ReminderModel.find({ userId: interaction.user.id, delivered: false }).sort({ dueAt: 1 }).limit(MAX_ACTIVE).lean<Reminder[]>();
      const container = panel({
        title: 'Your reminders',
        emoji: 'reminder',
        description: list.length ? `You have **${list.length}** upcoming.` : 'No reminders yet. Try `/remind me`.',
        accent,
      });
      if (list.length) {
        container
          .addSeparatorComponents(divider())
          .addTextDisplayComponents(text(list.map((r) => `${emoji('clock')} ${timestamp(r.dueAt, 'R')} · ${truncate(r.content, 80)}`).join('\n')));
      }
      return interaction.reply(v2(container, { ephemeral: true }));
    }

    const id = interaction.options.getString('reminder', true);
    if (!Types.ObjectId.isValid(id)) return reply(interaction, 'error', "I couldn't find that reminder.");
    const removed = await ReminderModel.deleteOne({ _id: id, userId: interaction.user.id, delivered: false });
    return removed.deletedCount ? reply(interaction, 'success', 'Reminder cancelled.') : reply(interaction, 'error', "I couldn't find that reminder.");
  },
});

const reminderComponents = components({
  prefix: 'rm',
  module: 'reminders',
  button: async ({ interaction }, [action, id, delay]) => {
    if (!id || !Types.ObjectId.isValid(id)) return;
    const reminder = await ReminderModel.findById(id).lean<Reminder>();
    if (!reminder || reminder.userId !== interaction.user.id) return reply(interaction, 'info', 'This reminder is not yours.');

    if (action === 'done') {
      await ReminderModel.deleteOne({ _id: id });
      return interaction.update({ components: [notice('success', `Done: ${truncate(reminder.content, 200)}`)] });
    }
    const ms = parseDuration(delay ?? '10m') ?? 600_000;
    const dueAt = new Date(Date.now() + ms);
    await ReminderModel.updateOne({ _id: id }, { $set: { delivered: false, dueAt } });
    return interaction.update({ components: [notice('info', `Snoozed. I'll remind you again ${timestamp(dueAt, 'R')}.\n-# ${truncate(reminder.content, 200)}`)] });
  },
});

export const remindersModule: BotModuleDefinition = {
  commands: [remindCommand],
  components: [reminderComponents],
};
