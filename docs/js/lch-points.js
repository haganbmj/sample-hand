(() => {
    function normalizeCardName(cardName) {
        return cardName
            // Convert diacritics down.
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
    
            // Use all double slashes for split cards. ex. Fire / Ice => Fire // Ice
            // As of right now split cards are the only ones using slashes, so hopefully this is safe?
            .replace(/([^/])\/([^/])/g, '$1//$2')
    
            // Normalize a space before and after the double slashes in split cards.
            .replace(/([^/])\s*\/\/\s*([^/])/g, '$1 // $2')
    
            // Actually, fuck it. Just use the first part of the split card name.
            .replace(/\s\/\/.+/g, '')
    
            // Fix those dumb apostrophes.
            .replace(/’/g, `'`)
    
            // Normalize case.
            .toLowerCase();
    }
    
    const points = {};
    const pointElements = document.querySelectorAll('#points a:not(.header)');

    for (const row of pointElements) {
        const pointing = row.querySelectorAll('div')[0].textContent;
        const name = row.querySelectorAll('div')[1].textContent;

        points[normalizeCardName(name)] = parseInt(pointing);
    }

    document.querySelector('#decklist-submit').addEventListener('click', () => {
        const decklist = document.querySelector('#decklist-input').value;
        const decklistOutput = document.querySelector('#decklist-output');
        const decklistErrors = document.querySelector('#decklist-errors');
        const errors = [];
        let totalPoints = 0;

        decklistOutput.innerHTML = '';
        decklistErrors.innerHTML = '';

        for (let line of decklist.split('\n')) {
            line = line.trim();

            // Different sites have different sideboard formats.
            // Look for the word "sideboard" or lines that start with a double slash and skip them.
            if (/Sideboard/i.test(line) || /^\/\//.test(line) || line === '') {
                continue;
            }

            // Extract the quantity and card name.
            // Cockatrice prefixes lines with "SB:" for sideboard cards, so optionally matching that.
            // MTGA's export format puts the set and collector number in the line. ex. Arid Mesa (ZEN) 211
            let extract = /^(?:SB:\s)?(?:(\d+)?x?\s)?([^(]+)(?:\s\(.+\) .+)?$/i.exec(line);
            if (extract === null) {
                console.warn(`Failed to parse line: ${line}`);
                continue;
            }

            let [, quantity, inputCardName] = extract;

            if (quantity === undefined) {
                quantity = 1;
            }

            // parseInt should be safe here since it's a digit extraction,
            // decimal numbers will just get roped into the cardName and fail.
            if (parseInt(quantity) <= 0) {
                continue;
            }

            const cardName = normalizeCardName(inputCardName);

            const cardLookup = points[cardName];

            if (cardLookup) {
                const d = document.createElement('div');
                d.innerHTML = `<div class="bg-gray text-dark s-rounded centered px-1"><b class="bg-dark text-light s-rounded centered px-1">${cardLookup}</b> ${inputCardName}</div>`;
                decklistOutput.appendChild(d);
                totalPoints += cardLookup;
            }
        }

        const d = document.createElement('div');
        d.innerHTML = `<div class="${totalPoints > 13 ? 'bg-error' : 'bg-success'} text-light s-rounded centered px-1"><b>${totalPoints} Total Points</b></div>`;
        decklistOutput.appendChild(d);
    });
})();
