import { ChannelType, LabelBuilder, ModalBuilder, StringSelectMenuBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import { channelMention, roleMentions, row, status, button } from '../../../ui/components.js';
import { emoji } from '../../../ui/emoji.js';
import { reply } from '../../../ui/respond.js';
import { publishTicketPanel, ticketPanelPayload } from '../../tickets/panels.js';
import {
  actionButton,
  channelPicker,
  finishPage,
  pageHeader,
  rolePicker,
  save,
  selectedIds,
  sid,
  toggleButton,
  type SettingsPage,
} from '../kit.js';

const idPart = () => Math.random().toString(36).slice(2, 8);
const newPanelId = () => `panel-${Date.now().toString(36)}-${idPart()}`;
const newQuestionId = () => `q-${Date.now().toString(36)}-${idPart()}`;
const newCategoryId = () => `cat-${Date.now().toString(36)}-${idPart()}`;

function panelEditModal(panel: { id: string; title: string; description: string }) {
  return new ModalBuilder()
    .setCustomId(sid('tickets', 'panel-edit-save', panel.id))
    .setTitle('Edit ticket panel')
    .addLabelComponents(
      new LabelBuilder().setLabel('Title').setTextInputComponent(new TextInputBuilder().setCustomId('title').setStyle(TextInputStyle.Short).setMaxLength(100).setValue(panel.title)),
      new LabelBuilder().setLabel('Description').setTextInputComponent(new TextInputBuilder().setCustomId('description').setStyle(TextInputStyle.Paragraph).setMaxLength(1000).setValue(panel.description)),
    );
}

function panelCreateModal() {
  return new ModalBuilder()
    .setCustomId(sid('tickets', 'panel-add-save'))
    .setTitle('Create ticket panel')
    .addLabelComponents(
      new LabelBuilder().setLabel('Title').setTextInputComponent(new TextInputBuilder().setCustomId('title').setStyle(TextInputStyle.Short).setMaxLength(100)),
      new LabelBuilder().setLabel('Description').setTextInputComponent(new TextInputBuilder().setCustomId('description').setStyle(TextInputStyle.Paragraph).setMaxLength(1000)),
    );
}

function questionModal(panelId: string, question?: { id: string; label: string; description: string; placeholder: string; style: 'short' | 'paragraph'; required: boolean }) {
  const edit = Boolean(question);
  const style = new StringSelectMenuBuilder().setCustomId('style').setPlaceholder('Choose answer style').addOptions(
    { label: 'Short answer', value: 'short', default: (question?.style ?? 'paragraph') === 'short' },
    { label: 'Paragraph', value: 'paragraph', default: (question?.style ?? 'paragraph') === 'paragraph' },
  );
  const required = new StringSelectMenuBuilder().setCustomId('required').setPlaceholder('Is an answer required?').addOptions(
    { label: 'Required', value: 'true', default: question?.required ?? true },
    { label: 'Optional', value: 'false', default: question ? !question.required : false },
  );
  const modal = new ModalBuilder()
    .setCustomId(sid('tickets', edit ? 'question-edit-save' : 'question-add-save', panelId, question?.id ?? ''))
    .setTitle(edit ? 'Edit intake question' : 'Add intake question')
    .addLabelComponents(
      new LabelBuilder().setLabel('Question').setTextInputComponent(new TextInputBuilder().setCustomId('label').setStyle(TextInputStyle.Short).setMaxLength(45).setValue(question?.label ?? '')),
      new LabelBuilder().setLabel('Helper text').setTextInputComponent(new TextInputBuilder().setCustomId('description').setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(100).setValue(question?.description ?? '')),
      new LabelBuilder().setLabel('Placeholder').setTextInputComponent(new TextInputBuilder().setCustomId('placeholder').setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(100).setValue(question?.placeholder ?? '')),
      new LabelBuilder().setLabel('Answer style').setStringSelectMenuComponent(style),
      new LabelBuilder().setLabel('Required').setStringSelectMenuComponent(required),
    );
  return modal;
}

export const ticketsPage: SettingsPage = {
  id: 'tickets',
  render(env, state = []) {
    const s = env.settings.tickets;
    if (state[0] === 'manage') {
      const panel = s.panels.find((item) => item.id === state[1]) ?? s.panels[0]!;
      const questionOptions = panel.questions.map((q) => ({ label: q.label.slice(0, 100), value: q.id, description: `${q.style === 'short' ? 'Short' : 'Paragraph'} · ${q.required ? 'required' : 'optional'}` }));
      const container = pageHeader(env, 'tickets', `**Panel** · ${panel.title}\n**Form** · ${panel.questions.length} question${panel.questions.length === 1 ? '' : 's'}${s.categories.length ? ' + topic selector' : ''}\n**Routing overrides** · ${panel.parentId || panel.logChannelId || panel.staffRoleIds !== null ? 'Custom' : 'Using server defaults'}`)
        .addActionRowComponents(row(actionButton('tickets', 'back', 'Back to ticket settings', 'back')))
        .addActionRowComponents(
          row(
            new StringSelectMenuBuilder()
              .setCustomId(sid('tickets', 'select-panel'))
              .setPlaceholder('Select a panel')
              .addOptions(s.panels.map((p) => ({ label: p.title, value: p.id, description: `${p.questions.length} intake question${p.questions.length === 1 ? '' : 's'}` }))),
          ),
        )
        .addActionRowComponents(
          row(
            actionButton('tickets', 'panel-add', 'Add panel', 'add'),
            button({ id: sid('tickets', 'panel-edit', panel.id), label: 'Edit title / text', emoji: 'edit' }),
            button({ id: sid('tickets', 'panel-remove', panel.id), label: 'Remove', emoji: 'delete', disabled: s.panels.length <= 1 }),
            button({ id: sid('tickets', 'question-add', panel.id), label: 'Add question', emoji: 'add' }),
            button({ id: sid('tickets', 'preview', panel.id), label: 'Preview', emoji: 'ticket' }),
          ),
        )
        .addActionRowComponents(channelPicker(env, 'tickets', 'route-parent', { current: panel.parentId, placeholder: `Default: ${channelMention(s.parentId)}`, types: [ChannelType.GuildCategory] }, [panel.id]))
        .addActionRowComponents(channelPicker(env, 'tickets', 'route-log', { current: panel.logChannelId, placeholder: `Default: ${channelMention(s.logChannelId)}` }, [panel.id]))
        .addActionRowComponents(rolePicker(env, 'tickets', 'route-staff', { current: panel.staffRoleIds ?? s.staffRoleIds, placeholder: panel.staffRoleIds === null ? 'Staff roles (server default)' : 'Panel staff roles', max: 10 }, [panel.id]))
        .addActionRowComponents(row(button({ id: sid('tickets', 'route-reset', panel.id), label: 'Use server routing defaults', emoji: 'refresh' })));
      if (questionOptions.length) {
        container.addActionRowComponents(row(new StringSelectMenuBuilder().setCustomId(sid('tickets', 'question-edit', panel.id)).setPlaceholder('Choose a question to edit').addOptions(questionOptions)));
        container.addActionRowComponents(row(new StringSelectMenuBuilder().setCustomId(sid('tickets', 'question-remove', panel.id)).setPlaceholder('Choose a question to remove').addOptions(questionOptions)));
        container.addActionRowComponents(row(new StringSelectMenuBuilder().setCustomId(sid('tickets', 'question-maxlen', panel.id)).setPlaceholder('Set a question’s maximum answer length').addOptions(
          panel.questions.flatMap((question) => [100, 250, 500, 1000].map((maxLength) => ({
            label: `${question.label.slice(0, 70)} · ${maxLength} chars`.slice(0, 100),
            value: `${question.id}:${maxLength}`,
            description: question.maxLength === maxLength ? 'Current maximum length' : `Current: ${question.maxLength} characters`,
          }))),
        )));
      }
      container.addActionRowComponents(row(button({ id: sid('tickets', 'post', panel.id), label: 'Post / update this panel', emoji: 'rocket' })));
      return finishPage(container, 'tickets');
    }

    const summary = [
      `**Status** · ${status(s.enabled)}`,
      `${emoji('channel')} **Default ticket category** · ${channelMention(s.parentId)}`,
      `${emoji('transcript')} **Default transcripts** · ${channelMention(s.logChannelId)}`,
      `${emoji('shield')} **Default staff** · ${roleMentions(s.staffRoleIds)}`,
      `${emoji('list')} **Topics** · ${s.categories.length ? s.categories.map((c) => c.label).join(', ') : '`None`'}`,
      `${emoji('ticket')} **Panels** · ${s.panels.length}/3`,
      `${emoji('user')} **Open tickets per member** · ${s.maxOpenPerUser}`,
    ].join('\n');

    const container = pageHeader(env, 'tickets', summary)
      .addActionRowComponents(row(toggleButton('tickets', 'toggle', 'Module', s.enabled), actionButton('tickets', 'manage', 'Manage panels and forms', 'edit'), actionButton('tickets', 'add-cat', 'Add topic', 'add')))
      .addActionRowComponents(channelPicker(env, 'tickets', 'parent', { current: s.parentId, placeholder: 'Default ticket category', types: [ChannelType.GuildCategory] }))
      .addActionRowComponents(channelPicker(env, 'tickets', 'log', { current: s.logChannelId, placeholder: 'Default transcript channel' }))
      .addActionRowComponents(rolePicker(env, 'tickets', 'staff', { current: s.staffRoleIds, placeholder: 'Default staff roles', max: 10 }));

    if (s.categories.length) {
      container.addActionRowComponents(
        row(
          new StringSelectMenuBuilder()
            .setCustomId(sid('tickets', 'remove-cat'))
            .setPlaceholder('Remove a topic')
            .addOptions(s.categories.map((c) => ({ label: c.label, value: c.id, description: c.description || undefined }))),
        ),
      );
    }
    return finishPage(container, 'tickets');
  },

  async handle(ctx, action, args) {
    const { interaction } = ctx;
    const s = ctx.guild.settings.tickets;
    const panelId = args[0];
    const panel = s.panels.find((item) => item.id === panelId);
    const manage = (id = panelId ?? s.panels[0]!.id) => ({ state: ['manage', id] });
    switch (action) {
      case 'toggle':
        await save(ctx, (d) => void (d.tickets.enabled = !d.tickets.enabled));
        return 'render';
      case 'parent':
        await save(ctx, (d) => void (d.tickets.parentId = selectedIds(interaction)[0] ?? null));
        return 'render';
      case 'log':
        await save(ctx, (d) => void (d.tickets.logChannelId = selectedIds(interaction)[0] ?? null));
        return 'render';
      case 'staff':
        await save(ctx, (d) => void (d.tickets.staffRoleIds = selectedIds(interaction)));
        return 'render';
      case 'manage':
        return manage();
      case 'back':
        return 'render';
      case 'select-panel':
        return manage(selectedIds(interaction)[0] ?? s.panels[0]!.id);
      case 'route-parent':
        if (!panel) return manage();
        await save(ctx, (d) => void (d.tickets.panels.find((p) => p.id === panel.id)!.parentId = selectedIds(interaction)[0] ?? null));
        return manage(panel.id);
      case 'route-log':
        if (!panel) return manage();
        await save(ctx, (d) => void (d.tickets.panels.find((p) => p.id === panel.id)!.logChannelId = selectedIds(interaction)[0] ?? null));
        return manage(panel.id);
      case 'route-staff':
        if (!panel) return manage();
        await save(ctx, (d) => void (d.tickets.panels.find((p) => p.id === panel.id)!.staffRoleIds = selectedIds(interaction)));
        return manage(panel.id);
      case 'route-reset':
        if (panel) await save(ctx, (d) => {
          const p = d.tickets.panels.find((item) => item.id === panel.id)!;
          p.parentId = null;
          p.logChannelId = null;
          p.staffRoleIds = null;
        });
        return manage();
      case 'panel-add':
        if (s.panels.length >= 3) {
          await reply(interaction, 'warning', 'You can have at most **3** ticket panels.');
          return manage();
        }
        if (!interaction.isButton()) return manage();
        await interaction.showModal(panelCreateModal());
        return 'done';
      case 'panel-add-save': {
        if (!interaction.isModalSubmit()) return 'done';
        const title = interaction.fields.getTextInputValue('title').trim();
        const description = interaction.fields.getTextInputValue('description').trim();
        if (!title || !description) {
          await reply(interaction, 'error', 'A panel title and description are both required.');
          return 'done';
        }
        const id = newPanelId();
        await save(ctx, (d) => d.tickets.panels.push({ id, title, description, questions: [{ id: newQuestionId(), label: 'How can we help?', description: '', placeholder: '', style: 'paragraph', required: true, minLength: 0, maxLength: 1000 }], parentId: null, logChannelId: null, staffRoleIds: null }));
        return manage(id);
      }
      case 'panel-edit':
        if (!panel || !interaction.isButton()) return manage();
        await interaction.showModal(panelEditModal(panel));
        return 'done';
      case 'panel-edit-save': {
        const selected = s.panels.find((item) => item.id === panelId);
        if (!selected || !interaction.isModalSubmit()) return manage();
        const title = interaction.fields.getTextInputValue('title').trim();
        const description = interaction.fields.getTextInputValue('description').trim();
        if (!title || !description) {
          await reply(interaction, 'error', 'A panel title and description are both required.');
          return 'done';
        }
        await save(ctx, (d) => {
          const p = d.tickets.panels.find((item) => item.id === selected.id)!;
          p.title = title;
          p.description = description;
        });
        return manage(selected.id);
      }
      case 'panel-remove':
        if (s.panels.length <= 1) {
          await reply(interaction, 'warning', 'Keep at least one ticket panel.');
          return manage();
        }
        if (panel) await save(ctx, (d) => void (d.tickets.panels = d.tickets.panels.filter((item) => item.id !== panel.id)));
        return manage(s.panels.find((item) => item.id !== panel?.id)?.id);
      case 'question-add':
        if (!panel || !interaction.isButton()) return manage();
        if (panel.questions.length + (s.categories.length ? 1 : 0) >= 5) {
          await reply(interaction, 'warning', 'Discord allows up to five modal fields. Remove a question or topic selector before adding another.');
          return manage(panel.id);
        }
        await interaction.showModal(questionModal(panel.id));
        return 'done';
      case 'question-add-save': {
        const selected = s.panels.find((item) => item.id === panelId);
        if (!selected || !interaction.isModalSubmit()) return manage();
        if (selected.questions.length + (s.categories.length ? 1 : 0) >= 5) {
          await reply(interaction, 'warning', 'This form has reached Discord’s five-field limit.');
          return 'done';
        }
        const label = interaction.fields.getTextInputValue('label').trim();
        if (!label) {
          await reply(interaction, 'error', 'Question text is required.');
          return 'done';
        }
        const description = interaction.fields.getTextInputValue('description').trim();
        const placeholder = interaction.fields.getTextInputValue('placeholder').trim();
        const style = interaction.fields.getStringSelectValues('style')[0] === 'short' ? 'short' : 'paragraph';
        const required = interaction.fields.getStringSelectValues('required')[0] !== 'false';
        await save(ctx, (d) => d.tickets.panels.find((item) => item.id === selected.id)!.questions.push({ id: newQuestionId(), label, description, placeholder, style, required, minLength: 0, maxLength: 1000 }));
        return manage(selected.id);
      }
      case 'question-edit': {
        const selected = panel?.questions.find((q) => q.id === selectedIds(interaction)[0]);
        if (!panel || !selected || !interaction.isStringSelectMenu()) return manage();
        await interaction.showModal(questionModal(panel.id, selected));
        return 'done';
      }
      case 'question-edit-save': {
        const selected = s.panels.find((item) => item.id === panelId);
        const question = selected?.questions.find((item) => item.id === args[1]);
        if (!selected || !question || !interaction.isModalSubmit()) return manage();
        const label = interaction.fields.getTextInputValue('label').trim();
        if (!label) {
          await reply(interaction, 'error', 'Question text is required.');
          return 'done';
        }
        await save(ctx, (d) => {
          const q = d.tickets.panels.find((item) => item.id === selected.id)!.questions.find((item) => item.id === question.id)!;
          q.label = label;
          q.description = interaction.fields.getTextInputValue('description').trim();
          q.placeholder = interaction.fields.getTextInputValue('placeholder').trim();
          q.style = interaction.fields.getStringSelectValues('style')[0] === 'short' ? 'short' : 'paragraph';
          q.required = interaction.fields.getStringSelectValues('required')[0] !== 'false';
        });
        return manage(selected.id);
      }
      case 'question-remove': {
        const questionId = selectedIds(interaction)[0];
        if (panel && questionId) await save(ctx, (d) => {
          const p = d.tickets.panels.find((item) => item.id === panel.id)!;
          p.questions = p.questions.filter((question) => question.id !== questionId);
        });
        return manage(panel?.id);
      }
      case 'question-maxlen': {
        if (!panel) return manage();
        const [questionId, rawLength] = selectedIds(interaction)[0]?.split(':') ?? [];
        const maxLength = Number(rawLength);
        if (!questionId || ![100, 250, 500, 1000].includes(maxLength)) return manage(panel.id);
        await save(ctx, (d) => {
          const question = d.tickets.panels.find((item) => item.id === panel.id)!.questions.find((item) => item.id === questionId);
          if (question) {
            question.maxLength = maxLength;
            question.minLength = Math.min(question.minLength, maxLength);
          }
        });
        return manage(panel.id);
      }
      case 'preview':
        if (panel) {
          await interaction.reply(await ticketPanelPayload(ctx.guild.settings, panel, true));
          return 'done';
        }
        return manage();
      case 'post': {
        if (!panel) return manage();
        const channel = interaction.channel;
        if (!channel?.isSendable() || channel.type !== ChannelType.GuildText) {
          await reply(interaction, 'error', 'Open settings in a text channel where Clanky can post.');
          return manage(panel.id);
        }
        const outcome = await publishTicketPanel(channel, ctx.guild.settings, panel);
        return { warn: `Ticket panel ${outcome} in this channel.`, state: ['manage', panel.id] };
      }
      case 'add-cat': {
        if (!interaction.isButton()) return 'done';
        if (s.categories.length >= 10) {
          await reply(interaction, 'warning', 'You can have up to **10** topics. Remove one first.');
          return 'done';
        }
        if (!s.categories.length && s.panels.some((p) => p.questions.length >= 5)) {
          await reply(interaction, 'warning', 'A panel already uses all five modal fields. Remove a question before adding a topic selector.');
          return 'done';
        }
        await interaction.showModal(
          new ModalBuilder()
            .setCustomId(sid('tickets', 'add-cat-save'))
            .setTitle('New ticket topic')
            .addLabelComponents(
              new LabelBuilder().setLabel('Name').setDescription('e.g. Support, Report a member, Billing').setTextInputComponent(new TextInputBuilder().setCustomId('label').setStyle(TextInputStyle.Short).setMaxLength(50)),
              new LabelBuilder().setLabel('Short description').setTextInputComponent(new TextInputBuilder().setCustomId('description').setStyle(TextInputStyle.Short).setMaxLength(100).setRequired(false)),
            ),
        );
        return 'done';
      }
      case 'add-cat-save': {
        if (!interaction.isModalSubmit()) return 'done';
        const label = interaction.fields.getTextInputValue('label').trim();
        const description = interaction.fields.getTextInputValue('description').trim();
        if (!label) {
          await reply(interaction, 'error', 'A topic name is required.');
          return 'done';
        }
        await save(ctx, (d) => void d.tickets.categories.push({ id: newCategoryId(), label, description }));
        return 'render';
      }
      case 'remove-cat': {
        const id = selectedIds(interaction)[0];
        await save(ctx, (d) => {
          d.tickets.categories = d.tickets.categories.filter((c) => c.id !== id);
          if (!d.tickets.categories.length) {
            for (const p of d.tickets.panels) {
              if (!p.questions.length) p.questions.push({ id: newQuestionId(), label: 'How can we help?', description: '', placeholder: '', style: 'paragraph', required: true, minLength: 0, maxLength: 1000 });
            }
          }
        });
        return 'render';
      }
    }
    return 'done';
  },
};
