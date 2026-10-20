import assert from 'node:assert/strict';
import test from 'node:test';
import { HELP_ARTICLES, HELP_CATEGORIES, helpSearchText, searchHelpArticles } from '../dashboard/src/content/help.js';

test('Help Center articles have unique route slugs and meaningful sections', () => {
  const slugs = HELP_ARTICLES.map((article) => article.slug);
  assert.equal(new Set(slugs).size, slugs.length, 'article slugs should be unique');
  assert.ok(HELP_ARTICLES.length >= 12, 'the initial guide library should cover the main Clanky features');

  for (const article of HELP_ARTICLES) {
    assert.ok(article.title.trim(), `${article.slug} needs a title`);
    assert.ok(article.summary.trim(), `${article.slug} needs a summary`);
    assert.ok(HELP_CATEGORIES.some((category) => category.id === article.category), `${article.slug} needs a valid category`);
    assert.ok(article.sections.length > 0, `${article.slug} needs at least one section`);
    const ids = article.sections.map((section) => section.id);
    assert.equal(new Set(ids).size, ids.length, `${article.slug} section ids should be unique`);
    for (const section of article.sections) {
      assert.ok(section.title.trim(), `${article.slug} has an untitled section`);
      assert.ok(section.blocks.length > 0, `${article.slug}/${section.id} needs content`);
      for (const block of section.blocks) {
        if (block.type === 'steps') {
          assert.ok(block.items.length > 0, `${article.slug}/${section.id} has an empty steps list`);
          for (const step of block.items) assert.ok(step.title.trim() && step.body.trim(), `${article.slug}/${section.id} has an incomplete step`);
        } else if (block.type === 'list') {
          assert.ok(block.items.length > 0, `${article.slug}/${section.id} has an empty list`);
        }
      }
    }
  }
});

test('Help Center search text includes practical phrases from guide body copy and keywords', () => {
  const textFor = (slug: string) => helpSearchText(HELP_ARTICLES.find((article) => article.slug === slug)!);
  assert.match(textFor('first-steps'), /add clanky/);
  assert.match(textFor('suggestions'), /anonymous/);
  assert.match(textFor('server-history-and-transcripts'), /transcripts/);
  assert.match(textFor('leveling-and-ranks'), /cooldown/);
  assert.match(textFor('common-fixes'), /commands missing/);
  assert.match(textFor('logging-and-change-history'), /not proof of misconduct/);
  assert.match(textFor('logging-and-change-history'), /three or more channel deletions/);
  assert.match(textFor('logging-and-change-history'), /sensitive-evidence readers/);
  assert.match(textFor('logging-and-change-history'), /no channel/);
});

test('Help Center search ranks exact guide titles and filters by topic', () => {
  assert.equal(searchHelpArticles('welcome').at(0)?.slug, 'welcome-messages');
  assert.ok(searchHelpArticles('ticket transcript').some((article) => article.slug === 'server-history-and-transcripts'));
  assert.ok(searchHelpArticles('spam', 'safety').some((article) => article.slug === 'automod'));
  const communityResults = searchHelpArticles('ticket', 'community');
  assert.ok(communityResults.some((article) => article.slug === 'tickets'));
  assert.ok(communityResults.every((article) => article.category === 'community'));
  assert.ok(searchHelpArticles('incident evidence', 'safety').some((article) => article.slug === 'logging-and-change-history'));
  assert.ok(searchHelpArticles('message content intent', 'safety').some((article) => article.slug === 'logging-and-change-history'));
  assert.ok(searchHelpArticles('retry delivery', 'safety').some((article) => article.slug === 'logging-and-change-history'));
  assert.equal(searchHelpArticles('no matching guide phrase').length, 0);
});
