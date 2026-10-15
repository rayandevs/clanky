# Changelog

All notable changes to Clanky. Versions follow [SemVer](https://semver.org) with release channels (`-beta.N`).

## Unreleased

### Added
- Ticket administrators can configure up to three panels, custom intake questions, per-panel staff/channel/transcript routing, and preview/post panels from both `/settings` and the dashboard
- Panel messages are tracked and refreshed in place; tickets preserve question labels, answers, and routing snapshots in transcripts
- Existing single-panel title/description settings migrate to the first configurable panel

## [0.1.0-beta.7] — 2026-10-15

### Added
- Web dashboard served by the bot process (Fastify on `DASHBOARD_PORT`). The website has its own version, see `dashboard/CHANGELOG.md`
- Discord OAuth2 login (`identify guilds`), sessions stored hashed in MongoDB, tokens encrypted with AES-256-GCM
- Dashboard API: server list, server overview, every settings section, AutoMod rule toggles, ticket panel posting, change history, user preferences, Salvage stats and image cards, data deletion
- New env vars: `DASHBOARD_ENABLED`, `DASHBOARD_PORT`, `DASHBOARD_HOST`, `DASHBOARD_URL`, `DISCORD_CLIENT_SECRET`, `DASHBOARD_SESSION_SECRET`, `DASHBOARD_TRUST_PROXY`
- `DashboardSession` model. `/data delete` also ends dashboard sessions

### Security
- Mutating API calls need the `X-Clanky` header (CSRF), cookies are signed, httpOnly and SameSite=Lax
- Server access is re-checked live (Manage Server) on every request

## [0.1.0-beta.6] — 2026-10-15

### Added
- Image cards for `/salvage bag` (12 items per page), `/salvage shop` (all six tabs) and `/salvage collection`
- Status bar on every game card: bag size, credits, zone and active boosts
- Numbered shop rows with matching numbered buttons
- Shared game renderer (`src/render/game.ts`) and new card renderers (`src/render/salvageCards.ts`)

### Changed
- Find and event cards now include the status bar, so the message text is shorter
- Upgrade rows show the current and next value
- Shorter badge hints, and the Black Market timer shows hours and minutes only
- Explorer badge now uses a rocket icon

## [0.1.0-beta.5] — 2026-10-15

### Added
- **Shop sections** (pick from a menu): Black Market, Upgrades, Boosts, Crates, Tools, Cosmetics
- **Black Market**: 3 personal deals a day (boost 40% off, crate 30% off, a collection item) plus a daily **hot item** that sells for 3×
- **Upgrades** (10 levels each): Turbo Motor (cooldown), Metal Detector (shiny chance), Haggler (sell bonus), Golem Armor (golem win chance)
- **Boosts**: Lucky Charm (+50% luck, 25 digs), XP Battery (2× XP, 25 digs), Golem Bait (golem on next dig). Active boosts show under the find card.
- **Crates**: Rusty, Golden and Cosmic with odds shown, plus an "Open another" button
- **Cosmetics**: 6 profile themes and 7 titles (some unlock through play), with a confirm step before buying
- **Badges** earned by playing, shown next to your name on the profile card

### Changed
- Shop button opens the Black Market
- Bag shows the hot item and includes Haggler and hot-item prices
- All purchases are atomic, so double-clicking can't charge twice

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
