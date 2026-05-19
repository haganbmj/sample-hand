let finderData = null;
let currentView = 'card';
let currentCurrency = 'usd';
let allExpanded = false;
let maxPrice = null;
let includePromos = true;
let matchedCards = []; // Array of { key, name, qty, sets: [{set, usd, eur, promo}] }

// --- Normalization ---

function normalize(name) {
    return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

// --- Data Loading ---

async function loadFinderData() {
    if (finderData) return finderData;
    const response = await fetch('./finder-data.json');
    finderData = await response.json();
    return finderData;
}

// --- Input Parsing ---

function parseInput(text) {
    const lines = text.split('\n');
    const entries = {}; // normalized key -> { name, qty }

    for (let line of lines) {
        line = line.trim();
        if (!line) continue;

        let qty = 1;
        let name = line;

        // Match optional quantity prefix: "4 Name", "2x Name", "3X Name"
        const qtyMatch = line.match(/^(\d+)x?\s+(.+)$/i);
        if (qtyMatch) {
            qty = parseInt(qtyMatch[1], 10);
            name = qtyMatch[2].trim();
        }

        const key = normalize(name);
        if (entries[key]) {
            entries[key].qty += qty;
        } else {
            entries[key] = { name, qty };
        }
    }

    return entries;
}

// --- Lookup ---

function lookupCards(entries, data) {
    const results = [];
    const unmatched = [];

    for (const [key, entry] of Object.entries(entries)) {
        let cardKey = key;

        // Direct match
        if (!data.cards[cardKey]) {
            // Try alias
            if (data.aliases[cardKey]) {
                cardKey = data.aliases[cardKey];
            }
        }

        if (data.cards[cardKey]) {
            const card = data.cards[cardKey];
            results.push({
                key: cardKey,
                name: card.name,
                colors: card.colors || '',
                qty: entry.qty,
                sets: card.sets,
            });
        } else {
            unmatched.push(entry.name);
        }
    }

    return { results, unmatched };
}

// --- Rendering ---

function handleSubmit() {
    const input = document.getElementById('card-input').value;
    const entries = parseInput(input);

    if (Object.keys(entries).length === 0) return;

    const btn = document.getElementById('submit-btn');
    btn.classList.add('loading');

    loadFinderData().then(data => {
        btn.classList.remove('loading');

        const { results, unmatched } = lookupCards(entries, data);
        matchedCards = results;

        showWarnings(unmatched);
        document.getElementById('controls').classList.remove('hide');
        renderCurrentView();
    });
}

function showWarnings(unmatched) {
    const el = document.getElementById('warnings');
    if (unmatched.length === 0) {
        el.style.display = 'none';
        el.innerHTML = '';
        return;
    }
    el.style.display = '';
    el.innerHTML = `<button class="btn btn-clear float-right" onclick="dismissWarnings()"></button>
        No matches found for: ${unmatched.map(n => `<strong>${escapeHtml(n)}</strong>`).join(', ')}`;
}

function dismissWarnings() {
    const el = document.getElementById('warnings');
    el.style.display = 'none';
    el.innerHTML = '';
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// --- View Switching ---

function switchView(view) {
    currentView = view;
    document.getElementById('tab-by-card').classList.toggle('active', view === 'card');
    document.getElementById('tab-by-set').classList.toggle('active', view === 'set');
    document.getElementById('card-sort-select').style.display = view === 'card' ? '' : 'none';
    document.getElementById('set-sort-select').style.display = view === 'set' ? '' : 'none';
    allExpanded = false;
    document.getElementById('btn-expand').textContent = 'Expand All';
    renderCurrentView();
}

function setCurrency(currency) {
    currentCurrency = currency;
    document.getElementById('btn-usd').classList.toggle('active', currency === 'usd');
    document.getElementById('btn-eur').classList.toggle('active', currency === 'eur');
    renderCurrentView();
}

function handleSortChange() {
    renderCurrentView();
}

function handleMaxPriceChange() {
    const val = document.getElementById('max-price').value;
    maxPrice = val !== '' ? parseFloat(val) : null;
    renderCurrentView();
}

function handlePromoToggle() {
    includePromos = document.getElementById('btn-promos').classList.toggle('active');
    renderCurrentView();
}

function getFilteredSets(sets) {
    // Filter by promo toggle
    let filtered = sets;
    if (!includePromos) {
        filtered = filtered.filter(s => !s.promo);
    }

    // Filter by max price
    if (maxPrice !== null) {
        filtered = filtered.filter(s => {
            const price = s[currentCurrency];
            if (price === null) return false;
            return parseFloat(price) <= maxPrice;
        });
    }

    // Deduplicate per set code: keep the cheapest remaining entry per set
    const bySet = {};
    for (const s of filtered) {
        const existing = bySet[s.set];
        if (!existing) {
            bySet[s.set] = s;
        } else {
            const existingPrice = existing[currentCurrency] === null ? Infinity : parseFloat(existing[currentCurrency]);
            const newPrice = s[currentCurrency] === null ? Infinity : parseFloat(s[currentCurrency]);
            if (newPrice < existingPrice) {
                bySet[s.set] = s;
            }
        }
    }
    return Object.values(bySet);
}

function formatPrice(price) {
    if (price === null) return '—';
    const symbol = currentCurrency === 'eur' ? '€' : '$';
    return `${symbol}${price}`;
}

function colorIcons(colors) {
    if (!colors) return '<i class="ms ms-c ms-cost"></i>';
    if (colors.length > 1) return '<i class="ms ms-multicolor ms-cost color-gold"></i>';
    const c = colors.charAt(0).toLowerCase();
    return `<i class="ms ms-${c} ms-cost"></i>`;
}

function toggleExpandAll() {
    allExpanded = !allExpanded;
    document.getElementById('btn-expand').textContent = allExpanded ? 'Collapse All' : 'Expand All';
    const sections = document.querySelectorAll('.result-section');
    sections.forEach(s => s.classList.toggle('expanded', allExpanded));
}

function getExpandedKeys() {
    const keys = new Set();
    document.querySelectorAll('.result-section.expanded').forEach(s => {
        const key = s.getAttribute('data-key');
        if (key) keys.add(key);
    });
    return keys;
}

function restoreExpandedKeys(keys) {
    if (keys.size === 0) return;
    document.querySelectorAll('.result-section').forEach(s => {
        const key = s.getAttribute('data-key');
        if (key && keys.has(key)) s.classList.add('expanded');
    });
}

// --- Render: By Card ---

function renderByCard() {
    const container = document.getElementById('results');
    const cardSortMode = document.getElementById('card-sort-select').value;
    const expandedKeys = getExpandedKeys();
    let html = '';

    let cardsToRender = matchedCards.slice();
    if (cardSortMode === 'alpha') {
        cardsToRender.sort((a, b) => a.name.localeCompare(b.name));
    }

    for (const card of cardsToRender) {
        const filteredSets = getFilteredSets(card.sets);
        if (filteredSets.length === 0) continue;

        const qtyLabel = card.qty > 1 ? `<span class="qty">×${card.qty}</span>` : '';
        const sortedSets = filteredSets.slice().sort((a, b) => {
            const nameA = finderData.sets[a.set]?.name || a.set;
            const nameB = finderData.sets[b.set]?.name || b.set;
            return nameA.localeCompare(nameB);
        });

        html += `<div class="result-section${allExpanded ? ' expanded' : ''}" data-key="card:${escapeHtml(card.name)}">
            <div class="result-section-header" onclick="this.parentElement.classList.toggle('expanded')">
                <span><span class="chevron">&#9654;</span>${colorIcons(card.colors)} ${escapeHtml(card.name)}${qtyLabel}</span>
                <span class="badge-count">${filteredSets.length} sets</span>
            </div>
            <div class="result-section-body">
                <table class="result-table">
                    <colgroup><col class="col-set-name"><col class="col-set-code"><col class="col-price"></colgroup>
                    <thead><tr><th>Set</th><th>Code</th><th class="price">${currentCurrency.toUpperCase()}</th></tr></thead>
                    <tbody>`;

        for (const s of sortedSets) {
            const setInfo = finderData.sets[s.set] || { name: s.set };
            html += `<tr><td>${escapeHtml(setInfo.name)}</td><td>${escapeHtml(s.set.toUpperCase())}</td><td class="price">${formatPrice(s[currentCurrency])}</td></tr>`;
        }

        html += `</tbody></table></div></div>`;
    }

    container.innerHTML = html;
    restoreExpandedKeys(expandedKeys);
}

// --- Render: By Set ---

function renderBySet() {
    const container = document.getElementById('results');
    const sortMode = document.getElementById('set-sort-select').value;
    const expandedKeys = getExpandedKeys();

    // Group cards by set, applying max price filter
    const setMap = {}; // setCode -> [{ name, colors, qty, usd, eur }]
    for (const card of matchedCards) {
        const filteredSets = getFilteredSets(card.sets);
        for (const s of filteredSets) {
            if (!setMap[s.set]) setMap[s.set] = [];
            setMap[s.set].push({ name: card.name, colors: card.colors, qty: card.qty, usd: s.usd, eur: s.eur });
        }
    }

    // Sort sets
    let setEntries = Object.entries(setMap);
    if (sortMode === 'alpha') {
        setEntries.sort((a, b) => {
            const nameA = finderData.sets[a[0]]?.name || a[0];
            const nameB = finderData.sets[b[0]]?.name || b[0];
            return nameA.localeCompare(nameB);
        });
    } else if (sortMode === 'date') {
        setEntries.sort((a, b) => {
            const dateA = finderData.sets[a[0]]?.released_at || '';
            const dateB = finderData.sets[b[0]]?.released_at || '';
            return dateB.localeCompare(dateA);
        });
    } else {
        // matches (default)
        setEntries.sort((a, b) => b[1].length - a[1].length);
    }

    let html = '';
    for (const [setCode, cards] of setEntries) {
        const setInfo = finderData.sets[setCode] || { name: setCode };
        cards.sort((a, b) => a.name.localeCompare(b.name));
        html += `<div class="result-section${allExpanded ? ' expanded' : ''}" data-key="set:${escapeHtml(setCode)}">
            <div class="result-section-header" onclick="this.parentElement.classList.toggle('expanded')">
                <span><span class="chevron">&#9654;</span>${escapeHtml(setInfo.name)} <small>(${escapeHtml(setCode.toUpperCase())})</small></span>
                <span class="badge-count">${cards.length} cards</span>
            </div>
            <div class="result-section-body">
                <table class="result-table">
                    <colgroup><col class="col-card-name"><col class="col-qty"><col class="col-price"></colgroup>
                    <thead><tr><th>Card</th><th>Qty</th><th class="price">${currentCurrency.toUpperCase()}</th></tr></thead>
                    <tbody>`;

        for (const c of cards) {
            html += `<tr><td>${colorIcons(c.colors)} ${escapeHtml(c.name)}</td><td>${c.qty}</td><td class="price">${formatPrice(c[currentCurrency])}</td></tr>`;
        }

        html += `</tbody></table></div></div>`;
    }

    container.innerHTML = html;
    restoreExpandedKeys(expandedKeys);
}

function renderCurrentView() {
    if (currentView === 'card') {
        renderByCard();
    } else {
        renderBySet();
    }
}
