// ===================================================================================
// --- DOM Elements & Global State ---
// ===================================================================================
const setupScreen = document.getElementById('setup-screen');
const gameScreen = document.getElementById('game-screen');
const gameOverModal = document.getElementById('game-over-modal');
const gameModeSelect = document.getElementById('game-mode');
const specialModeSelect = document.getElementById('special-mode');
const themeSelector = document.getElementById('theme-selector');
const targetNumberInput = document.getElementById('target-number');
const maxIncreaseInput = document.getElementById('max-increase');
const difficultySelect = document.getElementById('difficulty');
const playerStartSelect = document.getElementById('player-start');
const startGameBtn = document.getElementById('start-game-btn');
const playAgainBtn = document.getElementById('play-again-btn');
const botSettingsDiv = document.getElementById('bot-settings');
const statsText = document.getElementById('stats-text');
const targetDisplay = document.getElementById('target-display');
const pondContainer = document.getElementById('pond-container');
const duckProgressBar = document.getElementById('duck-progress-bar');
const turnIndicator = document.getElementById('turn-indicator');
const currentDucksDisplay = document.getElementById('current-ducks-display');
const numberButtonsContainer = document.getElementById('number-buttons');
const gameLog = document.getElementById('game-log');
const gameLogContainer = document.getElementById('game-log-container');
const minesContainer = document.getElementById('mines-container');
const strategicPointsContainer = document.getElementById('strategic-points-container');
const undoBtn = document.getElementById('undo-btn');
const restartBtn = document.getElementById('restart-btn');
const hintBtn = document.getElementById('hint-btn');
const hintsLeftSpan = document.getElementById('hints-left');
const modalTitle = document.getElementById('modal-title');
const modalMessage = document.getElementById('modal-message');
const botThoughtProcess = document.getElementById('bot-thought-process');
const botThoughtText = document.getElementById('bot-thought-text');

// Game State
let targetNumber, maxIncrease, difficulty, gameMode, specialMode;
let currentNumber, isPlayerTurn, isGameOver, hintsLeft;
let moveHistory = [];
let mines = [];
let strategicPoints = [];
let ducksPerRow = 10; // Default, will be recalculated
const DUCK_SIZE = 44; // Corresponds to the .duck class width/height in CSS
const DUCK_GAP = 4; // Corresponds to gap-1 in Tailwind
const POND_PADDING = 16; // Corresponds to p-4 in Tailwind


let gameStats = {
    bot: { wins: 0, losses: 0 },
    human: { p1_wins: 0, p2_wins: 0 }
};

// Sound Engine
const synth = new Tone.Synth().toDestination();
const playSound = (note, duration = '8n') => {
    if (Tone.context.state !== 'running') {
        Tone.start();
    }
    synth.triggerAttackRelease(note, duration);
}

// ===================================================================================
// --- UI / DOM Manipulation ---
// ===================================================================================
function updateDisplay() {
    duckProgressBar.innerHTML = '';
    
    // Add current number display
    currentDucksDisplay.innerHTML = `Current Ducks: <span class="font-bold">${currentNumber}</span>`;

    for (let i = 0; i < currentNumber; i++) {
        const duck = document.createElement('div');
        duck.className = 'duck';
        duckProgressBar.appendChild(duck);
    }

    if (isGameOver) return;

    let turnText = "";
    if (gameMode === 'bot') {
        turnText = isPlayerTurn ? "Your Turn" : "Bot is thinking...";
    } else {
        turnText = isPlayerTurn ? "Player 1's Turn" : "Player 2's Turn";
    }
    turnIndicator.textContent = turnText;
    turnIndicator.style.color = isPlayerTurn ? 'var(--accent-color)' : 'var(--text-secondary)';
}

function getMarkerPosition(number) {
    if (ducksPerRow <= 0) return { top: '0px', left: '0px' };
    const DUCK_CELL_SIZE = DUCK_SIZE + DUCK_GAP;
    const duckIndex = number - 1;
    const row = Math.floor(duckIndex / ducksPerRow);
    const col = duckIndex % ducksPerRow;

    const top = POND_PADDING + (row * DUCK_CELL_SIZE) + DUCK_SIZE + 8;
    const left = POND_PADDING + (col * DUCK_CELL_SIZE) + (DUCK_SIZE / 2);
    
    return { top: `${top}px`, left: `${left}px` };
}

function generateMines() {
    minesContainer.innerHTML = '';
    const mineCount = Math.floor(targetNumber / 10) + 1;
    for (let i = 0; i < mineCount; i++) {
        let minePosition = Math.floor(Math.random() * (targetNumber - 5)) + 5;
        if (!mines.includes(minePosition)) {
            mines.push(minePosition);
            const marker = document.createElement('div');
            marker.className = 'mine-marker';
            marker.textContent = '🐊';
            const pos = getMarkerPosition(minePosition);
            marker.style.left = pos.left;
            marker.style.top = pos.top;
            minesContainer.appendChild(marker);
        } else {
            i--; // Try again
        }
    }
}

function generateKeyPositionMarker() {
    strategicPointsContainer.innerHTML = '';
    strategicPoints = [];
    const strategicMod = maxIncrease + 1;
    const targetMod = targetNumber % strategicMod;

    // First, populate the array of all strategic points for the AI panel
    for (let i = 1; i < targetNumber; i++) {
         if (targetMod === 0) {
            if (i > 0 && i % strategicMod === 0) {
                strategicPoints.push(i);
            }
        } else {
            if (i % strategicMod === targetMod) {
                strategicPoints.push(i);
            }
        }
    }

    // Then, find and draw only the LAST (highest) key position
    const keyPosition = Math.max(...strategicPoints);

    if (keyPosition > 0 && isFinite(keyPosition)) {
         if (specialMode === 'mines' && mines.includes(keyPosition)) return;

        const marker = document.createElement('div');
        marker.className = 'strategic-marker';
        const pos = getMarkerPosition(keyPosition);
        marker.style.left = pos.left;
        marker.style.top = pos.top;

        const tooltip = document.createElement('span');
        tooltip.className = 'tooltip';
        tooltip.textContent = `Key Position: ${keyPosition}`;
        marker.appendChild(tooltip);

        strategicPointsContainer.appendChild(marker);
    }
}

function generatePlayerButtons() {
    numberButtonsContainer.innerHTML = '';
    for (let i = 1; i <= maxIncrease; i++) {
        const button = document.createElement('button');
        let duckIcons = '';
        for (let j = 0; j < i; j++) {
            duckIcons += '<span class="duck duck-icon"></span>';
        }
        button.innerHTML = `+${i} ${duckIcons}`;
        button.dataset.increase = i;
        button.classList.add('btn', 'duck-button', 'text-white', 'font-bold', 'py-3', 'px-5',
            'rounded-lg', 'shadow-md', 'flex', 'items-center', 'gap-2', 'disabled:opacity-50',
            'disabled:cursor-not-allowed');
        button.style.backgroundColor = 'var(--accent-color)';
        button.addEventListener('click', () => {
            playSound('C5', '16n');
            playerMove(i);
        });
        numberButtonsContainer.appendChild(button);
    }
}

function updateControlButtons() {
    undoBtn.style.display = gameMode === 'bot' ? 'inline-flex' : 'none';
    undoBtn.disabled = moveHistory.length <= 1 || !isPlayerTurn;
    hintBtn.disabled = hintsLeft <= 0 || !isPlayerTurn || gameMode !== 'bot';
    hintsLeftSpan.textContent = hintsLeft;
}

function togglePlayerButtons(enabled) {
    numberButtonsContainer.querySelectorAll('button').forEach(button => {
        const increase = parseInt(button.dataset.increase);
        button.disabled = !enabled || (currentNumber + increase > targetNumber);
    });
}

function updateStrategyPanel() {
    const strategicMod = maxIncrease + 1;
    const targetMod = targetNumber % strategicMod;
    let isUnfavorable = false;

    if (targetMod === 0) {
        isUnfavorable = currentNumber > 0 && currentNumber % strategicMod === 0;
    } else {
        isUnfavorable = currentNumber % strategicMod === targetMod;
    }


    const statusEl = document.getElementById('strategy-status');
    const explanationEl = document.getElementById('strategy-explanation');
    const moveEl = document.getElementById('strategy-move');

    if (isUnfavorable) {
        statusEl.textContent = "Unfavorable Position";
        statusEl.style.color = '#ef4444'; // red-500
        explanationEl.textContent =
            `Your opponent has forced you onto a key number. Any move you make will likely give them an advantage.`;
        moveEl.textContent = `No optimal move is available.`;
    } else {
        statusEl.textContent = "Favorable Position";
        statusEl.style.color = '#22c55e'; // green-500

        const optimalMove = getHardBotMove();
        const nextKeyNumber = currentNumber + optimalMove;

        if (optimalMove !== getEasyBotMove() || (nextKeyNumber % strategicMod === targetMod) || (targetMod === 0 && nextKeyNumber % strategicMod === 0)) {
            explanationEl.textContent =
                `The key is to land on numbers like ${strategicPoints.join(', ')}. The next key number is ${nextKeyNumber}.`;
            moveEl.textContent = `Add ${optimalMove} to seize control.`;
        } else {
            const moveForWin = targetNumber - currentNumber;
            if (moveForWin > 0 && moveForWin <= maxIncrease) {
                explanationEl.textContent = `You are in a position to win the game!`;
                moveEl.textContent = `Add ${moveForWin} to land on ${targetNumber} and win!`;
            } else {
                explanationEl.textContent =
                    `You are in a good position, but cannot reach a key number in one move.`;
                moveEl.textContent = `Any move is safe for now.`;
            }
        }
    }
}

function showHint() {
    if (hintsLeft <= 0 || !isPlayerTurn || gameMode !== 'bot') return;

    hintsLeft--;
    const bestMove = getHardBotMove();
    const hintButton = numberButtonsContainer.querySelector(`[data-increase='${bestMove}']`);

    if (hintButton) {
        hintButton.classList.add('hint-glow');
        setTimeout(() => hintButton.classList.remove('hint-glow'), 1500);
    }
    updateControlButtons();
}

function revealMines() {
    if (specialMode !== 'mines') return;
    document.querySelectorAll('.mine-marker').forEach(marker => marker.classList.add('mine-reveal'));
}

function showEndGameModal(isWin, title, message) {
    modalTitle.textContent = title;
    modalMessage.textContent = message;
    modalTitle.style.color = isWin ? '#22c55e' : '#ef4444'; // green-500 or red-500
    gameOverModal.classList.remove('hidden');
}

function logAction(player, amount, prevNumber) {
    const p = document.createElement('p');
    if (player === 'System') {
        p.textContent = `System: Move undone. Back to ${currentNumber} ducks.`;
        p.classList.add('italic', 'text-gray-400');
    } else {
        p.innerHTML =
            `${player} added ${amount} <span class="duck inline-block !w-4 !h-4"></span>. (${prevNumber} &rarr; ${currentNumber})`;
    }
    gameLog.appendChild(p);
    // Auto-scroll to the bottom
    gameLogContainer.scrollTop = gameLogContainer.scrollHeight;
}

function showModal(title, message) {
    modalTitle.textContent = title;
    modalMessage.textContent = message;
    modalTitle.style.color = '#ef4444'; // red-500
    playAgainBtn.textContent = 'Got it!';
    gameOverModal.classList.remove('hidden');

    const tempClickHandler = () => {
        gameOverModal.classList.add('hidden');
        playAgainBtn.textContent = 'Play Again';
        playAgainBtn.removeEventListener('click', tempClickHandler);
    };
    playAgainBtn.addEventListener('click', tempClickHandler);
}

// ===================================================================================
// --- State Management & Utilities ---
// ===================================================================================

function initialize() {
    loadTheme();
    loadStats();
    updateStatsDisplay();
}

function resetGame() {
    gameOverModal.classList.add('hidden');
    gameScreen.classList.add('hidden');
    setupScreen.classList.remove('hidden');
    updateStatsDisplay();
}

function applyTheme(themeName) {
    document.body.className = `flex items-center justify-center min-h-screen p-4 theme-${themeName}`;
    localStorage.setItem('gameTheme', themeName);
    themeSelector.value = themeName;
}

function loadTheme() {
    const savedTheme = localStorage.getItem('gameTheme') || 'light';
    applyTheme(savedTheme);
}

function loadStats() {
    const savedStats = localStorage.getItem('gameStats');
    if (savedStats) gameStats = JSON.parse(savedStats);
}

function saveStats() {
    localStorage.setItem('gameStats', JSON.stringify(gameStats));
}

function updateStats(result) {
    if (gameMode === 'bot') {
        if (result === 'win') gameStats.bot.wins++;
        else gameStats.bot.losses++;
    } else {
        if (result === 'p1') gameStats.human.p1_wins++;
        else gameStats.human.p2_wins++;
    }
    saveStats();
}

function updateStatsDisplay() {
    statsText.innerHTML = `
        <span class="mr-4"><strong>vs Bot:</strong> ${gameStats.bot.wins}W - ${gameStats.bot.losses}L</span>
        <span><strong>vs Player:</strong> P1: ${gameStats.human.p1_wins}W - P2: ${gameStats.human.p2_wins}W</span>
    `;
}

// ===================================================================================
// --- Initial Load & Event Listeners ---
// ===================================================================================

gameModeSelect.addEventListener('change', () => botSettingsDiv.style.display = gameModeSelect.value === 'bot' ?
    'block' : 'none');
themeSelector.addEventListener('change', (e) => applyTheme(e.target.value));
startGameBtn.addEventListener('click', () => {
    playSound('C4');
    startGame();
});
playAgainBtn.addEventListener('click', () => {
    playSound('C4');
    resetGame();
});
restartBtn.addEventListener('click', () => {
    playSound('E4');
    resetGame();
});
undoBtn.addEventListener('click', () => {
    playSound('A3');
    undoMove();
});
hintBtn.addEventListener('click', () => {
    playSound('G4');
    showHint();
});

// First time page load initialization
initialize();
