import {
  CheckboxBuilder,
  LabelBuilder,
  ModalBuilder,
  PollLayoutType,
  RadioGroupBuilder,
  RadioGroupOptionBuilder,
  SlashCommandBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import { inServers } from '../../core/builders.js';
import { cid } from '../../core/customId.js';
import { guildComponents, guildSlashCommand, type BotModuleDefinition } from '../../core/types.js';
import { reply } from '../../ui/respond.js';

/** Uses Discord's native polls — results update live for everyone. */

const DURATIONS = [
  { label: '1 hour', value: 1 },
  { label: '4 hours', value: 4 },
  { label: '1 day', value: 24, default: true },
  { label: '3 days', value: 72 },
  { label: '1 week', value: 168 },
];

const pollCommand = guildSlashCommand({
  module: 'polls',
  cooldown: 30,
  data: inServers(new SlashCommandBuilder().setName('poll').setDescription('Start a poll in this channel')),
  execute: async ({ interaction }) => {
    await interaction.showModal(
      new ModalBuilder()
        .setCustomId(cid('poll', 'create'))
        .setTitle('New poll')
        .addLabelComponents(
          new LabelBuilder().setLabel('Question').setTextInputComponent(new TextInputBuilder().setCustomId('question').setStyle(TextInputStyle.Short).setMaxLength(300)),
          new LabelBuilder()
            .setLabel('Answers')
            .setDescription('One per line. 2 to 10 answers.')
            .setTextInputComponent(new TextInputBuilder().setCustomId('answers').setStyle(TextInputStyle.Paragraph).setMaxLength(600).setPlaceholder('Pizza\nTacos\nSushi')),
          new LabelBuilder().setLabel('How long?').setRadioGroupComponent(
            new RadioGroupBuilder()
              .setCustomId('duration')
              .setRequired(true)
              .setOptions(DURATIONS.map((d) => new RadioGroupOptionBuilder().setLabel(d.label).setValue(String(d.value)).setDefault(Boolean(d.default)))),
          ),
          new LabelBuilder().setLabel('Allow picking more than one answer').setCheckboxComponent(new CheckboxBuilder().setCustomId('multi')),
        ),
    );
  },
});

const pollComponents = guildComponents({
  prefix: 'poll',
  module: 'polls',
  modal: async ({ interaction }) => {
    const answers = [
      ...new Set(
        interaction.fields
          .getTextInputValue('answers')
          .split('\n')
          .map((a) => a.trim())
          .filter(Boolean),
      ),
    ];
    if (answers.length < 2 || answers.length > 10) return reply(interaction, 'error', 'A poll needs **2 to 10** answers, one per line.');
    if (answers.some((a) => a.length > 55)) return reply(interaction, 'error', 'Each answer can be up to **55** characters.');

    await interaction.reply({
      poll: {
        question: { text: interaction.fields.getTextInputValue('question').trim() },
        answers: answers.map((text) => ({ text })),
        duration: Number(interaction.fields.getRadioGroup('duration', true)) || 24,
        allowMultiselect: interaction.fields.getCheckbox('multi'),
        layoutType: PollLayoutType.Default,
      },
    });
  },
});

export const pollsModule: BotModuleDefinition = {
  commands: [pollCommand],
  components: [pollComponents],
};
