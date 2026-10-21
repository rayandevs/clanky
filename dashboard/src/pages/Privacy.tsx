import LegalDocument, { LegalItem, LegalList, LegalParagraph, type LegalSection } from './LegalDocument';

const sections: LegalSection[] = [
  {
    id: 'operator-and-scope',
    title: 'Who operates Clanky and what this covers',
    body: <>
      <LegalParagraph>Clanky is software that can be run by different people or organizations; it is not necessarily one centrally hosted service. The person or organization that runs the Clanky bot and dashboard you use is the “Operator” of that deployment. The Operator controls its hosting, database, configuration, support contact, and applicable privacy responsibilities. If you run your own copy, you are the Operator for that copy.</LegalParagraph>
      <LegalParagraph>This policy describes information the current Clanky software may handle when you interact with its Discord bot or web dashboard. An Operator may change the software, add integrations, or apply different retention practices. Ask the Operator of your instance for its identity, contact details, and any deployment-specific practices. Discord separately processes information under its own terms and privacy policy.</LegalParagraph>
    </>,
  },
  {
    id: 'information-we-handle',
    title: 'Information Clanky may handle',
    body: <>
      <LegalParagraph>The information involved depends on which commands and modules are enabled, what people submit, the permissions granted to Clanky, and how the Operator configured it. It may include:</LegalParagraph>
      <LegalList>
        <LegalItem><strong className="text-text">Discord account and server identifiers:</strong> Discord user, server, channel, and role IDs; usernames, display names and avatars; server names and icons; and permission or membership information needed to provide a requested feature. The dashboard’s Discord sign-in requests the <code className="rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-[12px] text-rust-200">identify</code> and <code className="rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-[12px] text-rust-200">guilds</code> scopes.</LegalItem>
        <LegalItem><strong className="text-text">Server configuration:</strong> module settings, selected channels and roles, custom messages, AutoMod configuration, role panels, and records of settings changes, including the actor and before/after values.</LegalItem>
        <LegalItem><strong className="text-text">Feature records:</strong> moderation cases and reasons; message reports with reporter and target IDs, the message link, up to 1,000 characters of captured message text, and optional reporter details; appeal statements and staff decisions; private case notes; ticket topics, form answers, staff actions and transcripts; suggestions, votes and review notes; reminders and their text, due time and delivery destination; and role-panel configuration.</LegalItem>
        <LegalItem><strong className="text-text">Leveling and game progress:</strong> XP, levels, message and XP counts, daily message/XP aggregates, season scores, and Clanky’s Salvage progress (such as inventory, finds, streaks, upgrades and leaderboard associations).</LegalItem>
        <LegalItem><strong className="text-text">Messages, files and other submitted content:</strong> content people send to commands, forms, tickets, suggestions, reminders, the dashboard feedback form or other features. A member report saves a short snapshot of the reported message and any details the reporter adds, even if server message logging is off. Appeal statements are also saved for the moderation team. Feedback notes and ratings are sent to the Operator’s configured Discord webhook and are not stored in Clanky’s database. Clanky does not keep a general archive of every chat message as part of leveling; it counts activity and stores no message text for that feature. If server logging is enabled, selected message, membership, moderation, server-change and integration events can be stored as evidence, grouped into incident timelines and delivered to configured Discord channels. The Operator may choose whether message text or attachment details are recorded and how long each event category is retained. New-account link detection examines message content in memory but stores a count and event details, not the message text. Message text selected for recording is also sent to its Discord log channel, where that channel’s Discord permissions apply. Dashboard search and access to sensitive evidence can be limited to configured server roles. Ticket transcripts can include message text, component text, embeds, attachment names and metadata, and copies of attachments.</LegalItem>
        <LegalItem><strong className="text-text">Feedback request metadata:</strong> submitting dashboard feedback requires Discord sign-in and affirmative acknowledgement. The feedback webhook receives the submitter’s Discord user ID, username/display name, rating and note, current dashboard page, submission time, source IP address and browser user-agent. Session IDs, cookies and OAuth tokens are not included. The dashboard also uses the source IP for rate limiting.</LegalItem>
        <LegalItem><strong className="text-text">Dashboard session and operational information:</strong> a signed, HttpOnly session cookie and short-lived OAuth state cookie; a server-side session record; login and error events; and technical information that may appear in the Operator’s web-server, database, or infrastructure logs.</LegalItem>
      </LegalList>
      <LegalParagraph>Clanky’s dashboard code uses essential authentication cookies and does not configure advertising cookies or an analytics tracker. An Operator or hosting provider could add separate tools or logging; ask that Operator about any additions.</LegalParagraph>
    </>,
  },
  {
    id: 'how-information-is-used',
    title: 'How information is used',
    body: <>
      <LegalParagraph>The Operator and Clanky use relevant information to run requested bot and dashboard features; authenticate dashboard users; check access to servers, settings and ticket transcripts; apply server settings; deliver reminders, moderation actions and configured notifications; calculate XP, leaderboards and game progress; maintain settings history; prevent abuse, investigate errors and protect the service; and meet applicable legal obligations.</LegalParagraph>
      <LegalParagraph>Clanky’s code does not sell personal information or use it to serve advertisements. Feature data is used to deliver the feature and is visible to people with the relevant Discord permissions or dashboard access, as configured by the server’s administrators.</LegalParagraph>
    </>,
  },
  {
    id: 'legal-bases',
    title: 'Legal bases where applicable',
    body: <>
      <LegalParagraph>Where privacy law requires a legal basis, the Operator may rely on providing the requested service, the legitimate interests of operating and securing a community tool, consent where required (for example, for optional features or information submitted voluntarily), or compliance with legal obligations. The appropriate basis depends on the Operator, the feature, and the circumstances. The Operator is responsible for determining and documenting the basis applicable to its deployment.</LegalParagraph>
    </>,
  },
  {
    id: 'sharing',
    title: 'When information is shared',
    body: <>
      <LegalParagraph>Information may be shared with or made available to:</LegalParagraph>
      <LegalList>
        <LegalItem><strong className="text-text">Discord:</strong> Clanky communicates with Discord to receive interactions and provide bot or dashboard features. If an Operator configures the feedback form, the acknowledged rating, note, account identity and request metadata are delivered to the Operator’s Discord webhook and are then subject to Discord’s policies and that Operator’s Discord access and retention choices.</LegalItem>
        <LegalItem><strong className="text-text">The Operator and hosting providers:</strong> the Operator’s configured MongoDB/database, hosting, network, backup, and monitoring providers may process information to run the instance. The Operator chooses those providers.</LegalItem>
        <LegalItem><strong className="text-text">People authorized in a server:</strong> server owners, administrators, moderators, ticket staff, and other members may see information placed in channels, cases, tickets, logs, suggestions, or leaderboards according to Discord permissions and the server’s settings.</LegalItem>
        <LegalItem><strong className="text-text">Authorities or successors:</strong> information may be disclosed when the Operator reasonably believes disclosure is legally required, necessary to protect rights or safety, or part of a lawful transfer of the operation.</LegalItem>
      </LegalList>
      <LegalParagraph>The current software has no feature for selling personal information. It also does not send data to an advertising network as part of its standard configuration.</LegalParagraph>
    </>,
  },
  {
    id: 'retention',
    title: 'Retention and deletion',
    body: <>
      <LegalParagraph>Retention depends on the data type and the Operator’s configuration. In the current code, dashboard sessions expire after 14 days; MongoDB cleanup may occur shortly after the expiry time. Settings-change history is configured to expire after 90 days. Closed dashboard ticket transcripts and their archived attachments use the server’s selected retention setting: 30, 90, 180, or 365 days, or “forever”; the current default is 90 days. Message reports and appeal statements use a separate server setting of 30, 90, 180, or 365 days; the current default is 180 days. Expiration cleanup is performed by MongoDB and may not happen at the exact expiry instant.</LegalParagraph>
      <LegalParagraph>Other server records—including moderation cases and their private staff notes, suggestions, ticket records, settings, or activity/season records—may remain in the Operator’s database until the Operator removes them or applies another retention practice. Report and appeal expiry does not delete the underlying Discord message or copies already posted to Discord. Leaving a Discord server or removing the bot does not necessarily erase database records. Discord messages and copies in Discord channels are controlled separately by Discord and the relevant server administrators.</LegalParagraph>
      <LegalParagraph>Logged-in users can request deletion of Clanky account-level data using <strong className="text-text">/preferences → Delete my data</strong> in Discord, or the dashboard’s personal-data deletion control. In the current implementation, this removes the user preference/profile record, per-server leveling records, reminders, global Salvage progress, and dashboard sessions. It does not automatically remove daily activity aggregates, historical seasonal leveling scores, guild-level moderation cases, reports or appeals, ticket and transcript records, suggestions, settings history, Discord messages, or copies held by the Operator, Discord, or infrastructure backups. Contact the server or instance Operator to ask about those records.</LegalParagraph>
      <LegalParagraph>Operators may retain information longer when needed to keep records, resolve disputes, enforce rules, protect the service, comply with law, or restore backups. Their backup and infrastructure-log deletion schedules may differ from the application’s database expiry settings.</LegalParagraph>
    </>,
  },
  {
    id: 'your-choices',
    title: 'Your choices and privacy rights',
    body: <>
      <LegalParagraph>You can use Clanky’s preference controls to change private replies, level-up pings, update notices, and reminder delivery. You can avoid submitting optional information, stop interacting with a feature, or ask a server administrator to disable a module or remove Clanky. Dashboard access can be ended with Log out; a stored session also expires after its configured lifetime.</LegalParagraph>
      <LegalParagraph>Depending on where you live, applicable law may give you rights to access, correct, delete, restrict, object to, or receive a copy of certain information, or to withdraw consent. Contact the Operator of the instance first; the relevant server administrator may control server-specific records. You may also have the right to complain to a privacy regulator. These rights are subject to legal exceptions and do not necessarily delete information held independently by Discord or other parties.</LegalParagraph>
    </>,
  },
  {
    id: 'security-and-transfers',
    title: 'Security and international processing',
    body: <>
      <LegalParagraph>The dashboard stores session identifiers server-side as hashes and encrypts Discord OAuth tokens in its database using AES-256-GCM. Browser session cookies are signed and marked HttpOnly and SameSite=Lax; they are marked Secure when the configured dashboard URL uses HTTPS. These are implementation safeguards, not a guarantee that every Operator’s deployment, host, secrets, network or database is secure. Operators should use HTTPS, protect their secrets, restrict database access, and maintain suitable backups.</LegalParagraph>
      <LegalParagraph>The Operator and its providers may process or store information in countries different from yours. The Operator is responsible for selecting providers and applying any transfer safeguards required by applicable law. No method of transmission or storage is completely secure.</LegalParagraph>
    </>,
  },
  {
    id: 'children',
    title: 'Children and age requirements',
    body: <>
      <LegalParagraph>You must meet Discord’s minimum age requirement and any higher age requirement that applies where you live. Clanky does not intentionally request special categories of sensitive information. Do not submit sensitive personal information unless it is genuinely necessary for a server feature and you are authorized to do so. If you believe a child has provided personal information to a deployment without required authorization, contact that deployment’s Operator.</LegalParagraph>
    </>,
  },
  {
    id: 'changes-and-contact',
    title: 'Changes and contact',
    body: <>
      <LegalParagraph>This policy may be updated as the software or deployment changes. The date above shows the most recent revision of this page; Operators should review it against any modifications or additional services they use. Continued use after an update means the updated notice applies to future use, subject to any notice or consent required by law.</LegalParagraph>
      <LegalParagraph>For questions, requests, or complaints about information handled by a particular Clanky deployment, contact the person or organization that operates that bot/dashboard instance or the relevant Discord server administrator. If you self-host Clanky, you are responsible for publishing a contact method and responding to requests for your deployment.</LegalParagraph>
    </>,
  },
];

export default function Privacy() {
  return (
    <LegalDocument
      eyebrow="Privacy · How data is handled"
      title="Privacy policy"
      introduction="A clear guide to the information Clanky may process, why it is used, how long it may be kept, and what choices you have."
      lastUpdated="October 19, 2026"
      notice={<LegalParagraph>Clanky can be self-hosted. The operator of the specific bot and dashboard instance—not the software name alone—controls that deployment’s data, hosting and contact details. This page describes the current project code and cannot describe additional changes made by an individual Operator.</LegalParagraph>}
      sections={sections}
    />
  );
}
