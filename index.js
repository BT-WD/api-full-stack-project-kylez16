import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDeWkRADhhBol2OubhIgVDn4rmwQB4CKAA",
  authDomain: "fullstackproject-8c475.firebaseapp.com",
  databaseURL: "https://fullstackproject-8c475-default-rtdb.firebaseio.com",
  projectId: "fullstackproject-8c475",
  storageBucket: "fullstackproject-8c475.firebasestorage.app",
  messagingSenderId: "855684649103",
  appId: "1:855684649103:web:7d58505497cdc18be0e0fa"
};




const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

function getUserId() {
    let id = localStorage.getItem("userId");
    if (!id) {
        id = crypto.randomUUID();
        localStorage.setItem("userId", id);
    }
    return id;
}

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
        ? normalizeCurrency(Object.values(country.currencies)[0].name)
        : "Unknown";
    // Build pools
    const capitalPool = allCountries.map(c => c.capital?.[0]).filter(Boolean);
    const currencyPool = [
        ...new Set(
            allCountries
                .map(c => {
                    if (!c.currencies) return null;
                    const first = Object.values(c.currencies)[0];
                    return normalizeCurrency(first?.name);
                })
                .filter(Boolean)
        )
    ];
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
            saveUserData(userId);
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

function normalizeCurrency(name) {
    if (!name) return null;

    const lower = name.toLowerCase();

    if (lower.includes("euro")) return "Euro";
    if (lower.includes("dollar")) return "Dollar";

    return name
        .toLowerCase()
        .split(" ")
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
}

function getTodaySeed() {
    const today = new Date();
    return `${today.getFullYear()}-${today.getMonth()+1}-${today.getDate()}`;
}

async function fetchDailyTrivia() {
    const seed = getTodaySeed();

    // Store last fetched seed
    const storedSeed = localStorage.getItem("dailySeed");

    if (storedSeed === seed) {
        return JSON.parse(localStorage.getItem("dailyQuestions"));
    }

    const res = await fetch(`https://opentdb.com/api.php?amount=5&type=multiple`);
    const data = await res.json();

    const questions = data.results.map(q => {
        const options = shuffle([
            ...q.incorrect_answers,
            q.correct_answer
        ]);

        return {
            question: decodeHTML(q.question),
            correct: decodeHTML(q.correct_answer),
            options: options.map(decodeHTML)
        };
    });

    // Save for the day
    localStorage.setItem("dailySeed", seed);
    localStorage.setItem("dailyQuestions", JSON.stringify(questions));

    return questions;
}

function decodeHTML(str) {
    const txt = document.createElement("textarea");
    txt.innerHTML = str;
    return txt.value;
}

document.getElementById('dailyBtn').onclick = async () => {
    const today = getTodaySeed();



    const questions = await fetchDailyTrivia();

    // Mark as completed after starting
    localStorage.setItem("dailyCompleted", today);

    showQuiz(questions, "Daily Trivia");
};

async function saveUserData(userId) {
    await setDoc(doc(db, "users", userId), {
        score: gameState.score,
        lastPlayed: new Date().toISOString()
    });
}

async function loadUserData(userId) {
    const docRef = doc(db, "users", userId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
        const data = docSnap.data();
        gameState.score = data.score || 0;
        document.getElementById('score').innerText = `Score: ${gameState.score}`;
    }
}

const userId = getUserId();
loadUserData(userId);
localStorage.setItem("dailyCompleted", getTodaySeed());