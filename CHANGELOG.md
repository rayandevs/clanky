# Changelog

All notable changes to Clanky. Versions follow [SemVer](https://semver.org) with release channels (`-beta.N`).

## [Unreleased]

## [0.1.0-beta.19] — 2026-10-20

### Added
- Searchable server activity records with event identifiers, tamper-evident hashes, category routing, and configurable retention
- Group rapid channel deletions, ban bursts, permission changes, and new-account link bursts into reviewable incidents
- Incident timelines, affected members/channels/roles, moderator attribution, review notes, and delivery retry controls
- Granular privacy controls for message content, attachments, excluded channels/roles, and separate log-reader and sensitive-evidence roles
- Retry failed Discord log delivery with a durable queue; role alerts are restricted to configured roles and sent once per incident alert window

## [0.1.0-beta.18] — 2026-10-19

### Improved
- Moved unsaved settings controls to a fixed, always-visible side panel
- Added an animated collapse-to-tab control that stays tucked away until changes are saved or reset

## Dashboard 0.1.0-beta.3 — 2026-10-19

### Improved
- Kept Save and Reset controls in view while editing dashboard settings, with an accessible animated side-tab collapse

## [0.1.0-beta.17] — 2026-10-19

### Added
- Added an in-dashboard Help Center with searchable, step-by-step guides for setting up and using Clanky
- Browse by topic, jump to sections, follow related guides, or share a link to a specific article

## Dashboard 0.1.0-beta.2 — 2026-10-19

### Added
- Added a searchable Help Center to the dashboard for bot commands, community tools, moderation, engagement, and dashboard workflows
- Fixed a route-transition cleanup issue that could replace pages with the dashboard error screen

## Dashboard 0.1.0-beta.1 — 2026-10-19

### Added
- Sign-in-required feedback link and randomized in-dashboard prompt, with cooldowns, dismissal, and a permanent opt-out
- Per-IP and per-account rate limits, honeypot filtering, and validated 1–5 star notes delivered through a server-only Discord webhook
- Explicit consent for Discord profile, page, timestamp, IP, and browser metadata; session IDs, cookies, and OAuth tokens are excluded
- Dashboard release channel moved from Alpha to Beta under the Rench codename

## [0.1.0-beta.16] — 2026-10-19

### Fixed
- Reduced dashboard scroll jank by replacing animated full-screen effects with a static background, lighter glass blur and compositor-friendly route transitions
- Added a visible React error fallback and guarded recovery reload for stale JavaScript chunks; HTML is revalidated while fingerprinted assets use immutable caching
- Debounced suggestion searches and welcome-card previews; sliders now persist once per committed adjustment rather than on every movement

## [0.1.0-beta.15] — 2026-10-18

### Fixed
- Dashboard card previews now use the exact Canvas renderer used for bot messages, including the selected template, uploaded background, accent, avatar options, and member details
- Corrected the template palettes and event labels so Celebration, Minimal, and Soft look as configured
- Removed unsupported emoji glyphs from Canvas text and removed the optional attachment description that made Discord show an ALT overlay

## [0.1.0-beta.14] — 2026-10-18

### Added
- Separate join and leave configuration from `/settings` and the dashboard, including independent message formats, channels, previews, mention controls, and bot-member filters
- Choose a Components V2 container, plain text, text with a generated image, or an image-only card
- Generate Canvas welcome/farewell cards with three templates, optional custom backgrounds, member avatars, server names, and member counts
- Optionally delay the join message until Discord membership screening passes

### Changed
- Existing shared welcome/leave settings migrate into the new event-specific configuration without losing channels, messages, or avatar behavior
- Ticket and Welcome image uploads share the same validation and PNG-normalization helper

## [0.1.0-beta.13] — 2026-10-18

### Changed
- Simplified suggestion posts: clearer spacing and labels for idea details, status, category, author, and vote actions
- Removed the redundant progress bar, percentage, reviewer ID, and duplicate vote totals

## [0.1.0-beta.12] — 2026-10-17

### Added
- Searchable dashboard suggestions queue with status filters, vote sorting, workload stats, review notes and history
- Suggestion categories, submitter-selected anonymity, per-member open limits and cooldowns
- Intermediate review states, author notifications, optional daily/weekly reviewer digests, and retryable failed Discord posts
- Shared review and post-rendering logic across bot and dashboard, preserving existing suggestion records

## [0.1.0-beta.10] — 2026-10-16

### Added
- Configurable relaxed, classic, and challenging XP curves; channel/role multipliers; and a minimum message length for XP eligibility
- Per-server all-human-message totals and daily message/XP/active-member analytics, while preserving XP-earning message counts separately
- Season-only XP and a seasonal leaderboard that leaves lifetime levels and XP untouched
- Rank-card themes, server branding, optional statistics, a reward milestone preview, and preview-first reward-role synchronization

### Changed
- Existing members keep their current level and fractional progress when the configured progression pace changes
- The guild overview ranks top chatters by all-message totals rather than XP

## [0.1.0-beta.9] — 2026-10-16

### Added
- Optional ticket-panel artwork: choose a built-in template, no image, or upload custom art from the dashboard
- Searchable dashboard transcripts for newly closed tickets, including saved intake answers, messages, embeds, and attachment bytes archived for the selected retention period
- Attachment archive limits: 25 MiB per file, 100 MiB total, and 500 files per ticket
- Per-server transcript retention controls (30, 90, 180, 365 days, or indefinitely), with access for Manage Server users and configured ticket staff

### Changed
- Ticket openings now use one information-rich image inside one container for the opener, category, and claim status

### Fixed
- Tickets stay open if transcript messages or attachment archives cannot be saved, avoiding incomplete dashboard transcripts

## [0.1.0-beta.8] — 2026-10-16

### Added
- Ticket administrators can configure up to three panels, custom intake questions, per-panel staff/channel/transcript routing, and preview/post panels from both `/settings` and the dashboard
- Ticket panel banners and ticket-opening summaries use Clanky's shared canvas-card style and the server accent color; staff can refresh panel artwork in place
- Panel messages are tracked and refreshed in place; tickets preserve question labels, answers, and routing snapshots in transcripts
- Existing single-panel title/description settings migrate to the first configurable panel

### Changed
- Rebuilt the dashboard ticket editor around panel navigation, a dedicated form/routing editor, reorderable questions, a live Discord preview, and save-aware panel publishing

### Fixed
- Bot-side panel previews now show the same canvas artwork as published panels
- Claiming a ticket preserves its opening artwork while refreshing the claim controls

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
