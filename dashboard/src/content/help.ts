export type HelpStep = { title: string; body: string };
export type HelpBlock =
  | { type: 'paragraph'; text: string }
  | { type: 'steps'; title?: string; items: HelpStep[] }
  | { type: 'list'; title?: string; items: string[] }
  | { type: 'callout'; tone: 'tip' | 'note' | 'important'; title: string; body: string };
export type HelpSection = { id: string; title: string; blocks: HelpBlock[] };
export type HelpArticle = {
  slug: string;
  title: string;
  summary: string;
  category: string;
  icon: string;
  readTime: number;
  tags: string[];
  sections: HelpSection[];
};

export const HELP_CATEGORIES = [
  { id: 'start', title: 'Getting started', description: 'Add Clanky and take your first steps.' },
  { id: 'dashboard', title: 'Using the dashboard', description: 'Find your way around and manage settings.' },
  { id: 'community', title: 'Community tools', description: 'Welcome, tickets, suggestions, and roles.' },
  { id: 'safety', title: 'Safety & moderation', description: 'Keep your server safer and well organized.' },
  { id: 'engagement', title: 'Engagement & fun', description: 'XP, Salvage, reminders, and polls.' },
  { id: 'account', title: 'Your account', description: 'Preferences, privacy, and common fixes.' },
] as const;

export const HELP_ARTICLES: HelpArticle[] = [
  {
    slug: 'first-steps', title: 'Start using Clanky', summary: 'A short guided setup for adding Clanky, choosing a server, and switching on your first feature.', category: 'start', icon: 'Sparkles', readTime: 3, tags: ['begin', 'setup', 'invite', 'install', 'first time', 'new server'],
    sections: [
      { id: 'add-clanky', title: 'Add Clanky to your server', blocks: [
        { type: 'paragraph', text: 'Clanky works inside Discord. Add it to a server where you have permission to manage apps, then configure only the tools your community wants to use.' },
        { type: 'steps', items: [
          { title: 'Choose Add to Discord', body: 'Use the Add to Discord button on Clanky’s home page and select the server you manage.' },
          { title: 'Review the requested access', body: 'Approve the Discord permissions shown. Clanky needs access to the channels and actions you want it to handle.' },
          { title: 'Open the dashboard or Discord settings', body: 'To use the website, sign in with Discord and choose your server. Or run /settings in Discord to configure Clanky there.' },
        ] },
        { type: 'callout', tone: 'important', title: 'Choose permissions carefully', body: 'Discord may let you invite a bot without every permission. If a feature cannot work, the dashboard’s server overview can show which permissions are missing.' },
      ] },
      { id: 'turn-on-feature', title: 'Turn on a feature', blocks: [
        { type: 'steps', items: [
          { title: 'Open General settings', body: 'Choose your server, then select General from the server menu.' },
          { title: 'Switch on a module', body: 'Use the module switch for features such as Welcome, Tickets, Suggestions, Leveling, or AutoMod.' },
          { title: 'Choose its channels and roles', body: 'Open the module’s page and select where messages should go and who should help manage it.' },
          { title: 'Test it in Discord', body: 'Try the feature yourself or ask a moderator to confirm that it behaves as expected.' },
        ] },
        { type: 'callout', tone: 'tip', title: 'Start with one feature', body: 'Set up its destination channel and permissions first. Then add more tools when the first one is working well.' },
      ] },
      { id: 'what-next', title: 'Where to go next', blocks: [
        { type: 'list', items: ['Read the dashboard tour to find settings, history, and ticket records.', 'Use /help in Discord to browse Clanky’s commands by feature.', 'Ask a server owner to check channel access if a feature is not appearing.'] },
      ] },
    ],
  },
  {
    slug: 'dashboard-tour', title: 'Find your way around the dashboard', summary: 'Sign in, select a server, change settings, and see what has happened recently.', category: 'dashboard', icon: 'LayoutDashboard', readTime: 3, tags: ['login', 'server', 'settings', 'overview', 'history', 'save'],
    sections: [
      { id: 'sign-in', title: 'Sign in and choose a server', blocks: [
        { type: 'steps', items: [
          { title: 'Choose Log in', body: 'Sign in with your Discord account. Clanky only lists servers you can manage through Discord.' },
          { title: 'Pick a server', body: 'The server list separates servers where Clanky is already present from servers where you can add it.' },
          { title: 'Refresh after inviting', body: 'If you have just added Clanky, choose Refresh so the server list updates.' },
        ] },
      ] },
      { id: 'server-pages', title: 'Use the server menu', blocks: [
        { type: 'paragraph', text: 'Inside a server, the side menu takes you to the overview, each settings area, Change history, and Ticket transcripts. On a phone, the menu becomes a horizontally scrollable row.' },
        { type: 'list', title: 'What you’ll find', items: ['Overview: recent cases, open tickets, suggestions waiting for review, and member activity.', 'Settings: configure General, Moderation, AutoMod, Logging, Welcome, Tickets, Suggestions, Leveling, and Games.', 'Change history: see recent setting updates and who made them.', 'Ticket transcripts: review closed conversations available to your account.'] },
      ] },
      { id: 'save-settings', title: 'Save and reset settings', blocks: [
        { type: 'paragraph', text: 'Some switches take effect as soon as you change them. Other pages collect edits until you choose Save changes. If you have unsaved edits, the page shows a save bar with Save and Reset options.' },
        { type: 'callout', tone: 'tip', title: 'Before leaving a settings page', body: 'Look for an unsaved-changes bar. Choose Save to keep your edits, or Reset to discard them and return to the saved values.' },
      ] },
      { id: 'permission-help', title: 'If a server or setting is missing', blocks: [
        { type: 'list', items: ['Check that you signed in with the Discord account that manages the server.', 'Use Refresh on the server list after changing server access or inviting Clanky.', 'Ask the server owner to confirm your role can manage server settings.', 'Check the dashboard overview for a list of permissions Clanky still needs.'] },
      ] },
    ],
  },
  {
    slug: 'commands-and-help', title: 'Use Clanky’s Discord commands', summary: 'Find commands, open interactive settings, and understand who can use admin actions.', category: 'start', icon: 'MessageSquareText', readTime: 3, tags: ['slash commands', 'help', 'commands', 'permissions', 'settings', 'about', 'ping'],
    sections: [
      { id: 'slash', title: 'Start with slash commands', blocks: [
        { type: 'paragraph', text: 'Clanky uses Discord slash commands. In a message box, type / and select a Clanky command from Discord’s menu. Clanky does not use text prefixes such as ! or .' },
        { type: 'steps', items: [
          { title: 'Browse everything', body: 'Run /help and choose a feature to see the commands it provides.' },
          { title: 'Check a command’s options', body: 'Select a command from Discord’s menu to see the information it asks you to provide.' },
          { title: 'Open server setup', body: 'Run /settings to open the interactive server settings menu. Most controls are limited to members with Manage Server.' },
        ] },
      ] },
      { id: 'quick-commands', title: 'Useful first commands', blocks: [
        { type: 'list', items: ['/help — browse Clanky’s commands by feature.', '/about — see Clanky’s status and what is new.', '/ping — check whether Clanky is responding.', '/preferences — adjust your personal Clanky settings.', '/settings — configure features for a server you manage.'] },
      ] },
      { id: 'permissions', title: 'Why a command might be unavailable', blocks: [
        { type: 'paragraph', text: 'Discord controls who can use commands. Server owners can change command access in Server Settings → Integrations → Clanky. Clanky also checks the permissions needed for each action, such as Manage Messages for message cleanup.' },
        { type: 'callout', tone: 'note', title: 'Commands may take a moment to appear', body: 'After Clanky has been added to a server, give Discord a short moment to refresh its command list. If commands are still missing, check that Clanky is installed in that server and that your account can use the command.' },
      ] },
    ],
  },
  {
    slug: 'moderation-and-reports', title: 'Moderation and message reports', summary: 'Take moderation actions, keep case history, and let members report messages.', category: 'safety', icon: 'Shield', readTime: 4, tags: ['warn', 'timeout', 'kick', 'ban', 'purge', 'cases', 'report', 'staff', 'mod log'],
    sections: [
      { id: 'moderation-actions', title: 'Take a moderation action', blocks: [
        { type: 'paragraph', text: 'Clanky provides /warn, /timeout, /untimeout, /kick, /ban, /unban, and /purge. Discord checks your permissions and Clanky’s role position before an action can go through.' },
        { type: 'steps', items: [
          { title: 'Choose the right command', body: 'Select the member and action. For a timeout, choose a duration; for a purge, specify how many recent messages to remove.' },
          { title: 'Add a clear reason', body: 'Give a brief reason so other moderators understand what happened. Your server may require a reason.' },
          { title: 'Review the result', body: 'Clanky creates a numbered case and, when configured, posts it to the moderation log. If enabled, it also tries to message the affected member.' },
          { title: 'Find the case later', body: 'Use /cases view or /cases user to look up moderation history.' },
        ] },
      ] },
      { id: 'report', title: 'Let members report a message', blocks: [
        { type: 'steps', items: [
          { title: 'Set a reports channel', body: 'A server manager opens /settings moderation and chooses the channel for reports.' },
          { title: 'Report from Discord', body: 'A member right-clicks a message, chooses Apps → Report message, then selects a reason and optionally adds details.' },
          { title: 'Review the report', body: 'Moderators with the required permission can dismiss the report, remove the message, or apply the available timeout action.' },
        ] },
      ] },
      { id: 'permissions', title: 'If an action fails', blocks: [
        { type: 'list', items: ['Your Discord role needs the matching permission for the action.', 'Clanky’s role must be higher than the member’s role for role-sensitive actions.', 'Clanky needs access to the affected channel for message cleanup.', 'Direct messages can be blocked by a member’s privacy settings, so delivery is not guaranteed.'] },
      ] },
    ],
  },
  {
    slug: 'automod', title: 'Set up AutoMod', summary: 'Use Discord’s built-in protections for invites, spam, mention bursts, and blocked words.', category: 'safety', icon: 'Bot', readTime: 3, tags: ['automod', 'spam', 'blocked words', 'keyword', 'invite', 'mentions', 'alert'],
    sections: [
      { id: 'enable', title: 'Turn on a protection', blocks: [
        { type: 'steps', items: [
          { title: 'Open AutoMod', body: 'Choose your server in the dashboard or open /settings automod in Discord.' },
          { title: 'Enable the rule types you need', body: 'Clanky can manage invite-link, spam, mention-spam, and keyword protections using Discord AutoMod.' },
          { title: 'Set words and limits', body: 'For keyword rules, add blocked words or patterns. Choose how many mentions should count as a burst.' },
          { title: 'Choose an alert channel', body: 'Optionally pick a channel where moderators can see AutoMod alerts.' },
        ] },
        { type: 'callout', tone: 'important', title: 'Discord permission required', body: 'Clanky needs Manage Server permission to create or update Discord AutoMod rules. Discord applies these rules even while Clanky is offline.' },
      ] },
      { id: 'keyword-tips', title: 'Keep blocked-word rules useful', blocks: [
        { type: 'list', items: ['Start with a short list and review how it affects normal conversation.', 'Use the on-screen guidance when adding a wildcard or pattern.', 'If a rule is too strict, edit or switch off that specific protection rather than disabling every rule.'] },
      ] },
    ],
  },
  {
    slug: 'welcome-messages', title: 'Welcome and leave messages', summary: 'Create separate join and leave messages, choose a format, and customize member cards.', category: 'community', icon: 'PartyPopper', readTime: 4, tags: ['welcome', 'join', 'leave', 'greeting', 'member card', 'image', 'auto role', 'screening', 'placeholders'],
    sections: [
      { id: 'set-up', title: 'Set up a join or leave message', blocks: [
        { type: 'steps', items: [
          { title: 'Open Welcome settings', body: 'Choose your server, then select Welcome. Join and Leave have separate settings.' },
          { title: 'Choose a destination', body: 'Pick the channel for each event. If you do not choose a separate leave channel, the join channel is used.' },
          { title: 'Choose the message style', body: 'Use a container message, plain text, text with an image, or an image-only card.' },
          { title: 'Edit and preview', body: 'Change the message and image options, then check the preview before saving.' },
        ] },
      ] },
      { id: 'customize-card', title: 'Customize the member card', blocks: [
        { type: 'list', items: ['Choose Celebration, Minimal, or Soft artwork.', 'Upload a background image if you want a custom look.', 'Show or hide the avatar, server name, and member count.', 'Choose whether the welcome message mentions the new member or includes bots.'] },
      ] },
      { id: 'roles-screening', title: 'Give new members roles', blocks: [
        { type: 'paragraph', text: 'You can assign up to five automatic roles when a member joins. Clanky’s own role must be above every role it assigns. If your server uses membership screening, enable the wait option to send the greeting and assign roles after the member passes screening.' },
        { type: 'callout', tone: 'tip', title: 'Available message placeholders', body: '{user}, {username}, {displayname}, {server}, and {count} can be used in your message text.' },
      ] },
    ],
  },
  {
    slug: 'tickets', title: 'Create and manage support tickets', summary: 'Publish a ticket panel, route requests to the right staff, and keep a transcript when a ticket closes.', category: 'community', icon: 'Ticket', readTime: 4, tags: ['ticket', 'support', 'panel', 'transcript', 'close', 'staff', 'form', 'questions', 'attachments'],
    sections: [
      { id: 'configure', title: 'Configure your ticket desk', blocks: [
        { type: 'steps', items: [
          { title: 'Open Tickets settings', body: 'Enable the feature and choose a category for private ticket channels.' },
          { title: 'Choose staff and transcript destinations', body: 'Pick the staff roles that can see tickets and the channel where transcripts or ticket updates should go.' },
          { title: 'Create a panel', body: 'Add a panel with a title, description, optional image, topics, and questions for members to answer.' },
          { title: 'Publish or update it', body: 'Publish the panel in a channel. If you edit a panel later, use its update option to refresh the live message.' },
        ] },
      ] },
      { id: 'member-flow', title: 'What members see', blocks: [
        { type: 'steps', items: [
          { title: 'Open a ticket', body: 'A member chooses Open ticket on the published panel and selects a topic or answers the form if offered.' },
          { title: 'Talk privately with staff', body: 'Clanky creates a private channel for the member and the configured team.' },
          { title: 'Close the conversation', body: 'The ticket owner or staff closes it from the channel controls or with /ticket close.' },
          { title: 'Review its record', body: 'Clanky creates a transcript when it can access the conversation. Closed ticket records and transcripts can be reviewed from the dashboard.' },
        ] },
      ] },
      { id: 'transcript-retention', title: 'Transcripts and retention', blocks: [
        { type: 'paragraph', text: 'Choose how long dashboard transcripts are retained: 30, 90, 180, or 365 days, or keep them forever. A transcript may include messages and archived attachments. Keep the transcript channel and staff access limited to people who should see support conversations.' },
        { type: 'callout', tone: 'important', title: 'A failed transcript keeps the ticket open', body: 'If Clanky cannot safely read or archive a ticket, it leaves the channel open so staff can fix access or retry the close.' },
      ] },
    ],
  },
  {
    slug: 'suggestions', title: 'Collect and review suggestions', summary: 'Let members submit ideas, vote, and follow review decisions in Discord or the dashboard.', category: 'community', icon: 'Lightbulb', readTime: 4, tags: ['suggestion', 'ideas', 'vote', 'anonymous', 'category', 'review', 'queue', 'digest'],
    sections: [
      { id: 'configure', title: 'Set up the suggestion box', blocks: [
        { type: 'steps', items: [
          { title: 'Choose a suggestions channel', body: 'Enable Suggestions and select the channel where new ideas should appear.' },
          { title: 'Choose who reviews ideas', body: 'Select reviewer roles. Server managers can also review suggestions.' },
          { title: 'Set privacy and limits', body: 'Choose whether submissions are anonymous by default, whether authors can choose, and whether to use categories, cooldowns, or open-submission limits.' },
          { title: 'Choose optional discussion', body: 'Turn on discussion threads or reviewer digests if they suit your community.' },
        ] },
      ] },
      { id: 'submit', title: 'Submit and vote on an idea', blocks: [
        { type: 'steps', items: [
          { title: 'Run /suggest', body: 'Enter a short title and explain the idea. If categories are enabled, choose the closest match.' },
          { title: 'Vote on the posted suggestion', body: 'Use the vote buttons to support or oppose it. You can change or remove your vote while voting remains open.' },
          { title: 'Check its status', body: 'Reviewers can move an idea through review, planning, approval, or rejection. Authors are notified when the status changes when Discord allows the message.' },
        ] },
      ] },
      { id: 'privacy', title: 'What anonymous means', blocks: [
        { type: 'paragraph', text: 'Anonymous submissions do not show the author publicly on the suggestion. Clanky still keeps the account association privately so it can enforce limits and notify the author about decisions.' },
        { type: 'callout', tone: 'tip', title: 'Review from either place', body: 'Reviewers can use Discord’s review controls or the searchable Suggestions queue in the dashboard. If a Discord post failed, the queue can help staff recover it.' },
      ] },
    ],
  },
  {
    slug: 'roles-and-self-service', title: 'Let members choose their own roles', summary: 'Create a role panel so members can opt into roles without asking a moderator.', category: 'community', icon: 'UsersRound', readTime: 2, tags: ['roles', 'role panel', 'self service', 'choose roles', 'reaction roles'],
    sections: [
      { id: 'create', title: 'Create a role panel', blocks: [
        { type: 'steps', items: [
          { title: 'Choose the roles', body: 'Make sure the roles are safe for members to assign themselves.' },
          { title: 'Run /rolepanel create', body: 'Follow the prompts to choose the channel, roles, and whether members may pick one role or several.' },
          { title: 'Check the live panel', body: 'Members use Choose roles, select their options, and submit. They can return to remove a role later.' },
        ] },
        { type: 'callout', tone: 'important', title: 'Role order matters', body: 'Clanky can only assign roles below its highest role. Discord-managed roles and roles above Clanky cannot be assigned.' },
      ] },
      { id: 'manage', title: 'Manage role panels', blocks: [
        { type: 'paragraph', text: 'Use /rolepanel list to review panels and /rolepanel delete to remove one. These management commands require Manage Roles permission.' },
      ] },
    ],
  },
  {
    slug: 'leveling-and-ranks', title: 'Set up XP, ranks, and rewards', summary: 'Choose how members earn XP, show their progress, and reward activity.', category: 'engagement', icon: 'Trophy', readTime: 4, tags: ['leveling', 'xp', 'rank', 'leaderboard', 'rewards', 'season', 'role'],
    sections: [
      { id: 'how-xp-works', title: 'How members earn XP', blocks: [
        { type: 'paragraph', text: 'When Leveling is enabled, eligible human messages can earn XP. The server controls the XP range, cooldown, minimum message length, and channels that do not count.' },
        { type: 'callout', tone: 'note', title: 'Activity needs to qualify', body: 'Very short messages, bot messages, and messages in ignored channels may not earn XP. Cooldowns prevent rapid messages from granting XP repeatedly.' },
      ] },
      { id: 'configure', title: 'Choose progression and rewards', blocks: [
        { type: 'steps', items: [
          { title: 'Open Leveling settings', body: 'Set the XP range, cooldown, minimum message length, and progression curve.' },
          { title: 'Choose ignored channels', body: 'Exclude channels where you do not want casual chat to count.' },
          { title: 'Set level-up announcements', body: 'Choose whether to announce new levels and which channel should receive the message.' },
          { title: 'Add reward roles', body: 'Choose roles for milestones. Clanky must have permission and a higher role position to assign them.' },
        ] },
      ] },
      { id: 'see-progress', title: 'View a rank or leaderboard', blocks: [
        { type: 'list', items: ['Use /rank to see your rank card or another member’s card.', 'Use /leaderboard to browse server rankings and, when available, an active season.', 'Server managers can review activity and adjust XP with the tools in the dashboard or the /xp commands.'] },
      ] },
    ],
  },
  {
    slug: 'salvage-game', title: 'Play Salvage', summary: 'Dig for finds, build your collection, and use the shop to grow your Salvage profile.', category: 'engagement', icon: 'Pickaxe', readTime: 3, tags: ['salvage', 'game', 'dig', 'bag', 'shop', 'collection', 'profile', 'leaderboard', 'cooldown'],
    sections: [
      { id: 'start-playing', title: 'Start digging', blocks: [
        { type: 'steps', items: [
          { title: 'Run /salvage dig', body: 'Search for a find. Each dig has a cooldown, so come back when it is ready.' },
          { title: 'Check your bag', body: 'Use /salvage bag to see what you found and choose what to keep or sell.' },
          { title: 'Visit the shop', body: 'Use /salvage shop to browse tools, boosts, crates, and other available upgrades.' },
          { title: 'Track your collection', body: 'Use /salvage collection, /salvage profile, and /salvage top to explore your progress.' },
        ] },
      ] },
      { id: 'progress', title: 'How progress works', blocks: [
        { type: 'paragraph', text: 'Salvage has finds with different rarities, collection progress, upgrades, and leaderboards. Your game progress is global, so it follows your account across servers.' },
        { type: 'callout', tone: 'tip', title: 'Can’t dig here?', body: 'A server may restrict games to selected channels. Try an allowed channel or ask a moderator which channel is set aside for Salvage.' },
      ] },
    ],
  },
  {
    slug: 'reminders-and-polls', title: 'Use reminders and polls', summary: 'Set a personal reminder or post a native Discord poll for your community.', category: 'engagement', icon: 'BellRing', readTime: 3, tags: ['reminders', 'remind', 'snooze', 'poll', 'vote', 'schedule', 'notifications'],
    sections: [
      { id: 'reminders', title: 'Create a reminder', blocks: [
        { type: 'steps', items: [
          { title: 'Run /remind me', body: 'Choose when you want to be reminded and write a short note.' },
          { title: 'Choose where it arrives', body: 'Your preferences control whether reminders are sent by direct message or in the channel where you set them.' },
          { title: 'Manage it later', body: 'Use /remind list to see active reminders and /remind cancel to remove one. Delivered reminders can be snoozed or marked done.' },
        ] },
      ] },
      { id: 'polls', title: 'Post a poll', blocks: [
        { type: 'steps', items: [
          { title: 'Run /poll', body: 'Enter a question and between two and ten answer choices.' },
          { title: 'Choose poll options', body: 'Select how long it should run and whether voters may choose more than one answer.' },
          { title: 'Share it', body: 'Clanky posts a native Discord poll so members can vote using Discord’s poll controls.' },
        ] },
      ] },
    ],
  },
  {
    slug: 'logging-and-change-history', title: 'Logging and incident review', summary: 'Choose which events to log, search evidence, investigate grouped incidents and review Clanky settings changes.', category: 'safety', icon: 'ScrollText', readTime: 5, tags: ['logs', 'logging', 'audit', 'incident center', 'risk score', 'evidence', 'change history', 'deleted messages', 'edited messages', 'nickname', 'roles', 'webhooks', 'retention'],
    sections: [
      { id: 'event-logs', title: 'Choose what gets logged', blocks: [
        { type: 'steps', items: [
          { title: 'Choose a log channel', body: 'Open Logging settings, enable the module, and select a channel Clanky can view and post in.' },
          { title: 'Choose event types and destinations', body: 'Select the events to record and choose a destination for each category. Clanky can capture message changes, member and moderation activity, server changes, integrations, and suspicious new-account link bursts.' },
          { title: 'Choose exclusions and retention', body: 'Exclude channels, roles or bots when appropriate. Set different retention periods per category, or choose indefinite retention where available.' },
          { title: 'Set access and privacy', body: 'Choose which roles can search dashboard records and which roles can view sensitive message evidence. Sensitive-evidence roles can also search records; ordinary log-reader roles cannot see message text or attachment details. Recording message text or attachment details is optional; use the narrowest access and shortest retention that work for your server.' },
        ] },
        { type: 'callout', tone: 'note', title: 'Check the bot’s permissions', body: 'Clanky needs View Audit Log to attribute many moderation and server changes. Message Content Intent is needed for message-text logging and new-account link-burst detection. An administrator must enable that intent for the bot application.' },
        { type: 'callout', tone: 'important', title: 'Keep sensitive logs private', body: 'If message text is recorded, it is also sent to the selected Discord log channel. Set that channel’s Discord permissions carefully; dashboard evidence-reader roles do not control who can read the Discord channel.' },
      ] },
      { id: 'incident-center', title: 'Review suspicious activity', blocks: [
        { type: 'steps', items: [
          { title: 'Open Incident Center', body: 'From a server dashboard, choose Incident Center. Staff with an assigned log-viewer role can also open it from their server list.' },
          { title: 'Choose an incident or search records', body: 'Grouped incidents bring related signals into one timeline. Search events by summary or Discord ID, and narrow results by event, category or delivery status.' },
          { title: 'Review the timeline and evidence', body: 'Check timestamps, affected members/channels, actor attribution, delivery state and integrity status. Open evidence only if you have been given sensitive-evidence access.' },
          { title: 'Record the outcome', body: 'Server managers can mark an incident as investigating, resolved or a false alarm and add a short note. Failed Discord delivery can be retried after its destination is configured.' },
        ] },
        { type: 'callout', tone: 'important', title: 'A risk score is not a verdict', body: 'Automated scores and groupings are indicators for investigation, not proof of misconduct. Confirm the full context before taking action. A matching evidence hash can detect certain changes to a saved record, but cannot prove the original event was truthful or detect deletion of the whole database.' },
      ] },
      { id: 'history', title: 'Review settings changes', blocks: [
        { type: 'paragraph', text: 'Open Change history from a server’s dashboard menu to see recent configuration changes and who made them, including changes to logging settings. The overview also shows the most recent changes.' },
      ] },
    ],
  },
  {
    slug: 'preferences-and-privacy', title: 'Your preferences and privacy', summary: 'Control personal notifications, private replies, reminder delivery, and account data.', category: 'account', icon: 'UserRoundCog', readTime: 3, tags: ['preferences', 'private', 'privacy', 'data', 'delete', 'reminders', 'notifications', 'feedback'],
    sections: [
      { id: 'preferences', title: 'Change your preferences', blocks: [
        { type: 'steps', items: [
          { title: 'Run /preferences in Discord', body: 'Open the personal settings panel. You can also use the account menu on the dashboard for personal account pages.' },
          { title: 'Choose how Clanky responds', body: 'Set supported replies to private, turn level-up pings or update notices on or off, and choose where reminders arrive.' },
          { title: 'Save your choices', body: 'Preference controls save as you change them.' },
        ] },
      ] },
      { id: 'data', title: 'Delete personal data', blocks: [
        { type: 'paragraph', text: 'Use Delete my data in /preferences to remove personal Clanky account data. This cannot be undone. It does not delete Discord messages, server moderation records, ticket transcripts, suggestions, or records kept by a server operator.' },
        { type: 'callout', tone: 'important', title: 'Review before confirming', body: 'Data removal affects your personal Clanky records and progress. If you are unsure whether something will be removed, ask the server operator before confirming.' },
      ] },
      { id: 'feedback', title: 'Send feedback safely', blocks: [
        { type: 'paragraph', text: 'Sign in to use the Feedback link or the occasional in-dashboard prompt. Feedback includes account and request details only after you acknowledge the notice. The prompt can be dismissed or permanently turned off.' },
      ] },
    ],
  },
  {
    slug: 'server-history-and-transcripts', title: 'Review server history and ticket transcripts', summary: 'See who changed settings, browse closed support conversations, and understand transcript access and retention.', category: 'dashboard', icon: 'ScrollText', readTime: 3, tags: ['history', 'audit', 'ticket transcript', 'closed ticket', 'archive', 'retention', 'server activity'],
    sections: [
      { id: 'change-history', title: 'See settings changes', blocks: [
        { type: 'steps', items: [
          { title: 'Open your server', body: 'Sign in, choose the server, then select Change history from the server menu.' },
          { title: 'Browse recent updates', body: 'Review changes made in the dashboard or in Discord, including who made them and when.' },
          { title: 'Check the overview', body: 'The server overview also shows a short list of recent changes for a quick check.' },
        ] },
      ] },
      { id: 'transcripts', title: 'Find a closed ticket', blocks: [
        { type: 'steps', items: [
          { title: 'Open Ticket transcripts', body: 'From the server menu, choose Ticket transcripts. You need to be a server manager or have a configured ticket-staff role.' },
          { title: 'Search and open a record', body: 'Browse or search the closed tickets you can access, then open one to review its conversation and submitted answers.' },
          { title: 'Check files and retention', body: 'Archived attachments appear with the transcript when available. Each record shows whether it has expired or was shortened.' },
        ] },
        { type: 'callout', tone: 'note', title: 'Older tickets may not be listed', body: 'Only transcripts saved by the dashboard archive are shown here. Existing text transcripts from before that archive was enabled are not imported.' },
      ] },
      { id: 'salvage-profile', title: 'View your personal Salvage progress', blocks: [
        { type: 'paragraph', text: 'Open your account menu and choose Salvage profile to see your global game progress, bag, collection, upgrades, and badges. To start, use /salvage dig in Discord.' },
      ] },
    ],
  },
  {
    slug: 'common-fixes', title: 'Quick fixes for common problems', summary: 'Try these checks if commands, dashboard servers, messages, or XP are not behaving as expected.', category: 'account', icon: 'CircleHelp', readTime: 3, tags: ['troubleshoot', 'problem', 'commands missing', 'server missing', 'not working', 'permissions', 'save', 'xp'],
    sections: [
      { id: 'commands', title: 'Commands do not appear', blocks: [
        { type: 'list', items: ['Confirm Clanky is added to the server and that you are typing / in a server where it is available.', 'Ask a server owner to check command permissions under Server Settings → Integrations → Clanky.', 'Use /help to see commands available to your account.'] },
      ] },
      { id: 'dashboard', title: 'A server is missing from the dashboard', blocks: [
        { type: 'list', items: ['Sign in with the Discord account that manages the server.', 'If Clanky was just invited, choose Refresh on the server list.', 'Check that your Discord role can manage the server.'] },
      ] },
      { id: 'features', title: 'A feature does not post or respond', blocks: [
        { type: 'list', items: ['Check that the module is enabled and has a destination channel selected.', 'Make sure Clanky can view the channel and send messages there.', 'For role actions, confirm Clanky’s role is above the target role.', 'For AutoMod, confirm Clanky has Manage Server permission.'] },
      ] },
      { id: 'xp', title: 'Messages are not earning XP', blocks: [
        { type: 'list', items: ['Check that Leveling is enabled for this server.', 'Very short messages, bot messages, or messages from ignored channels may not count.', 'XP cooldowns limit how often activity earns XP.'] },
      ] },
    ],
  },
];

export function helpSearchText(article: HelpArticle) {
  return [article.title, article.summary, article.category, ...article.tags, ...article.sections.flatMap((section) => [section.title, ...section.blocks.flatMap((block) => block.type === 'steps' ? block.items.flatMap((step) => [step.title, step.body]) : block.type === 'list' ? [...(block.title ? [block.title] : []), ...block.items] : block.type === 'callout' ? [block.title, block.body] : [block.text])])].join(' ').toLocaleLowerCase();
}

export function searchHelpArticles(query: string, category = 'all') {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const articles = HELP_ARTICLES.filter((article) => category === 'all' || article.category === category);
  if (!terms.length) return articles;

  return articles
    .map((article) => {
      const searchable = helpSearchText(article);
      const title = article.title.toLocaleLowerCase();
      const summary = article.summary.toLocaleLowerCase();
      const score = terms.reduce((total, term) => total + (title.includes(term) ? 5 : 0) + (summary.includes(term) ? 2 : 0) + (searchable.includes(term) ? 1 : 0), 0);
      const matchesEveryTerm = terms.every((term) => searchable.includes(term));
      return { article, score, matchesEveryTerm };
    })
    .filter(({ matchesEveryTerm }) => matchesEveryTerm)
    .sort((a, b) => b.score - a.score)
    .map(({ article }) => article);
}
