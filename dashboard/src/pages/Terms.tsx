import LegalDocument, { LegalItem, LegalList, LegalParagraph, type LegalSection } from './LegalDocument';

const sections: LegalSection[] = [
  {
    id: 'agreement',
    title: 'Agreement and service operator',
    body: <>
      <LegalParagraph>These Terms of Service (“Terms”) apply when you use the Clanky Discord bot, its web dashboard, or related features (together, the “Service”). By using the Service, you agree to these Terms. If you do not agree, do not use the Service.</LegalParagraph>
      <LegalParagraph>Clanky is software that may be run by different individuals or organizations. The person or organization operating the particular bot and dashboard instance you use is the “Operator” and is responsible for that deployment. If you self-host the software, you are the Operator. The Operator may publish additional terms or notices for its instance; if they conflict with these Terms, applicable mandatory law controls and the Operator should identify which terms apply.</LegalParagraph>
    </>,
  },
  {
    id: 'eligibility-and-authority',
    title: 'Eligibility and authority',
    body: <>
      <LegalParagraph>You must meet Discord’s minimum age requirement and any higher age requirement that applies to you. If you use Clanky for a server, organization, or other person, you confirm that you have authority to bind that party to these Terms and to configure the Service on its behalf.</LegalParagraph>
      <LegalParagraph>You are responsible for complying with laws applicable to you, your community, and your use of Discord. Do not submit information that you are not authorized to provide.</LegalParagraph>
    </>,
  },
  {
    id: 'service-and-third-parties',
    title: 'The Service and third-party platforms',
    body: <>
      <LegalParagraph>Clanky provides optional Discord community tools, which may include settings management, moderation records, reports, tickets and transcripts, role panels, suggestions, leveling, reminders, polls, logging, and game features. Features depend on the Operator’s configuration, the bot’s permissions, Discord availability, and the software version in use. The Operator may enable, disable, change, or discontinue features.</LegalParagraph>
      <LegalParagraph>Clanky relies on Discord and may rely on the Operator’s database, hosting, or other providers. Those services are controlled by their respective providers and are subject to their own terms, policies, outages, and technical limits. The Operator is not responsible for independent third-party services, except to the extent applicable law says otherwise. Your use of Discord remains subject to Discord’s terms and policies.</LegalParagraph>
    </>,
  },
  {
    id: 'accounts-and-permissions',
    title: 'Accounts, authorization, and permissions',
    body: <>
      <LegalParagraph>The dashboard uses Discord sign-in. You authorize Clanky to request the Discord information and access needed for the dashboard features you choose to use. You are responsible for your Discord account and for keeping access to it secure. Dashboard access is limited by the Discord account’s current server membership, permissions, and configured staff roles.</LegalParagraph>
      <LegalParagraph>Server administrators are responsible for reviewing the bot permissions and dashboard access they grant, choosing channels and roles, and promptly removing access that is no longer appropriate. Clanky’s permission checks do not replace an administrator’s review of their server or Discord’s permission system.</LegalParagraph>
    </>,
  },
  {
    id: 'administrator-responsibilities',
    title: 'Responsibilities of server administrators',
    body: <>
      <LegalParagraph>If you install, configure, or administer Clanky for a server, you agree to:</LegalParagraph>
      <LegalList>
        <LegalItem>Use only permissions reasonably needed for the features you enable, and keep bot access, staff roles, dashboard access and configured channels under review.</LegalItem>
        <LegalItem>Tell members what moderation, logging, ticket transcript, leveling, reminder, and other features are enabled when notice is required or appropriate; obtain any consents or authorizations required by applicable law.</LegalItem>
        <LegalItem>Configure ticket transcript retention and access deliberately. Transcripts may contain private messages, form answers, embeds, and attachments; only authorized staff should access them.</LegalItem>
        <LegalItem>Use moderation records, reports, logs, and user-submitted content responsibly; verify information before taking consequential action against a member.</LegalItem>
        <LegalItem>Respond to member requests concerning server-held records and provide the privacy contact for your instance. Removing the bot or deleting a user’s personal Clanky profile does not necessarily erase guild-level records.</LegalItem>
      </LegalList>
    </>,
  },
  {
    id: 'acceptable-use',
    title: 'Acceptable use',
    body: <>
      <LegalParagraph>You may not use or encourage others to use the Service to:</LegalParagraph>
      <LegalList>
        <LegalItem>Break the law, violate Discord’s rules, infringe another person’s rights, or facilitate harassment, threats, discrimination, exploitation, or abuse.</LegalItem>
        <LegalItem>Attempt to access an account, server, dashboard, database, or information without authorization, bypass access controls, probe or disrupt systems, or interfere with the Service or Discord.</LegalItem>
        <LegalItem>Send malware, spam, deceptive content, or material designed to exploit or harm users; misuse reminders, reports, ticket forms, or other communication features.</LegalItem>
        <LegalItem>Use Clanky’s moderation, logging, or data features to unlawfully surveil, dox, discriminate against, or retaliate against people, or to collect more information than your legitimate community purpose requires.</LegalItem>
        <LegalItem>Reverse engineer or modify a hosted instance to evade security or access controls. This does not limit rights granted by the applicable open-source license for the Clanky source code.</LegalItem>
      </LegalList>
    </>,
  },
  {
    id: 'content-and-license',
    title: 'Your content and the software license',
    body: <>
      <LegalParagraph>You keep any rights you have in messages, form answers, suggestions, settings, files, and other content you submit. You grant the Operator a limited, non-exclusive permission to host, store, reproduce, transmit, display, and process that content as reasonably necessary to operate the features you or your server use, protect the Service, and comply with law. This permission ends when the content is deleted from the relevant systems, subject to retained records, backups, legal obligations, and copies outside the Operator’s control.</LegalParagraph>
      <LegalParagraph>The Clanky source repository identifies the software as MIT-licensed. Any rights to use, copy, modify, or distribute the software are governed by the applicable open-source license, not replaced by these Terms. This does not grant rights to Discord’s platform, branding, or other third-party materials.</LegalParagraph>
    </>,
  },
  {
    id: 'privacy-and-data',
    title: 'Privacy and data',
    body: <>
      <LegalParagraph>The Operator’s handling of information is described in the Privacy Policy and any deployment-specific notice. Because Clanky can be self-hosted, the Operator chooses the hosting, database, providers, configuration, and retention practices for its deployment. The Operator is responsible for providing any disclosures and handling requests required by applicable law.</LegalParagraph>
      <LegalParagraph>Some dashboard and account-level data can be removed with the personal-data deletion control or <strong className="text-text">/preferences → Delete my data</strong>. That control does not remove every guild-level record, Discord copy, or backup. Contact the relevant Operator or server administrator for other requests.</LegalParagraph>
    </>,
  },
  {
    id: 'availability-and-changes',
    title: 'Availability, changes, and support',
    body: <>
      <LegalParagraph>The Service is provided on an “as available” basis. No particular uptime, support response time, feature, compatibility, data recovery, or future development is promised. The Operator may update, suspend, limit, or discontinue an instance or feature, including for maintenance, security, legal compliance, Discord changes, or misuse.</LegalParagraph>
      <LegalParagraph>Clanky may change these Terms as the software or deployment evolves. The revised date above indicates the latest version of this page. Continued use after revised Terms are made available constitutes acceptance to the extent permitted by law. If you do not accept a change, stop using the Service and ask the Operator about account or server-data removal.</LegalParagraph>
    </>,
  },
  {
    id: 'suspension-and-termination',
    title: 'Suspension and termination',
    body: <>
      <LegalParagraph>You may stop using Clanky at any time, remove it from your server, or log out of the dashboard. The Operator may suspend or end access where reasonably necessary to address violations, security risks, legal requirements, or operation of the instance. Sections that by their nature should continue—including provisions about content permissions already exercised, disclaimers, limitations, and disputes—continue to apply after use ends.</LegalParagraph>
      <LegalParagraph>Ending use does not automatically delete information already stored, messages or transcripts copied into Discord, or records held by third parties. See the Operator’s privacy notice and contact the Operator about deletion requests.</LegalParagraph>
    </>,
  },
  {
    id: 'disclaimers',
    title: 'Disclaimers',
    body: <>
      <LegalParagraph>To the maximum extent allowed by law, the Service and related software are provided “as is” and “as available,” without warranties or conditions of any kind, whether express, implied, or statutory, including warranties of merchantability, fitness for a particular purpose, non-infringement, accuracy, availability, or error-free operation.</LegalParagraph>
      <LegalParagraph>Clanky is a tool, not legal, safety, or professional advice. Automated moderation and logs may be incomplete or inaccurate. Server administrators remain responsible for reviewing outputs, decisions, and configurations. Nothing in these Terms excludes a warranty or right that cannot legally be excluded.</LegalParagraph>
    </>,
  },
  {
    id: 'liability',
    title: 'Limitation of liability',
    body: <>
      <LegalParagraph>To the maximum extent permitted by law, the Operator and the people who develop, maintain, or contribute to Clanky will not be liable for indirect, incidental, special, consequential, exemplary, or punitive damages, or for lost profits, data, goodwill, or service interruption arising from or related to the Service, even if advised such harm could occur.</LegalParagraph>
      <LegalParagraph>To the maximum extent permitted by law, the aggregate liability of the Operator and those contributors for claims relating to the Service will not exceed the greater of the amount you paid the Operator for the Service during the 12 months before the event giving rise to the claim or US$10. If applicable law does not allow a limit or exclusion, it applies only to the fullest extent the law permits. Nothing in these Terms limits liability that cannot lawfully be limited.</LegalParagraph>
    </>,
  },
  {
    id: 'law-and-disputes',
    title: 'Applicable law and disputes',
    body: <>
      <LegalParagraph>Contact the Operator first to try to resolve a concern informally. The applicable law and forum may depend on the Operator and the deployment. These Terms do not select a particular jurisdiction or remove consumer protections, mandatory rights, or dispute procedures that apply under your local law.</LegalParagraph>
    </>,
  },
  {
    id: 'contact',
    title: 'Contact',
    body: <>
      <LegalParagraph>Questions about these Terms should be directed to the person or organization operating the Clanky instance you use, or to the administrator of the Discord server where it is installed. If you self-host Clanky, you are responsible for publishing an appropriate contact method for your users.</LegalParagraph>
    </>,
  },
];

export default function Terms() {
  return (
    <LegalDocument
      eyebrow="Terms · Rules of the road"
      title="Terms of Service"
      introduction="The terms that apply when you use Clanky’s Discord bot, dashboard, and community features."
      notice={<LegalParagraph>Clanky can be self-hosted. The person or organization running your specific bot and dashboard instance is its Operator and is responsible for its deployment. These Terms do not replace Discord’s terms or the open-source license for the software.</LegalParagraph>}
      sections={sections}
    />
  );
}
