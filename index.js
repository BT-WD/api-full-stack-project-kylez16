import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
let countryResults = {};
let activeCountry = null;
let dailyScore = 0;



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
    const name = d.properties.name;
    const result = countryResults[normalizeName(name)];

    if (result === "correct") {
        return 'rgba(42, 197, 42, 0.7)'; // green
    }
    if (result === "wrong") {
        return 'rgba(197, 42, 42, 0.7)'; // red
    }

    return 'rgba(100, 100, 100, 0.3)'; // default
});
// Click handler
function handleCountryClick(polygon) {
    gameState.selectedCountry = polygon;

    const countryName = polygon.properties.name;

    // If this country was already clicked today, do nothing
    const key = normalizeName(countryName);

    if (countryResults[key]) {
        return; // already completed
    }
    const saved = loadQuizSession();

    if (saved && saved.country === key) {
        currentQuestions = saved.questions;
        currentQuestionIndex = saved.currentQuestionIndex;
        allCorrect = saved.allCorrect;

        document.getElementById('quizCountry').innerText = countryName;
        document.getElementById('quizModal').classList.remove('hidden');

        renderQuestion();
        return;
    }

    fetchCountryData(countryName)
        .then(country => {
            if (!country) {
                console.error("No country found for:", countryName);
                return;
            }

            activeCountry = normalizeName(countryName);
            showQuiz(generateQuestions(country), country.name.common);
        })
        .catch(err => console.error("Country fetch failed:", err));

        globe.polygonsData(globe.polygonsData());
    }

// Helpers to record which countries were clicked for the current day



function getQuizSessionKey() {
    return `quizSession_${getTodaySeed()}`;
}

function saveQuizSession(session) {
    localStorage.setItem(getQuizSessionKey(), JSON.stringify(session));
}

function loadQuizSession() {
    try {
        return JSON.parse(localStorage.getItem(getQuizSessionKey()));
    } catch {
        return null;
    }
}

function clearQuizSession() {
    localStorage.removeItem(getQuizSessionKey());
}

// Utility: normalize country names for consistent keys
function normalizeName(name) {
    if (!name) return '';

    return String(name)
        .toLowerCase()
        .replace(/of america|the united states|usa/g, "united states")
        .replace(/\s+/g, ' ')
        .trim();
}



// Load persisted country results for today so highlights survive refresh
loadCountryResults();

// Persisted results helpers (per-day)
function getCountryResultsKey() {
    return `countryResults_${getTodaySeed()}`;
}

function loadCountryResults() {
    try {
        const raw = localStorage.getItem(getCountryResultsKey());
        const parsed = raw ? JSON.parse(raw) : {};
        // Normalize keys so lookups match polygon properties regardless of formatting
        countryResults = {};
        Object.keys(parsed).forEach(k => {
            countryResults[normalizeName(k)] = parsed[k];
        });
    } catch (e) {
        console.error('Failed to load countryResults:', e);
        countryResults = {};
    }
}

function saveCountryResults() {
    try {
        // Save using original keys (already normalized in memory)
        localStorage.setItem(getCountryResultsKey(), JSON.stringify(countryResults));
    } catch (e) {
        console.error('Failed to save countryResults:', e);
    }
}

// Initialize polygon cap color to use normalized lookup
globe.polygonCapColor(d => {
    const name = d.properties.name;
    const result = countryResults[normalizeName(name)];

    if (result === "correct") return 'rgba(42, 197, 42, 0.7)';
    if (result === "wrong") return 'rgba(197, 42, 42, 0.7)';

    return 'rgba(100, 100, 100, 0.3)';
});

// Load GeoJSON
fetch('https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson')
    .then(res => res.json())
    .then(countries => {
        globe.polygonsData(countries.features);
        globe.width(window.innerWidth);
        globe.height(window.innerHeight);

        // Force a refresh so persisted countryResults apply immediately after load
        globe.polygonsData(globe.polygonsData());
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
    saveQuizSession({
    country: normalizeName(document.getElementById('quizCountry').innerText),
    questions: currentQuestions,
    currentQuestionIndex,
    allCorrect
});
}
// Next button
document.getElementById('nextBtn').onclick = () => {
    if (!answered) return;

    currentQuestionIndex++;

    if (currentQuestionIndex < currentQuestions.length) {
        saveQuizSession({
            country: normalizeName(document.getElementById('quizCountry').innerText),
            questions: currentQuestions,
            currentQuestionIndex,
            allCorrect
        });

        renderQuestion();
    } else {
        const countryName = document.getElementById('quizCountry').innerText;
        const key = normalizeName(countryName);
        const isDaily = document.getElementById('quizCountry').innerText === "Daily Trivia";

        if (allCorrect) {
            if (isDaily) {
                dailyScore++;
            } else {
                gameState.score++;
                saveUserData(userId);
                saveLocalScore();
            }

            countryResults[key] = "correct";
        } else {
            countryResults[key] = "wrong";
        }

        if (isDaily) {
            localStorage.setItem("dailyCompleted", getTodaySeed());
            promptForUsernameAndSaveScore();
        }

        countryResults[key] = allCorrect ? "correct" : "wrong";
        saveCountryResults();
        clearQuizSession();

        globe.polygonsData(globe.polygonsData());

        document.getElementById('score').innerText =
            `Score: ${gameState.score}`;

        document.getElementById('quizModal').classList.add('hidden');
    }
};
// Close button
document.getElementById('closeBtn').onclick = () => {
    document.getElementById('quizModal').classList.add('hidden');
};

function formatPopulation(input) {
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
            results.add(value);
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
    localStorage.setItem("dailySeed", seed);
    localStorage.setItem("dailyQuestions", JSON.stringify(questions));

    return questions;
}

function fetchCountryData(countryName) {
    const url = `https://restcountries.com/v3.1/name/${encodeURIComponent(countryName)}?fullText=true&fields=name,capital,region,currencies,population,flags`;

    return fetch(url)
        .then(res => {
            if (!res.ok) throw new Error("Full match failed");
            return res.json();
        })
        .then(data => Array.isArray(data) ? data[0] : data)
        .catch(() => {
            // fallback: partial match (more forgiving)
            return fetch(`https://restcountries.com/v3.1/name/${encodeURIComponent(countryName)}`)
                .then(res => res.json())
                .then(data => Array.isArray(data) ? data[0] : data);
        });
}

function decodeHTML(str) {
    const txt = document.createElement("textarea");
    txt.innerHTML = str;
    return txt.value;
}

document.getElementById('dailyBtn').onclick = async () => {
    const today = getTodaySeed();
    const completed = localStorage.getItem("dailyCompleted");

    if (completed === today) {
        alert("You already completed today's daily quiz!");
        return;
    }
    dailyScore = 0;
    const questions = await fetchDailyTrivia();

    showQuiz(questions, "Daily Trivia");
    localStorage.setItem("dailyStarted", today);
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

async function promptForUsernameAndSaveScore() {
    let username = localStorage.getItem("username");

    if (!username) {
        username = prompt("Enter a username for the leaderboard:");
        if (!username) return;

        localStorage.setItem("username", username);
    }

    await saveToLeaderboard(username, dailyScore); 
}

async function saveToLeaderboard(username, score) {
    try {
        const today = getTodaySeed();

        await setDoc(doc(db, "leaderboard", `${today}_${userId}`), {
            username: username,
            score: score,
            date: today,
            userId: userId
        });

        console.log("Leaderboard saved!");
    } catch (e) {
        console.error("Error saving leaderboard:", e);
    }
}

function getLocalScoreKey() {
    return `gameScore_${userId}`;
}

function saveLocalScore() {
    localStorage.setItem(getLocalScoreKey(), String(gameState.score));
}

function loadLocalScore() {
    const raw = localStorage.getItem(getLocalScoreKey());
    if (raw !== null && !isNaN(Number(raw))) {
        gameState.score = Number(raw);
        document.getElementById('score').innerText = `Score: ${gameState.score}`;
    }
}

const userId = getUserId();
loadLocalScore(); 
loadUserData(userId);