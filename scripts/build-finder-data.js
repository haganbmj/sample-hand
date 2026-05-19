#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const INPUT_PATH = path.join(__dirname, '..', 'docs', 'finder', 'default-cards.json');
const OUTPUT_PATH = path.join(__dirname, '..', 'docs', 'finder', 'finder-data.json');

const EXCLUDED_SET_TYPES = new Set(['token', 'memorabilia', 'vanguard', 'minigame']);

function normalize(name) {
  // NFD decompose, strip combining marks (diacritics), lowercase
  return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function priceValue(p) {
  if (p === null || p === undefined) return Infinity;
  return parseFloat(p);
}

// Stream-parse the top-level JSON array line by line.
// The Scryfall bulk export is a JSON array with one object per line after the opening bracket.
async function* streamCards(filePath) {
  const rl = readline.createInterface({
    input: fs.createReadStream(filePath, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });
  for await (const line of rl) {
    const trimmed = line.trim();
    // Skip array brackets and empty lines
    if (trimmed === '[' || trimmed === ']' || trimmed === '') continue;
    // Remove trailing comma if present
    const jsonStr = trimmed.endsWith(',') ? trimmed.slice(0, -1) : trimmed;
    try {
      yield JSON.parse(jsonStr);
    } catch (e) {
      // Skip unparseable lines (shouldn't happen with valid Scryfall data)
    }
  }
}

async function main() {
  console.log('Reading default-cards.json...');
  let totalCards = 0;

  const sets = {};
  const cards = {};
  const aliases = {};

  for await (const card of streamCards(INPUT_PATH)) {
    totalCards++;
    // Filter: English only, exclude certain set types, exclude digital-only
    if (card.lang !== 'en') continue;
    if (EXCLUDED_SET_TYPES.has(card.set_type)) continue;
    if (card.digital) continue;

    const setCode = card.set;
    const setName = card.set_name;
    const releasedAt = card.released_at;

    // Register set metadata
    if (!sets[setCode]) {
      sets[setCode] = { name: setName, released_at: releasedAt };
    }

    const cardName = card.name;
    const key = normalize(cardName);
    const priceUsd = card.prices?.usd ?? null;
    const priceEur = card.prices?.eur ?? null;
    const isPromo = card.promo || false;
    const colors = (card.colors || []).join('');

    // Initialize card entry
    if (!cards[key]) {
      cards[key] = { name: cardName, colors, sets: {} };
    }

    // Keep cheapest promo and cheapest non-promo per card/set pair
    if (!cards[key].sets[setCode]) {
      cards[key].sets[setCode] = {};
    }
    const bucket = isPromo ? 'promo' : 'regular';
    const existing = cards[key].sets[setCode][bucket];
    if (!existing) {
      cards[key].sets[setCode][bucket] = { usd: priceUsd, eur: priceEur };
    } else {
      const existingVal = priceValue(existing.usd);
      const newVal = priceValue(priceUsd);
      if (newVal < existingVal) {
        cards[key].sets[setCode][bucket] = { usd: priceUsd, eur: priceEur };
      }
    }

    // Build aliases for split/adventure cards (names containing " // ")
    if (cardName.includes(' // ')) {
      const parts = cardName.split(' // ');
      for (const part of parts) {
        const partKey = normalize(part);
        if (partKey !== key) {
          aliases[partKey] = key;
        }
      }
    }
  }

  // Convert card sets from object to array for smaller JSON
  const cardsOut = {};
  for (const [key, entry] of Object.entries(cards)) {
    const setsArr = [];
    for (const [setCode, buckets] of Object.entries(entry.sets)) {
      if (buckets.regular) {
        setsArr.push({ set: setCode, usd: buckets.regular.usd, eur: buckets.regular.eur });
      }
      if (buckets.promo) {
        setsArr.push({ set: setCode, usd: buckets.promo.usd, eur: buckets.promo.eur, promo: true });
      }
    }
    cardsOut[key] = { name: entry.name, colors: entry.colors || undefined, sets: setsArr };
  }

  console.log(`Loaded ${totalCards} cards`);

  const output = { sets, cards: cardsOut, aliases };
  const json = JSON.stringify(output);

  fs.writeFileSync(OUTPUT_PATH, json, 'utf8');
  const sizeMB = (Buffer.byteLength(json, 'utf8') / 1024 / 1024).toFixed(1);
  console.log(`Written finder-data.json (${sizeMB} MB)`);
  console.log(`  Cards: ${Object.keys(cardsOut).length}`);
  console.log(`  Sets: ${Object.keys(sets).length}`);
  console.log(`  Aliases: ${Object.keys(aliases).length}`);
}

main();
