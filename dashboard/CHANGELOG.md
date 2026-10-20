# Dashboard changelog

The dashboard has its own version, separate from the bot. Tags use the `dashboard-v` prefix.

## Unreleased

## 0.1.0-beta.5 · Rench · 2026-10-21

- Expanded the Logging guide with clear setup steps, event categories, channel routing, exclusions, and default settings
- Explained message and attachment privacy, reader access, retention choices, risk signals, and the limits of evidence hashes
- Added practical Incident Center instructions for searching records, reviewing incidents, retrying delivery, and fixing missing logs

## 0.1.0-beta.4 · Rench · 2026-10-20

- Added an Incident Center for grouped risk signals, chronological event timelines, affected-object references, review notes, and status updates
- Search and filter activity records, inspect integrity checks, and retry logs Discord could not deliver
- Separate log readers from sensitive-evidence readers, with message-content and attachment details hidden from unauthorized roles
- Refined affected member, channel, role, and actor references into readable chips with direct Discord links where available

## 0.1.0-beta.3 · Rench · 2026-10-19

- Kept Save and Reset controls in view in a fixed side panel while editing server settings
- Added an animated collapse-to-side-tab control; the panel stays tucked away until edits are saved or reset

## 0.1.0-beta.2 · Rench · 2026-10-19

- Added a searchable Help Center inside the dashboard, with guides for core bot features, server setup, and dashboard workflows
- Guides include shareable links, keyboard search, topic browsing, contents navigation, related articles, and clear numbered steps and callouts
- Fixed a route-transition cleanup issue that could replace pages with the dashboard error screen

## 0.1.0-beta.1 · Rench · 2026-10-19

- Added a sign-in-required feedback page and a randomized prompt with cooldown, dismissal, and a permanent opt-out
- Deliver 1–5 star ratings and notes through a server-only Discord webhook with account/IP throttles, validation, and mention suppression
- Disclose and require acknowledgement for Discord profile, page, timestamp, source IP, and user-agent metadata; session IDs, cookies, and tokens are excluded
- Moved dashboard releases from Alpha to Beta; the dashboard codename is now Rench

## 0.1.0-alpha.9 · Scrapyard · 2026-10-19

- Replaced scroll-linked background effects with a static glow, reduced backdrop blur, and changed route transitions to avoid expensive filters
- Added a branded lazy-route fallback, a top-level render error screen, and a guarded recovery reload for stale JavaScript chunks
- Revalidate HTML/SPA responses while keeping fingerprinted assets immutable; debounce search, slider persistence, and Canvas previews

## 0.1.0-alpha.8 · Scrapyard · 2026-10-18

- Welcome card previews now show the exact Canvas image produced by the bot, updating as event settings change
- Template colors, labels, custom backgrounds, avatar, and member details stay in sync between preview and sent card

## 0.1.0-alpha.7 · Scrapyard · 2026-10-18

- Split Welcome administration into Join and Leave tabs with independent channels, formats, templates, custom backgrounds, and live previews
- Configure member mentions, bot handling, avatars, server names, member counts, and screening-delayed greetings
- Upload and preview normalized event-specific background artwork from the dashboard

## 0.1.0-alpha.6 · Scrapyard · 2026-10-17

- Search and filter the suggestions queue, inspect review workload and vote trends, and save decisions with notes
- Browse reviewer history and send meaningful status updates to suggestion authors
- Retry suggestions that failed to publish to Discord
- Configure categories, anonymity, per-member open limits, cooldowns, and daily or weekly reviewer digests

## 0.1.0-alpha.5 · Scrapyard · 2026-10-16

- Added public Privacy Policy and Terms of Service pages with a shared, dashboard-matched legal layout
- Added footer-only links to both pages and direct routes at `/privacy` and `/terms`
- Documented current self-hosted deployment, data handling, retention, deletion scope, and service terms

## 0.1.0-alpha.4 · Scrapyard · 2026-10-16

- Leveling workspace with progression previews, channel and role boosts, rank-card styling, and a member reward preview
- Activity charts for messages, XP, and active members, plus message-sorted top chatters and top XP gainers
- Preview-before-sync role maintenance and manual seasons with live seasonal standings and reviewed winner rewards

## 0.1.0-alpha.3 · Scrapyard · 2026-10-16

- Search closed ticket transcripts and review intake answers, messages, embeds, and permission-checked attachment archives retained for the configured period
- Ticket staff can access transcripts for panels whose configured roles they hold; Manage Server users retain full guild access
- Ticket settings include per-server transcript retention and a Dashboard-only custom panel-image upload
- Ticket-opening information is consolidated into one summary image and container

## 0.1.0-alpha.2 · Scrapyard · 2026-10-16

- Rebuilt ticket settings around a dedicated panel list and focused panel editor
- Configure panel-specific forms and routing, shared topics, and up to three separate entry points
- Reorder questions, preview the posted panel and modal, and publish or refresh a tracked panel after saving

## 0.1.0-alpha.1 · Scrapyard · 2026-10-15

First light 🔦

- Log in with Discord
- Every server setting in one place
- Server overview with stats and history
- Your Salvage profile, bag and collection
- Personal preferences
