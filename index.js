let gameState = { score: 0, selectedCountry: null };
let currentQuestionIndex = 0;
let currentQuestions = [];
let answered = false;
let allCountries = [];
let allCorrect = true;


fetch('https://restcountries.com/v3.1/all?fields=name,capital,region,currencies,population,flags')
    .then(res => res.json())
    .then(data => {
        if (Array.isArray(data)) {
            allCountries = data;
        } else {
            console.error("Unexpected response from restcountries API:", data);
        }
    })
    .catch(() => {
        allCountries = [];
    });
// Initialize 3D Globe
const globe = Globe()(document.getElementById('globeViz'))
    .globeImageUrl('//unpkg.com/three-globe/example/img/earth-dark.jpg')
    .polygonSideColor(() => 'rgba(0, 0, 0, 0.1)')
    .polygonStrokeColor(() => '#444')
    .onPolygonClick(handleCountryClick);

globe.polygonCapColor(d => {
    return gameState.selectedCountry === d
        ? 'rgba(42, 197, 42, 0.7)'
        : 'rgba(100, 100, 100, 0.3)';
});

// Click handler
function handleCountryClick(polygon) {
    gameState.selectedCountry = polygon;

    const countryName = polygon.properties.name;
    fetch(`https://restcountries.com/v3.1/name/${countryName}?fields=name,capital,region,currencies,population,flags`)
        .then(res => res.json())
        .then(data => {
            const country = Array.isArray(data) && data[0];
            if (!country) {
                console.error("No country found for:", countryName);
                return;
            }
            showQuiz(generateQuestions(country), country.name.common);
        })
        .catch(err => console.error("Country fetch failed:", err));

    globe.polygonsData(globe.polygonsData());
}

// Load GeoJSON
fetch('https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson')
    .then(res => res.json())
    .then(countries => {
        globe.polygonsData(countries.features);
        globe.width(window.innerWidth);
        globe.height(window.innerHeight);
    })
    .catch(err => console.error("GeoJSON load failed:", err));

// Resize
window.onresize = () => {
    globe.width(window.innerWidth);
    globe.height(window.innerHeight);
};

// Generate Questions 
function generateQuestions(country) {
    const capital = country.capital ? country.capital[0] : "Unknown";
    const currency = country.currencies
        ? Object.values(country.currencies)[0].name
        : "Unknown";

    // Build pools
    const capitalPool = allCountries.map(c => c.capital?.[0]).filter(Boolean);
    const regionPool = [...new Set(allCountries.map(c => c.region))];
    const currencyPool = allCountries.map(c => {
        if (!c.currencies) return null;
        const first = Object.values(c.currencies)[0];
        return first?.name ?? null;  // guard against currencies object having no entries
    }).filter(Boolean);
    const flagPool = allCountries
    .filter(c => c.flags?.png)
    .map(c => ({
        name: c.name.common,
        flag: c.flags.png
    }));
    return [
        {
            question: `What is the capital of ${country.name.common}?`,
            correct: capital,
            options: shuffle([
                capital,
                ...getRandomItems(capitalPool, 3, capital)
            ])
        },
        {
            question: `Which flag belongs to ${country.name.common}?`,
            type: "flag",
            correct: country.flags.png,
            options: shuffle([
                country.flags.png,
                ...getRandomItems(flagPool.map(f => f.flag), 3, country.flags.png)
            ])
        },
        {
            question: `What is the population of ${country.name.common}?`,
            correct: formatPopulation(country.population),
            options: shuffle([
                formatPopulation(country.population),
                ...generateNearbyPopulations(country.population, 3)
            ])
        },
        {
            question: `What is the currency of ${country.name.common}?`,
            correct: currency,
            options: shuffle([
                currency,
                ...getRandomItems(currencyPool, 3, currency)
            ])
        }
    ];
}

// Shuffle
function shuffle(arr) {
    return [...arr].sort(() => Math.random() - 0.5);
}

// Show Quiz
function showQuiz(questions, countryName) {
    currentQuestions = questions;
    currentQuestionIndex = 0;
    allCorrect = true; 

    document.getElementById('quizCountry').innerText = countryName;
    document.getElementById('quizModal').classList.remove('hidden');

    renderQuestion();
}

// Render Question
function renderQuestion() {
    answered = false;

    const container = document.getElementById('questionContainer');
    const q = currentQuestions[currentQuestionIndex];

    container.innerHTML = `<h3 class="question">${q.question}</h3>`;

    const optionsWrapper = document.createElement('div');
    optionsWrapper.className = "options-grid";
q.options.forEach(opt => {
    const btn = document.createElement('button');
    btn.className = "option-btn";

    btn.dataset.value = opt; 

    if (q.type === "flag") {
        const img = document.createElement('img');
        img.src = opt;
        img.className = "flag-img";
        btn.appendChild(img);
    } else {
        btn.innerText = opt;
    }

    btn.onclick = () => checkAnswer(btn.dataset.value, q.correct, btn);
    optionsWrapper.appendChild(btn);
});

    container.appendChild(optionsWrapper);
}

// Check Answer
function checkAnswer(selected, correct, button) {
    if (answered) return;
    answered = true;

    const buttons = document.querySelectorAll('#questionContainer button');

    buttons.forEach(btn => {
        if (btn.dataset.value === correct) {
            btn.style.backgroundColor = "green";
        }
    });

    if (selected !== correct) {
        button.style.backgroundColor = "red";
        allCorrect = false;
    }
}
// Next button
document.getElementById('nextBtn').onclick = () => {
    if (!answered) return;

    currentQuestionIndex++;

    if (currentQuestionIndex < currentQuestions.length) {
        renderQuestion();
    } else {
        // Quiz finished
        if (allCorrect) {
            gameState.score++;
        }

        document.getElementById('score').innerText = `Score: ${gameState.score}`;
        document.getElementById('quizModal').classList.add('hidden');
    }
};

// Close button
document.getElementById('closeBtn').onclick = () => {
    document.getElementById('quizModal').classList.add('hidden');
};

function formatPopulation(input) {
    // Remove commas if it's a string
    const num = typeof input === "string"
        ? Number(input.replace(/,/g, ""))
        : input;

    if (num >= 1_000_000_000) {
        return Math.round(num / 1_000_000_000) + " billion";
    } else if (num >= 1_000_000) {
        return Math.round(num / 1_000_000) + " million";
    } else if (num >= 1_000) {
        return Math.round(num / 1_000) + " thousand";
    } else {
        return num.toString();
    }
}

function getRandomItems(arr, count, exclude) {
    const filtered = arr.filter(item => item !== exclude && item != null);
    return shuffle(filtered).slice(0, count);
}

function generateNearbyPopulations(population, count) {
    const results = new Set();
    const correct = formatPopulation(population);

    while (results.size < count) {
        const factor = 0.5 + Math.random() * 1.5;
        const value = formatPopulation(Math.round(population * factor));

        if (value !== correct) {
            results.add(value); // Set prevents duplicates
        }
    }

    return Array.from(results);
}