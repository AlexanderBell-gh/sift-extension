// Structural asserts for the store registry. No DOM, no test framework:
// `node scripts/check-config.ts`.
import assert from 'node:assert/strict';
import {
  DEFAULT_EXPIRY,
  DEFAULT_FIELDS,
  STORE_CONFIG,
  detectStoreByHost,
  getStoreMatches,
  LOYALTY_LABELS,
  type StoreConfig,
} from '../src/lib/store-config.ts';

const MODES = ['standard', 'asda-rollback', 'morrisons-promo'];

for (const field of ['title', 'image', 'price', 'was', 'loyaltyPrice', 'storage'] as const) {
  assert.ok(DEFAULT_FIELDS[field].length > 0, `DEFAULT_FIELDS.${field} is empty`);
}
assert.ok(DEFAULT_EXPIRY.selectors.length > 0, 'DEFAULT_EXPIRY has no selectors');
assert.ok(DEFAULT_EXPIRY.patterns.length > 0, 'DEFAULT_EXPIRY has no patterns');
assert.ok(DEFAULT_EXPIRY.gate === true, 'DEFAULT_EXPIRY must stay gated');

const assertSelectors = (owner: string, list: string[] | undefined) => {
  if (list === undefined) return;
  assert.ok(Array.isArray(list) && list.length > 0, `${owner} is an empty list`);
  for (const selector of list) {
    assert.equal(typeof selector, 'string', `${owner} contains a non-string`);
    assert.ok(selector.trim(), `${owner} contains a blank selector`);
  }
};

for (const [key, store] of Object.entries(STORE_CONFIG)) {
  const owner = `STORE_CONFIG.${key}`;
  assert.equal(key, store.id, `${owner}.id is "${store.id}"`);

  const config = store as StoreConfig;
  assert.ok(config.name && config.logo, `${owner} needs name + logo`);
  assert.ok(config.hosts.length > 0, `${owner} needs hosts`);
  assert.ok(config.matches.length > 0, `${owner} needs matches`);
  assert.ok(
    MODES.includes(config.mode ?? 'standard'),
    `${owner}.mode "${config.mode}" is not one of ${MODES.join(', ')}`
  );

  for (const field of ['title', 'image', 'price', 'was', 'loyaltyPrice', 'storage', 'alert', 'exclude'] as const) {
    assertSelectors(`${owner}.${field}`, config[field]);
  }
  assertSelectors(`${owner}.imageNoExclude`, config.imageNoExclude);

  if (config.hero) {
    assertSelectors(`${owner}.hero.selectors`, config.hero.selectors);
    for (const marker of ['loyalty', 'offer', 'price'] as const) {
      assert.ok(config.hero.score[marker], `${owner}.hero.score.${marker} is empty`);
    }
  }
  if (config.expiry) {
    assertSelectors(`${owner}.expiry.selectors`, config.expiry.selectors);
    assert.ok(config.expiry.patterns.length > 0, `${owner}.expiry needs patterns`);
    assert.ok(
      config.expiry.patterns.every((p) => p.source.includes('(')),
      `${owner}.expiry patterns need a capture group for the date`
    );
  }

  // Effective field lists (own selectors prepended to the shared defaults).
  for (const field of ['title', 'image', 'price'] as const) {
    const effective = (config[field]?.length ?? 0) + DEFAULT_FIELDS[field].length;
    assert.ok(effective > 0, `${owner} has no ${field} selectors`);
  }

  for (const host of config.hosts) {
    assert.equal(detectStoreByHost(`www.${host}`)?.id, config.id, `${owner} host ${host} does not resolve`);
    assert.notEqual(detectStoreByHost(`not${host}`), store, `${owner} host ${host} over-matches`);
  }
}

const matches = getStoreMatches();
assert.ok(matches.length > 0, 'getStoreMatches() is empty');
assert.ok(!matches.some((m) => m.includes('ocado')), 'Ocado is still in the store matches');

assert.deepEqual(LOYALTY_LABELS, {
  Tesco: 'Clubcard',
  "Sainsbury's": 'Nectar',
  Morrisons: 'More Card',
  'Co-op': 'Member',
  Waitrose: 'My Waitrose',
  ASDA: 'Rollback',
});

assert.equal(detectStoreByHost('example.com'), null, 'unknown host resolved to a store');

console.log(`store-config ok: ${Object.keys(STORE_CONFIG).length} stores, ${matches.length} matches`);
