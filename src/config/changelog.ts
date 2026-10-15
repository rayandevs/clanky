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
