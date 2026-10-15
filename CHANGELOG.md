# Changelog

All notable changes to Clanky. Versions follow [SemVer](https://semver.org) with release channels (`-beta.N`).

## [0.1.0-beta.4] — 2026-10-15

### Changed
- `/salvage profile` is now an image card: level bar, 4 key stats (credits, collection, streak, global rank) and zone / tool / best find, with a hazard-tape strip
- Twemoji icons moved to `assets/icons` with a shared `loadIcon()` helper (`src/render/icons.ts`) so any card can use them
- Removed doubled emojis in game notices

### Fixed
- Picking a locked zone left the menu showing that zone. The profile now re-renders so the menu shows your real zone.

## [0.1.0-beta.3] — 2026-10-15

### Added
- **Games module** with **Salvage**, Clanky's signature game. Press **Dig**, find loot, earn game XP.
  - 44 items across 4 zones (Scrapyard, Junk City, Robot Graveyard, Space Dump), unlocked by level
  - 5 rarities, 1-in-150 shiny variants (worth 5×), double finds
  - Random events: Scrap Golem (fight or run) and Mystery Crate
  - Tool shop with 5 tools that boost luck, XP and double finds
  - Bag with "Sell junk" / "Sell everything", collection log, profile with zone travel
  - Daily streak bonus and level-up credit rewards
  - Image find cards and a `SALVAGE TOP` leaderboard (this server / global)
- Progress is global: one profile across every server (`GamePlayer` model)
- `/settings` → Games page: toggle the module and limit it to certain channels
- `/salvage` works as a user-installed app too

### Changed
- Leaderboard renderer accepts a custom title and footer
- "Delete my data" also removes Salvage progress

## [0.1.0-beta.2] — 2026-10-15

### Added
- Image rank card for `/rank`: flat design with avatar, rank, level and XP bar in the server's accent color
- Image leaderboard for `/leaderboard`: 10 per page, gold/silver/bronze top 3, your row highlighted, your rank in the footer
- **Find me** button on the leaderboard that jumps to your page
- `src/render/` canvas renderer (`@napi-rs/canvas`) with bundled Poppins fonts (`assets/fonts`, SIL OFL)

### Changed
- Leaderboard page buttons now re-render the image in place

## [0.1.0-beta.1] — 2026-10-14 · "Spark"

First public beta.

### Added
- Interactive `/settings` panel with pages for General, Moderation, AutoMod, Logging, Welcome, Tickets, Suggestions and Leveling
- Module toggles, accent colors and update notes channel
- Moderation: `/warn`, `/timeout`, `/untimeout`, `/kick`, `/ban`, `/unban`, `/purge`, `/cases`, with mod log, member DMs and editable reasons
- **Report message** context menu with staff action buttons
- Native Discord AutoMod management (invites, mention spam, spam, blocked words)
- Tickets with categories, claim/close buttons and text transcripts
- Welcome and leave messages with placeholders and auto roles
- Role panels (`/rolepanel`) with pick-any and pick-one modes
- Suggestions with voting, reviews and discussion threads
- Leveling with role rewards, `/rank`, `/leaderboard` and `/xp` tools
- Reminders with snooze, usable as a user-installed app
- Native polls via `/poll`
- Event logging (message edits/deletes, joins/leaves, roles, nicknames)
- User preferences and "delete my data"
- Version system with changelog, "What's new" announcements and update notices
- Settings audit log and change-stream cache refresh for the upcoming dashboard
