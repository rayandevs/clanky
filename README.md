# 🤖 Clanky

A multipurpose Discord bot for **community management, moderation and engagement** — built with the newest Discord features and set up entirely from Discord.

> **Version:** `0.1.0-beta.1` · codename **Spark** · see [CHANGELOG.md](CHANGELOG.md)

- **Slash commands only.** No prefixes, no message commands.
- **Components V2 everywhere.** Every message uses Containers, Sections, Text Displays, Separators and File components. No embeds.
- **Interactive setup.** Admins configure everything in `/settings` with buttons, select menus and modals.
- **New modal components.** Labels, role selects, radio groups and checkboxes inside modals.
- **Native Discord features.** AutoMod rules, native polls, user-installable commands and context menus.
- **Web dashboard.** Manage every setting, see server stats and your Salvage progress at the same address the bot runs on.

---

## ✨ Features

| Module | What it does |
| --- | --- |
| ⚙️ **Settings** | `/settings` panel with a page per module. Turn modules on/off, pick channels and roles, edit messages in modals, and set an accent color. |
| 🛡️ **Moderation** | Warn, timeout, kick, ban, unban and purge. Every action becomes a numbered **case** with history, editable reasons, a mod log and optional DMs to the member. |
| 🚩 **Reports** | Right-click a message → **Report message**. Staff get a report card with buttons to delete the message, time out the author or dismiss. |
| 🤖 **AutoMod** | One-click **native Discord AutoMod** rules: invite links, mention spam, spam and blocked words. They keep working when Clanky is offline. |
| 🎫 **Tickets** | Up to three panels, each with a customizable intake form and optional staff/category/transcript routing. Answers are saved with the ticket and transcript; tracked panels can be refreshed in place. |
| 👋 **Welcome** | Welcome and leave messages with placeholders, avatars and **auto roles** (works with membership screening). |
| 🎭 **Role panels** | Members press **Choose roles** and pick from a select menu that already shows their current roles. "Pick any" or "Pick one" modes. |
| 💡 **Suggestions** | Members submit ideas in a modal. Others vote with buttons. Reviewers approve, deny or mark them implemented, and the author gets a DM. Discussion threads are optional. |
| ⭐ **Leveling** | XP for chatting with cooldowns, level-up messages, **role rewards**, an image rank card (`/rank`), a paged image `/leaderboard` with a Find me button and admin XP tools. |
| 🎮 **Games** | **Salvage**: press Dig, find loot, level up. 44 items in 4 zones, shinies, events, a tool shop, a collection log and server + global leaderboards. Progress is global. |
| ⏰ **Reminders** | `/remind me in:2h about:...` with snooze buttons. Works in DMs and as a user-installed app. |
| 📊 **Polls** | `/poll` opens a modal and posts a **native Discord poll**. |
| 📋 **Logging** | Deleted or edited messages, joins and leaves, role and nickname changes. Choose what to log and which channels to ignore. |
| 👤 **Preferences** | Each user can turn on private replies, level-up pings and update notices, choose reminder delivery, or delete all their data. |

## 📜 Commands

| Command | Description | Default access |
| --- | --- | --- |
| `/help` | Browse modules and commands | Everyone |
| `/about` | Version, stats and release notes | Everyone |
| `/ping` | Response time | Everyone |
| `/preferences` | Personal settings | Everyone |
| `/userinfo` · **User info** (right-click) | Member details | Everyone |
| `/serverinfo` | Server details | Everyone |
| `/settings [module]` | Server settings panel | Manage Server |
| `/warn` `/timeout` `/untimeout` | Member moderation | Timeout Members |
| `/kick` | Kick a member | Kick Members |
| `/ban` `/unban` | Bans (unban has autocomplete) | Ban Members |
| `/purge` | Bulk delete messages | Manage Messages |
| `/cases view` `/cases user` | Case lookup | Timeout Members |
| **Report message** (right-click) | Report to staff | Everyone |
| `/ticket panel` `add` `remove` `close` | Tickets | Panel: Manage Server |
| `/rolepanel create` `list` `delete` | Role panels | Manage Roles |
| `/suggest` | Submit a suggestion | Everyone |
| `/rank` `/leaderboard` | Leveling | Everyone |
| `/salvage dig` `bag` `shop` `profile` `collection` `top` | Games | Everyone |
| `/xp give` `take` `set-level` `reset-all` | XP admin tools | Manage Server |
| `/remind me` `list` `cancel` | Reminders | Everyone |
| `/poll` | Native poll | Everyone |

Admins can change who can use each command in **Server Settings → Integrations → Clanky**.

---

## 🚀 Getting started

### 1. Requirements

- Node.js **20.11+**
- MongoDB 6+ (local, Docker or MongoDB Atlas)
- A Discord application from the [Developer Portal](https://discord.com/developers/applications)

### 2. Developer Portal setup

1. **Bot** tab → copy the token and turn on these privileged intents:
   - **Server Members Intent** (welcome messages, auto roles, logs)
   - **Message Content Intent** (edit/delete logs; optional, see `ENABLE_MESSAGE_CONTENT`)
2. **Installation** tab → turn on **Guild Install** and **User Install**. User Install lets people use `/remind`, `/help` and more anywhere.
3. Invite the bot with the `bot` and `applications.commands` scopes:

```
https://discord.com/oauth2/authorize?client_id=YOUR_CLIENT_ID&scope=bot+applications.commands&permissions=564358971255862
```

### 3. Install and configure

```bash
git clone https://github.com/<you>/clanky.git
cd clanky
npm install
cp .env.example .env   # then fill it in
```

### 4. Register commands and run

```bash
npm run deploy:commands   # to DEV_GUILD_ID if set, otherwise globally
npm run dev               # hot reload with tsx
```

For production:

```bash
npm run build
npm run deploy:commands:prod
npm start
```

## 🔐 Environment variables

| Variable | Required | Description |
| --- | --- | --- |
| `DISCORD_TOKEN` | ✅ | Bot token |
| `DISCORD_CLIENT_ID` | ✅ | Application ID |
| `DEV_GUILD_ID` | | Register commands to one server instantly while developing |
| `MONGODB_URI` | ✅ | MongoDB connection string |
| `MONGODB_DB_NAME` | | Database name (default `clanky`) |
| `MONGODB_WATCH_CHANGES` | | `true` to refresh the settings cache from change streams. Needs a replica set or Atlas. |
| `NODE_ENV` | | `development` / `production` |
| `LOG_LEVEL` | | `debug` / `info` / `warn` / `error` |
| `OWNER_IDS` | | Comma-separated owner user IDs |
| `SUPPORT_URL` | | Adds a Support button to `/about` |
| `ENABLE_MESSAGE_CONTENT` | | `false` to run without the Message Content intent |
| `DASHBOARD_ENABLED` | | `false` to turn the website off (default `true`) |
| `DASHBOARD_PORT` | | Port for the website and API (default `3000`) |
| `DASHBOARD_HOST` | | Bind address (default `0.0.0.0`) |
| `DASHBOARD_URL` | | Public URL of the dashboard, used for the OAuth redirect (default `http://localhost:3000`) |
| `DISCORD_CLIENT_SECRET` | | OAuth2 client secret. Needed for "Log in with Discord" |
| `DASHBOARD_SESSION_SECRET` | | 32+ random characters. Signs cookies and encrypts tokens. If missing, a random one is used and logins reset on restart |
| `DASHBOARD_TRUST_PROXY` | | `true` behind a reverse proxy (Nginx, Cloudflare) |

Clanky validates every variable when it starts and shows a clear list of anything missing or wrong.

---

## 🧱 Project structure

```
src/
├── index.ts                 # Entry point: env → database → login
├── client/Clanky.ts         # Client with command/component registries
├── config/
│   ├── env.ts               # Zod-validated environment
│   ├── version.ts           # Version system (reads package.json)
│   └── changelog.ts         # Release notes for /about and announcements
├── core/
│   ├── router.ts            # Routes every interaction (commands, autocomplete, components, modals)
│   ├── types.ts             # Typed definers: slashCommand, guildSlashCommand, guildComponents…
│   ├── customId.ts          # "prefix:action:args" custom ID helpers
│   ├── builders.ts          # Install contexts (server-only vs. everywhere)
│   ├── announcements.ts     # "What's new" posts after updates
│   └── time.ts, permissions.ts, cooldowns.ts, logger.ts
├── database/
│   ├── connection.ts
│   └── models/              # Guild, User, Member, Case, Ticket, Suggestion, Reminder, RolePanel, SettingsAudit, GamePlayer
├── services/                # Data layer with no Discord dependencies (reusable by the dashboard)
├── settings/
│   ├── schema.ts            # ⭐ Guild settings + user preferences schemas (single source of truth)
│   └── registry.ts          # Module metadata for navigation
├── games/salvage/data.ts    # ⭐ Salvage content: zones, items, rarities, tools, balance
├── render/                  # Image cards drawn with @napi-rs/canvas (rank, leaderboard, finds)
├── ui/
│   ├── emojis.json          # ⭐ Every emoji Clanky uses
│   ├── emoji.ts             # emoji('success') / componentEmoji('ticket')
│   ├── components.ts        # Container design system: panel(), notice(), v2()…
│   ├── respond.ts           # Reply helpers that handle deferred/replied states
│   └── theme.ts             # Colors
├── events/index.ts          # Gateway events
├── modules/                 # Feature modules (commands + components)
│   ├── core/ settings/ moderation/ tickets/ roles/ suggestions/
│   └── leveling/ reminders/ polls/ automod/ logging/ welcome/
└── scripts/deploy-commands.ts
assets/fonts/                # Poppins (SIL Open Font License) used by the image cards
assets/icons/           # Twemoji item icons (CC-BY 4.0)
```

## 🎮 Salvage

Clanky's own game. Press **🔧 Dig** and Clanky digs through the scrap for something good.

- **Loot**: 44 items across 4 zones, from 🔩 Rusty Bolt (Common) to ☄️ Comet Shard (Legendary). 1 in 150 finds is ✨ shiny and worth 5×.
- **Progress**: every find gives game XP. Levels unlock new zones (Junk City at 10, Robot Graveyard at 25, Space Dump at 50) and pay credits.
- **Shop** with six sections:
  - **Black Market**: 3 personal deals a day and a hot item that sells for 3×
  - **Upgrades**: Turbo Motor, Metal Detector, Haggler, Golem Armor (10 levels each)
  - **Boosts**: Lucky Charm, XP Battery, Golem Bait
  - **Crates**: Rusty, Golden, Cosmic, with odds shown
  - **Tools**: better luck, XP and double finds
  - **Cosmetics**: profile themes and titles. Badges are earned by playing.
- **Events**: sometimes a 👾 Scrap Golem (fight or run) or a 📦 Mystery Crate shows up.
- **Streaks**: the first dig of each day gives a bonus that grows with your streak.
- **Leaderboards**: `/salvage top` for this server or the whole world. Progress is global.
- **Image screens**: finds, events, profile, bag, shop and collection are all image cards. Each card shows your bag, credits, zone and active boosts at the bottom.

Balance and content live in [`src/games/salvage/data.ts`](src/games/salvage/data.ts). Add an item by adding one line and dropping its Twemoji SVG in `assets/icons/`. All game logic is in `SalvageService` (no Discord code), so the dashboard can reuse it. Loot writes are atomic, so button spam can't duplicate items.

## 😀 Custom emojis

Every emoji is defined in [`src/ui/emojis.json`](src/ui/emojis.json):

```json
"success": { "id": null, "name": "success", "fallback": "✅", "animated": false }
```

While `id` is `null`, the Unicode `fallback` is used. To use your own emoji, upload it as an **application emoji** in the Developer Portal, then set its `id` and `name`. No code changes are needed.

## 🏷️ Versioning

- `package.json` → `version` is the single source of truth, using SemVer with a channel: `0.1.0-beta.1`.
- `npm run release:beta` bumps the beta build (`0.1.0-beta.2`). `npm run release:minor` starts the next minor beta.
- Add a matching entry to `src/config/changelog.ts`.
- On startup, Clanky posts **What's new** in servers that picked an update notes channel and haven't seen the version yet. Users who turned on update notices get a one-time note after their next command.

## 🖥️ Dashboard

The dashboard is Clanky's home on the web. It runs **inside the bot process**: one `npm start` serves the bot, the API and the website, so every save reaches Discord right away.

- **Stack:** React 19, Vite, Tailwind CSS 4, Motion, TanStack Query (in `dashboard/`). The API is Fastify (in `src/dashboard/`).
- **Pages:** homepage with live message mockups, server picker, server overview (stats, 14-day activity, modules, recent cases, leaderboards), every settings section with live previews, change history, your preferences, and your Salvage profile, bag and collection.
- **One settings contract.** The API validates with the same Zod schema as the bot (`settings/schema.ts`) and saves through the same services, so changes are audited with source `dashboard`.

### Setup

1. Developer Portal → **OAuth2** → copy the **Client Secret** into `DISCORD_CLIENT_SECRET`.
2. Add the redirect URL `${DASHBOARD_URL}/api/auth/callback`, e.g. `http://localhost:3000/api/auth/callback`.
3. Set `DASHBOARD_SESSION_SECRET` (for example `openssl rand -base64 48`).
4. `npm install` also installs the dashboard (postinstall). Then `npm run build && npm start` and open `http://localhost:3000`.

### Developing the website

```bash
npm run dev             # bot + API on :3000
npm run dashboard:dev   # Vite on :5173 with hot reload, proxies /api to :3000
```

For OAuth while using Vite, set `DASHBOARD_URL=http://localhost:5173` and add `http://localhost:5173/api/auth/callback` as a redirect.

`npm run dashboard:demo` builds a static preview with sample data (`dashboard/dist-demo`), no bot or login needed.

### Dashboard versioning

The website has its own version, separate from the bot:

- Source of truth: `dashboard/package.json` → `version` (`0.1.0-alpha.1`, codename **Scrapyard**).
- `npm run dashboard:release` bumps the alpha build. Add a matching entry to `dashboard/changelog.json` (shown on the Changelog page) and `dashboard/CHANGELOG.md`.
- Git tags use the `dashboard-v` prefix (`dashboard-v0.1.0-alpha.1`). Bot tags stay `v…`.
- The footer and `/api/meta` show both versions.

## 🛠️ Scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Run with hot reload |
| `npm run build` | Compile the bot to `dist/` and build the dashboard |
| `npm run build:bot` | Compile only the bot |
| `npm run dashboard:dev` | Dashboard dev server with hot reload |
| `npm run dashboard:build` | Build the dashboard to `dashboard/dist` |
| `npm run dashboard:demo` | Static demo build with sample data |
| `npm run dashboard:release` | Bump the dashboard alpha version |
| `npm start` | Run the compiled bot |
| `npm run typecheck` | Type-check without emitting |
| `npm run deploy:commands` | Register commands (`-- --global`, `-- --clear`) |
| `npm run release:beta` | Bump the beta version |

## 📄 License

MIT
