let existingRawDecklist = "";
let deck = [];
let library = [];
let resolvedImages = {};

let cardTemplate = document.querySelector('#card-template');
let handElement = document.querySelector('#hand');
let shuffleElement = document.querySelector('#shuffle');

// Fisher-Yates Shuffle.
function shuffle(array) {
    let arr = array.slice(0);
    let counter = arr.length;

    while (counter > 0) {
        let index = Math.floor(Math.random() * counter);
        counter--;

        let el = arr[counter];
        arr[counter] = arr[index];
        arr[index] = el;
    }

    return arr;
}

async function getCardImage(cardName) {
    const lowerCardName = cardName.toLowerCase();

    if (!resolvedImages[lowerCardName]) {
        // https://api.scryfall.com/cards/named?fuzzy=lightning+bolt&face=front&format=image
        let response = await fetch('https://api.scryfall.com/cards/named?' + new URLSearchParams({
            format: 'json',
            face: 'front',
            fuzzy: cardName
        }));

        if (!response.ok) {
            console.error(`Failed to fetch card image for: ${cardName}`);
            resolvedImages[lowerCardName] = './img/card_back.jpg';
        } else {
            let json = await response.json();
            resolvedImages[lowerCardName] = json.image_uris.normal;
        }
    }

    return resolvedImages[lowerCardName];
}

async function addCardToHand(cardName) {
    let cardElement = cardTemplate.content.cloneNode(true);
    let cardElementName = cardElement.querySelector('.card-name');
    let cardElementImage = cardElement.querySelector('.card-image');

    cardElementName.textContent = cardName;
    cardElementName.dataset.tooltip = cardName;
    cardElementImage.alt = cardName;
    
    handElement.appendChild(cardElement);

    const cardImage = await getCardImage(cardName);
    if (cardImage) {
        cardElementImage.src = cardImage;

        if (cardImage !== './img/card_back.jpg') {
            cardElementName.style.visibility = 'hidden';
        }
    }
}

function readDecklist() {
    let rawDecklist = document.querySelector('#deck-input').value.split('\n');

    // Dirty check the input field just to save some console logs, etc.
    if (JSON.stringify(rawDecklist) === existingRawDecklist) {
        return;
    }

    deck = [];
    existingRawDecklist = JSON.stringify(rawDecklist);

    for (let line in rawDecklist) {
        let extract = /^(\d+)x? (.+)$/.exec(rawDecklist[line]);
        if (extract === null) {
            console.warn(`Failed to parse line ${line}: ${rawDecklist[line]}`);
            continue;
        }

        let [_, quantity, cardName] = extract;
        deck = deck.concat(Array(parseInt(quantity)).fill(cardName));
    }
}

function draw(n = 1) {
    while(n-- && library.length > 0) {
        let cardName = library.shift();
        addCardToHand(cardName);
    }
}

function shuffleAndDeal() {
    handElement.innerHTML = '';
    readDecklist();
    library = shuffle(deck);
    draw(7);
}