let gameState = { score: 0, selectedCountry: null };
let currentQuestionIndex = 0;
let currentQuestions = [];
let answered = false;

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

    fetch(`https://restcountries.com/v3.1/name/${countryName}`)
        .then(res => res.json())
        .then(data => {
            const country = data[0];
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

    return [
        {
            question: `What is the capital of ${country.name.common}?`,
            correct: capital,
            options: shuffle([capital, "Paris", "Tokyo", "Ottawa"])
        },
        {
            question: `What region is ${country.name.common} in?`,
            correct: country.region,
            options: shuffle([country.region, "Asia", "Africa", "Europe"])
        },
        {
            question: `What is the population of ${country.name.common}?`,
            correct: country.population.toLocaleString(),
            options: shuffle([
                country.population.toLocaleString(),
                "10 million",
                "50 million",
                "100 million"
            ])
        },
        {
            question: `What is the currency of ${country.name.common}?`,
            correct: currency,
            options: shuffle([currency, "Dollar", "Euro", "Yen"])
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

    document.getElementById('quizCountry').innerText = countryName;
    document.getElementById('quizModal').classList.remove('hidden');

    renderQuestion();
}

// Render Question
function renderQuestion() {
    answered = false;

    const container = document.getElementById('questionContainer');
    const q = currentQuestions[currentQuestionIndex];

    container.innerHTML = `<h3>${q.question}</h3>`;

    q.options.forEach(opt => {
        const btn = document.createElement('button');
        btn.innerText = opt;

        btn.onclick = () => checkAnswer(opt, q.correct, btn);

        container.appendChild(btn);
    });
}

// Check Answer
function checkAnswer(selected, correct, button) {
    if (answered) return;
    answered = true;

    if (selected === correct) {
        gameState.score++;
        button.style.backgroundColor = "green";
    } else {
        button.style.backgroundColor = "red";
    }

    document.getElementById('score').innerText = `Score: ${gameState.score}`;
}

// Next button
document.getElementById('nextBtn').onclick = () => {
    if (!answered) return; // force answer before next

    currentQuestionIndex++;

    if (currentQuestionIndex < currentQuestions.length) {
        renderQuestion();
    } else {
        document.getElementById('quizModal').classList.add('hidden');
    }
};

// Close button
document.getElementById('closeBtn').onclick = () => {
    document.getElementById('quizModal').classList.add('hidden');
};