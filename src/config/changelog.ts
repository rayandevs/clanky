/**
 * Release notes shown in /about and posted to servers that turned on
 * update announcements. Newest entry first. Keep highlights short.
 */
export interface ChangelogEntry {
  version: string;
  date: string;
  title: string;
  highlights: string[];
}

export const changelog: ChangelogEntry[] = [
  {
    version: '0.1.0-beta.16',
    date: '2026-10-19',
    title: 'A smoother, steadier dashboard',
    highlights: [
      'Reduced scroll jank by replacing animated full-screen effects with a static background and lighter glass surfaces',
      'Recover from stale dashboard chunks automatically, with a visible error screen if a reload cannot help',
      'Debounced suggestion searches, settings sliders, and welcome-card previews to avoid unnecessary work',
    ],
  },
  {
    version: '0.1.0-beta.15',
    date: '2026-10-18',
    title: 'Welcome cards, in sync 👋',
    highlights: [
      'The dashboard preview now uses the same Canvas renderer as the bot, so template and background choices match the posted card',
      'Corrected template colors and labels, and removed unsupported emoji glyphs from image text',
      'Removed the optional attachment description that caused Discord to show an ALT overlay on cards',
    ],
  },
  {
    version: '0.1.0-beta.14',
    date: '2026-10-18',
    title: 'A warmer welcome 👋',
    highlights: [
      'Configure join and leave messages separately, with their own channels, formats, mentions, and bot-member controls',
      'Choose a Clanky container, plain text, text with a generated card, or an image-only greeting',
      'Customize member cards with built-in templates or uploaded backgrounds, avatars, server names, and member counts',
      'Optionally wait until membership screening passes before greeting new members',
    ],
  },
  {
    version: '0.1.0-beta.13',
    date: '2026-10-18',
    title: 'Clearer suggestion cards 💡',
    highlights: [
      'Suggestion posts now give the idea, status, category, and author details more room to breathe',
      'Simplified vote controls show each count once, without the redundant progress bar and percentage',
    ],
  },
  {
    version: '0.1.0-beta.12',
    date: '2026-10-17',
    title: 'Ideas that move 💡',
    highlights: [
      'Review suggestions in Discord or a searchable dashboard queue with status history and reviewer notes',
      'Organize submissions with categories, optional anonymity, per-member limits and cooldowns',
      'Keep authors updated, send optional reviewer digests, and recover suggestions when Discord posting fails',
    ],
  },
  {
    version: '0.1.0-beta.11',
    date: '2026-10-16',
    title: 'Clearer dashboard legal docs 📜',
    highlights: [
      'Read Clanky’s Privacy Policy and Terms of Service on public dashboard pages',
      'Both policies explain self-hosted operation, data handling, retention, and deletion scope',
    ],
  },
  {
    version: '0.1.0-beta.10',
    date: '2026-10-16',
    title: 'A more personal leveling system ⭐',
    highlights: [
      'Choose a relaxed, classic or challenging XP pace without resetting existing levels or progress',
      'Track all human messages separately from XP-earning messages, with daily activity and top-chatter insights',
      'Customize rank cards, tune channel and role XP boosts, and use manually managed seasonal leaderboards',
    ],
  },
  {
    version: '0.1.0-beta.9',
    date: '2026-10-16',
    title: 'A clearer ticket desk 🎫',
    highlights: [
      'Choose no panel image, a built-in template, or upload custom panel artwork from the dashboard',
      'Ticket openings show the opener, category and claim status in one image inside one container',
      'Search structured transcripts in the dashboard; attachment bytes are archived for the configured retention period and permission-checked',
      'Tickets remain open if transcript data or attachments cannot be safely archived',
    ],
  },
  {
    version: '0.1.0-beta.8',
    date: '2026-10-16',
    title: 'A better ticket desk 🎫',
    highlights: [
      'Configure up to three ticket panels with custom intake forms and per-panel routing',
      'A redesigned dashboard editor with previews and tracked panel updates',
      'Canvas artwork on support panels and newly opened tickets',
    ],
  },
  {
    version: '0.1.0-beta.7',
    date: '2026-10-15',
    title: 'The dashboard is here 🖥️',
    highlights: [
      'Change every setting from the web dashboard',
      'See your Salvage profile, bag and collection online',
      'Server overview with stats and change history',
    ],
  },
  {
    version: '0.1.0-beta.6',
    date: '2026-10-15',
    title: 'Image screens 🖼️',
    highlights: [
      'Bag, shop and collection are now image cards',
      'Your bag, credits, zone and boosts show on every game card',
      'Shop buttons are numbered to match each row',
    ],
  },
  {
    version: '0.1.0-beta.5',
    date: '2026-10-15',
    title: 'The big shop update 🛒',
    highlights: [
      'Black Market with 3 new deals every day',
      'Upgrades, boosts and crates',
      'Profile themes, titles and badges',
    ],
  },
  {
    version: '0.1.0-beta.4',
    date: '2026-10-15',
    title: 'Profile cards 🪪',
    highlights: [
      '`/salvage profile` is now an image card',
      'Cleaner, easier-to-read game messages',
    ],
  },
  {
    version: '0.1.0-beta.3',
    date: '2026-10-15',
    title: 'Salvage is here 🔧',
    highlights: [
      'New game: dig for loot with `/salvage dig`',
      '44 items in 4 zones, with shinies and events',
      'Tool shop, collection log and daily streaks',
      'Server and global leaderboards',
    ],
  },
  {
    version: '0.1.0-beta.2',
    date: '2026-10-15',
    title: 'Rank cards 🖼️',
    highlights: [
      '`/rank` now shows an image rank card',
      '`/leaderboard` is now an image, with page buttons',
      'New **Find me** button jumps to your page',
    ],
  },
  {
    version: '0.1.0-beta.1',
    date: '2026-10-14',
    title: 'First beta 🎉',
    highlights: [
      'Server settings panel with `/settings`',
      'Moderation with cases, reports and native AutoMod',
      'Tickets with transcripts',
      'Welcome & leave messages with auto roles',
      'Role panels, suggestions and native polls',
      'Leveling with role rewards',
      'Personal reminders and user preferences',
    ],
  },
];

export function getChangelog(versionRaw: string): ChangelogEntry | undefined {
  return changelog.find((entry) => entry.version === versionRaw);
}
