# Agent Instructions

## Project Overview

Static website (griselbrand.com) providing Magic: The Gathering tools — primarily a sample hand generator, plus documentation for custom MTG formats (Hacks 1.25, Low Country Highlander). Hosted via GitHub Pages from the `docs/` directory.

## Tech Stack

- **Pure static site** — vanilla HTML/CSS/JS, no build tools, no package manager, no framework
- **CSS**: [Spectre.css](https://picturepan2.github.io/spectre/) v0.5.9 (vendored in `docs/css/spectre.css`)
- **External API**: [Scryfall API](https://scryfall.com/docs/api) for card images and data
- **Theming**: CSS custom properties with light/dark toggle (dark theme uses Nord palette)

## Local Development

```bash
# Serve locally — no build step needed
python3 -m http.server --directory docs 8000
# or
npx http-server docs
```

No tests exist in this project.

## Project Structure

| Path | Purpose |
|------|---------|
| `docs/` | Website root (GitHub Pages serves from here) |
| `docs/sample-hand/` | Main feature: deck shuffler & hand generator |
| `docs/sample-hand/js/sample-hand.js` | Core logic — deck parsing, Fisher-Yates shuffle, Scryfall card fetching |
| `docs/js/scryfall.js` | Shared Scryfall image tooltip handler (XHR-based, IIFE pattern) |
| `docs/js/lch-points.js` | LCH format points calculator with card name normalization |
| `docs/css/dark-theme.css` | Dark theme (Nord palette via CSS custom properties) |
| `docs/hacks125/`, `docs/lch/` | Format documentation pages |

## Conventions

- **Vanilla JS only** — no transpilation, no modules, no classes. Functional style with global state variables.
- **camelCase** for JS functions/variables
- **HTML `<template>` elements** with `cloneNode(true)` for dynamic DOM generation
- **Decklist format**: lines matching `^(\d+)x? (.+)$` — stops at `// Sideboard`
- **Scryfall image caching**: fetched images stored in `resolvedImages` object (session-only)
- **Keyboard shortcuts**: 'S' = shuffle, 'D' = draw (suppressed when textarea focused)

## Key Constraints

- No build step — all JS must be browser-compatible ES6+ (no imports/exports)
- Scryfall API has rate limits — respect caching, avoid unnecessary fetches
- Each page (sample-hand, hacks125, lch) is self-contained with its own CSS/JS
- Spectre.css is vendored — do not modify directly; override in page-specific CSS files
