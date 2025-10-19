// ===================================================================================
// --- Core Game Logic ---
// ===================================================================================

/**
 * Starts a new game by setting up the initial state based on user inputs.
 */
function startGame() {
    // 1. Get Settings
    targetNumber = parseInt(targetNumberInput.value);
    maxIncrease = parseInt(maxIncreaseInput.value);
    difficulty = difficultySelect.value;
    gameMode = gameModeSelect.value;
    specialMode = specialModeSelect.value;

    // 2. Validate Settings
    if (isNaN(targetNumber) || targetNumber <= 5 || isNaN(maxIncrease) || maxIncrease <= 0) {
        showModal("Invalid Settings", "Please enter a target number of ducks greater than 5 and a positive number for ducks per turn.");
        return;
    }
    if (maxIncrease >= targetNumber) {
        showModal("Invalid Settings", "Max ducks per turn must be smaller than the target number of ducks.");
        return;
    }

    // 3. Reset Game State
    currentNumber = 0;
    isGameOver = false;
    moveHistory = [0];
    hintsLeft = 3;
    mines = [];
    strategicPoints = [];
    
    // 4. Setup UI
    setupScreen.classList.add('hidden');
    gameScreen.classList.remove('hidden');
    botThoughtProcess.classList.add('hidden');
    
    // Calculate layout-dependent values after a brief delay to ensure the DOM is ready
    setTimeout(() => {
        const pondContentWidth = duckProgressBar.clientWidth - (POND_PADDING * 2);
        ducksPerRow = Math.floor(pondContentWidth / (DUCK_SIZE + DUCK_GAP));
        if(ducksPerRow <= 0) ducksPerRow = 1;

        const totalRows = Math.ceil(targetNumber / ducksPerRow);
        duckProgressBar.style.minHeight = `${(totalRows * (DUCK_SIZE + DUCK_GAP)) + POND_PADDING}px`;

        // Generate game elements that depend on layout
        if (specialMode === 'mines') generateMines();
        generateKeyPositionMarker();

        // 5. Initial Display & Controls Update
        updateDisplay();
    }, 0);


    targetDisplay.innerHTML = `${targetNumber} <span class="duck !w-8 !h-8"></span>`;
    gameLog.innerHTML = '';
    generatePlayerButtons();
    updateControlButtons();
    updateStrategyPanel();


    // 6. Determine Starting Turn
    isPlayerTurn = gameMode === 'bot' ?
        (playerStartSelect.value === 'player' ? true : (playerStartSelect.value === 'bot' ? false : Math
            .random() < 0.5)) :
        true;

    if (gameMode === 'bot' && !isPlayerTurn) {
        togglePlayerButtons(false);
        setTimeout(botTurn, 1200);
    } else {
        togglePlayerButtons(true);
    }
}

/**
 * Processes a move made by the human player.
 * @param {number} amount - The number of ducks to add.
 */
function playerMove(amount) {
    if (isGameOver || (gameMode === 'bot' && !isPlayerTurn)) return;

    botThoughtProcess.classList.add('hidden');
    const prevNumber = currentNumber;
    currentNumber += amount;
    moveHistory.push(currentNumber);

    logAction(gameMode === 'bot' ? 'You' : (isPlayerTurn ? 'Player 1' : 'Player 2'), amount, prevNumber);

    if (checkEndConditions()) return;

    isPlayerTurn = !isPlayerTurn;
    updateDisplay();
    togglePlayerButtons(gameMode === 'human');
    updateControlButtons();
    updateStrategyPanel();


    if (gameMode === 'bot' && !isPlayerTurn) {
        setTimeout(botTurn, 1200);
    }
}

/**
 * Manages the bot's turn, including decision-making based on difficulty.
 */
function botTurn() {
    if (isGameOver) return;
    const bestMove = getHardBotMove();
    let move;

    const randomChance = Math.random();
    switch (difficulty) {
        case 'very-easy':
            move = getEasyBotMove();
            break;
        case 'easy':
            move = randomChance < 0.25 ? bestMove : getEasyBotMove();
            break;
        case 'normal':
            move = randomChance < 0.5 ? bestMove : getEasyBotMove();
            break;
        case 'hard':
            move = randomChance < 0.8 ? bestMove : getEasyBotMove();
            break;
        case 'impossible':
            move = bestMove;
            break;
    }

    if (currentNumber + move > targetNumber) move = targetNumber - currentNumber;
    if (move <= 0) move = 1;

    // Bot "thinking" UI update
    botThoughtProcess.classList.remove('hidden');
    if (move === bestMove && getHardBotMove() !== getEasyBotMove()) {
        botThoughtText.textContent =
            `I'm in a favorable position. The optimal move is to add ${move} to reach the next key number.`;
    } else if (difficulty === 'impossible') {
        botThoughtText.textContent = `My analysis shows that adding ${move} is the optimal path to victory.`;
    } else {
        botThoughtText.textContent =
            `The position is unfavorable, so I'll make a random move by adding ${move} and hope for a mistake!`;
    }

    setTimeout(() => {
        const prevNumber = currentNumber;
        currentNumber += move;
        moveHistory.push(currentNumber);
        logAction('Bot', move, prevNumber);

        if (checkEndConditions()) return;

        isPlayerTurn = true;
        togglePlayerButtons(true);
        updateDisplay();
        updateControlButtons();
        updateStrategyPanel();
    }, 2000); // Increased delay to let user read the thought
}

/**
 * Calculates a random, non-strategic move for the bot.
 * @returns {number} The move to make.
 */
const getEasyBotMove = () => {
    const possibleMoves = Array.from({
        length: maxIncrease
    }, (_, i) => i + 1).filter(m => currentNumber + m <= targetNumber && !mines.includes(
        currentNumber + m));
    return possibleMoves.length ? possibleMoves[Math.floor(Math.random() * possibleMoves.length)] : 1;
};

/**
 * Calculates the optimal strategic move for the bot.
 * @returns {number} The best move to make.
 */
const getHardBotMove = () => {
    const strategicMod = maxIncrease + 1;
    const targetMod = targetNumber % strategicMod;

    // Look for a move that lands on a strategic point
    for (let move = 1; move <= maxIncrease; move++) {
        const nextNum = currentNumber + move;
        if (targetMod === 0) {
             if (nextNum <= targetNumber && (nextNum % strategicMod === 0) && !mines.includes(nextNum)) {
                return move;
            }
        } else {
            if (nextNum <= targetNumber && (nextNum % strategicMod === targetMod) && !mines.includes(
                nextNum)) {
                return move;
            }
        }
    }
    // If no strategic move, return a "safe" random move
    return getEasyBotMove();
};

/**
 * Checks for game-ending conditions (target reached or mine hit).
 * @returns {boolean} True if the game has ended, false otherwise.
 */
function checkEndConditions() {
    if (specialMode === 'mines' && mines.includes(currentNumber)) {
        isGameOver = true;
        revealMines();
        togglePlayerButtons(false);
        updateDisplay();

        const loserName = isPlayerTurn ? (gameMode === 'bot' ? 'You' : 'Player 1') : (gameMode ===
            'bot' ? 'Bot' : 'Player 2');
        const winnerName = !isPlayerTurn ? (gameMode === 'bot' ? 'You' : 'Player 1') : (gameMode ===
            'bot' ? 'Bot' : 'Player 2');

        showEndGameModal(winnerName.includes('You') || winnerName.includes('Player 1'), `OH NO!`,
            `${loserName} ran into a crocodile! ${winnerName} wins!`);
        playSound('A2', '2n');

        if (gameMode === 'bot') {
            updateStats(isPlayerTurn ? 'loss' : 'win');
        } else {
            updateStats(isPlayerTurn ? 'p2' : 'p1');
        }
        return true;
    }

    if (currentNumber >= targetNumber) {
        isGameOver = true;
        revealMines();
        togglePlayerButtons(false);
        updateDisplay();
        let winner;

        if (gameMode === 'bot') {
            winner = isPlayerTurn ? 'player' : 'bot';
            updateStats(winner === 'player' ? 'win' : 'loss');
        } else {
            winner = isPlayerTurn ? 'p1' : 'p2';
            updateStats(winner);
        }

        if (currentNumber === targetNumber) {
            const winnerName = winner === 'player' ? 'You' : (winner === 'p1' ? 'Player 1' : (
                winner === 'p2' ? 'Player 2' : 'The Bot'));
            const playerWon = winner === 'player' || winner === 'p1';
            showEndGameModal(playerWon, `${winnerName} caught the last duck!`,
                `A perfect catch! Well played!`);
            if (playerWon) {
                confetti({
                    particleCount: 150,
                    spread: 90,
                    origin: {
                        y: 0.6
                    }
                });
            }
            playSound('C5', '4n');
        }
        return true;
    }
    return false;
}

/**
 * Reverts the last one or two moves in the game history.
 */
function undoMove() {
    if (moveHistory.length <= 1) return;
    botThoughtProcess.classList.add('hidden');
    const stepsToUndo = gameMode === 'bot' ? 2 : 1;

    if (moveHistory.length > stepsToUndo) {
        for (let i = 0; i < stepsToUndo; i++) moveHistory.pop();
        currentNumber = moveHistory[moveHistory.length - 1];
    } else {
        moveHistory = [0];
        currentNumber = 0;
    }
    isPlayerTurn = true;
    logAction("System", "Move undone", currentNumber);
    updateDisplay();
    togglePlayerButtons(true);
    updateControlButtons();
    updateStrategyPanel();
}
