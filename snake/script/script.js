// --- Initialization and DOM elements ---
const gameContainer = document.querySelector('.game-container');
const infoScoreBlock = document.querySelector('.info-score-block');
const scoreText = document.querySelectorAll('.score-text');
const recordText = document.querySelectorAll('.record-text');
const speedText = document.querySelectorAll('.speed-text');
const canvas = document.querySelector('.canvas-game');
const ctx = canvas.getContext('2d');
const root = document.documentElement;

// --- Constants and global state ---
const gridSize = 20;
let snake, direction, food, score, gameSpeed;

// Object for storing colors used in canvas
const THEME = {};

// Function for reading CSS variables
const readThemeFromCSS = () => {
    const style = getComputedStyle(root);

    THEME.FOOD = style.getPropertyValue('--game-food').trim();
    THEME.SNAKE_HEAD = style.getPropertyValue('--game-snake-head').trim();
    THEME.SNAKE_BODY = style.getPropertyValue('--game-snake-body').trim();
    THEME.GRID = style.getPropertyValue('--game-grid').trim();
    THEME.PATH_HIGHLIGHT = style.getPropertyValue('--game-path-highlight').trim();
};

// Game state enum
const STATES = {
    START: 'start',
    PLAYING: 'playing',
    PAUSE: 'pause',
    GAMEOVER: 'gameover'
};

// Time & loop control
let isPaused = false;
let lastFrameTime = 0; // last update time (for tracking delay)
let animationID = null; // identifier for canceling rAF
let currentGameState = STATES.START;
let nextDirection = null;

// UI settings
const checkboxItem = document.querySelector('.checkbox-item');
const checkbox = document.querySelector('.path-checkbox');
let isPathLighting = checkbox.checked ? true : false;
let recordNum = JSON.parse(localStorage.getItem('record')) || 0;

// UI elements
const overlay = document.querySelector('.game-overlay-block');
const controlButtons = document.querySelectorAll('.control-button');

recordText.forEach(item => item.textContent = recordNum);

checkboxItem.addEventListener('click', e => {
    checkbox.checked = !checkbox.checked;
    isPathLighting = checkbox.checked;
});

// Core state management
const setGameState = (newState) => {
    currentGameState = newState;
    gameContainer.dataset.state = newState;

    if (newState !== STATES.PLAYING) {
         // cancel loop, if no play
         if (animationID) {
            cancelAnimationFrame(animationID);
            animationID = null;
        }
    }

    const isGameActive = newState === STATES.PLAYING || newState === STATES.PAUSE;
    if (isGameActive) {
        checkboxItem.classList.remove('is-hidden');
        infoScoreBlock.classList.remove('is-hide');
    } else {
        checkboxItem.classList.add('is-hidden');
        infoScoreBlock.classList.add('is-hide');
    }
};

// --- Utilities ---
// Canvas / UI
// clear the screen to redraw the pause state
const clearCanvas = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}
const getGridCenter = () => {
    const centerX = Math.floor((canvas.width - gridSize) / 2 / gridSize) * gridSize;
    const centerY = Math.floor((canvas.height - gridSize) / 2 / gridSize) * gridSize;
    return { x: centerX, y: centerY };
}

// Position check
// if there is no snake, create food
const isPositionOnSnake = (position) => {
    return snake.some(segment => segment.x === position.x && segment.y === position.y);
}

// set info for score block
const updateScoreUI = () => {
    recordText.forEach(item => item.textContent = recordNum);
    scoreText.forEach(item => item.textContent = score);
    speedText.forEach(item => item.textContent = gameSpeed);
};


// --- Game Core Logic & State Management ---

// Game state management
// initializes all variables and starts the loop
const startGame = () => {
    snake = [{ ...getGridCenter() }];

    // default: the snake moves to the right
    direction = "RIGHT";
    nextDirection = null;

    // creating food
    food = getRandomFoodPosition(); // food = { x, y }
    score = 0;
    gameSpeed = 250;
    isPaused = false; // important: reset pause
    lastFrameTime = 0; // initialize time

    // set info for score block
    updateScoreUI();

    // change state
    setGameState(STATES.PLAYING);

    // start rAF loop
    animationID = requestAnimationFrame(gameLoop);
};

// ends the game, saves the record
const gameOver = () => {
    // set new record
    if (score > recordNum) {
        recordNum = score;
        localStorage.setItem('record', score);

        updateScoreUI();
    }

    // change state
    setGameState(STATES.GAMEOVER);
}

// toggles the pause state
const pause = () => {
    if (currentGameState !== STATES.PLAYING)
        return;
    isPaused = true;

    setGameState(STATES.PAUSE);
}
const resumeGame = () => {
    if (currentGameState !== STATES.PAUSE)
        return;
    isPaused = false;
    // update time to avoid a sharp jump after unpausing
    lastFrameTime = performance.now();

    setGameState(STATES.PLAYING);

    // start rAF loop
    animationID = requestAnimationFrame(gameLoop);
}

// updates score, speed, creates new food
// if the snake ate an apple
const handleFoodEaten = () => {
    food = getRandomFoodPosition();
    score += 1;

    if (gameSpeed > 150) gameSpeed -= 15;
    else if (gameSpeed > 100) gameSpeed -= 10;
    else if (gameSpeed > 50) gameSpeed -= 5;

    // set info for score block
    updateScoreUI();

    if ('vibrate' in navigator) {
        navigator.vibrate(100);
    }
}

// Positioning
// finds a random free position
const getRandomFoodPosition = () => {
    let newFoodPosition;

    do {
        newFoodPosition = {
            x: Math.floor(Math.random() * (canvas.width / gridSize)) * gridSize,
            y: Math.floor(Math.random() * (canvas.height / gridSize)) * gridSize,
        }
    } while (isPositionOnSnake(newFoodPosition));

    return newFoodPosition;
}

// --- Game logic ---
// Movement and collisions
// updating the game state
const calculateNextHeadPosition = () => {
    const head = { ...snake[0] };
    if (direction === 'UP')    head.y -= gridSize;
    if (direction === 'DOWN')  head.y += gridSize;
    if (direction === 'LEFT')  head.x -= gridSize;
    if (direction === 'RIGHT') head.x += gridSize;

    return head;
}
// if hit a wall
const checkWallCollision = (head) => {
    return (
        head.x < 0 || head.x >= canvas.width ||
        head.y < 0 || head.y >= canvas.height
    );
}
// if run into ourselves
const checkSelfCollision = (head) => {
    for (let i = 1; i < snake.length; i++) {
        if (head.x === snake[i].x && head.y === snake[i].y) {
            return true;
        }
    }
    return false;
}
const checkFoodCollision = (head) => {
    return head.x === food.x && head.y === food.y;
}

// Main update
const updateGame = () => {
    if (nextDirection) {
        direction = nextDirection;
        nextDirection = null; // clear buffer
    }

    const head = calculateNextHeadPosition();

    // if hit a wall and run into ourselves - game over
    if (checkWallCollision(head) || checkSelfCollision(head)) {
        gameOver();
        return;
    }

    // move snake
    snake.unshift(head);

    if (checkFoodCollision(head)) {
        handleFoodEaten();
    } else {
        // delete tail
        snake.pop();
    }
}


// --- Rendering ---
const drawFood = () => {
    ctx.fillStyle = THEME.FOOD;
    ctx.fillRect(food.x, food.y, gridSize, gridSize);
}

const drawSnake = () => {
    ctx.fillStyle = THEME.SNAKE_HEAD;
    ctx.fillRect(snake[0].x, snake[0].y, gridSize, gridSize);
    // body snake
    ctx.fillStyle = THEME.SNAKE_BODY;
    for (let i = 1; i < snake.length; i++) {
        ctx.fillRect(snake[i].x, snake[i].y, gridSize, gridSize);
    }
}

const drawGrid = () => {
    ctx.lineWidth = 0.2;
    ctx.strokeStyle = THEME.GRID;

    // draw vertical lines
    for (let x = 0; x < canvas.width; x += 20) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
    }
    // draw horizontal lines
    for (let y = 0; y < canvas.height; y += 20) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
    }
}

const drawPathHighlight = () => {
    ctx.fillStyle = THEME.PATH_HIGHLIGHT;

    if (direction === 'UP' || direction === 'DOWN') {
        // vertical row
        ctx.fillRect(snake[0].x, 0, gridSize, canvas.height);
    } else if (direction === 'LEFT' || direction === 'RIGHT') {
        // horizontal row
        ctx.fillRect(0, snake[0].y, canvas.width, gridSize);
    }
}

const drawGame = () => {
    clearCanvas();

    if (isPathLighting) {
        drawPathHighlight();
    }

    drawGrid();
    drawFood();
    drawSnake();
}


// --- Game loop & input handlers ---
const gameLoop = (timestamp) => {
    // check if the game is running; if not, exit
    //if (!gameRunning) {
    if (currentGameState !== STATES.PLAYING) {
        cancelAnimationFrame(animationID);
        animationID = null;
        return;
    }

    // if the game is paused, do not continue the loop
    // and just request the next frame without updating logic
    if (isPaused) {
        // request the next frame
        animationID = requestAnimationFrame(gameLoop);
        return;
    }

    // --- time-based speed control logic ---
    const deltaTime = timestamp - lastFrameTime;

    // update game logic only if enough time has passed (gamespeed ms)
    if (deltaTime >= gameSpeed) {
        lastFrameTime = timestamp - (deltaTime % gameSpeed); // adjustment for accuracy

        updateGame();

        // if (gameRunning) {
        if (currentGameState === STATES.PLAYING) {
            drawGame();
        }
    }

    // request the next frame regardless of whether the logic was updated
    animationID = requestAnimationFrame(gameLoop);
};

// game controls
const tryChangeDirection = (newDirection) => {
    // rules for changing direction
    if (newDirection === 'UP' && direction !== 'DOWN') {
        nextDirection = 'UP';
    } else if (newDirection === 'DOWN' && direction !== 'UP') {
        nextDirection = 'DOWN';
    } else if (newDirection === 'LEFT' && direction !== 'RIGHT') {
        nextDirection = 'LEFT';
    } else if (newDirection === 'RIGHT' && direction !== 'LEFT') {
        nextDirection = 'RIGHT';
    }
};

// input handling (keyboard)
const handleKeyDirection = (key) => {
    switch (key) {
        case 'ArrowUp':
            tryChangeDirection('UP');
            break;
        case 'ArrowDown':
            tryChangeDirection('DOWN');
            break;
        case 'ArrowLeft':
            tryChangeDirection('LEFT');
            break;
        case 'ArrowRight':
            tryChangeDirection('RIGHT');
            break;
    }
};
const handleKeyboardInput = (event) => {
    const code = event.code;

    // pause: 'space' - the same physical key
    if (code === 'Space') {
        event.preventDefault();
        // pause();
        if (currentGameState === STATES.PLAYING) {
            pause();
        } else if (currentGameState === STATES.PAUSE) {
            resumeGame();
        }
        return;
    }

    // if the game is paused, any arrow key press will unpause the game
    if (currentGameState !== STATES.PLAYING) {
        if (currentGameState === STATES.PAUSE && code.startsWith('Arrow')) {
            // processing directions
            handleKeyDirection(event.key);
            resumeGame();
        }
        return;
    }

    // processing directions
    handleKeyDirection(event.key);
};

const handleButtonAction = (event) => {
    const action = event.target.dataset.action;

    if (!action) return;

    switch (action) {
        case 'start':
            startGame();
            break;
        case 'resume':
            resumeGame();
            break;
        default:
            console.warn(`Неизвестное действие: ${action}`);
    }
}

controlButtons.forEach(button => {
    button.addEventListener('click', handleButtonAction);
});
document.addEventListener('keydown', handleKeyboardInput);


// Input handling (Touch/Swipe)
// variables to track touch events
let touchStartX = 0;
let touchStartY = 0;
let touchStartTime = 0;
const SWIPE_GRID_THRESHOLD = 2; // minimum swipe distance in grid cells
const minSwipeDistance = gridSize * SWIPE_GRID_THRESHOLD; // threshold for swipe
const MAX_TAP_DURATION_MS = 300; // maximum time for tap (in milliseconds)
const maxTapDistance = 30; // maximum movement for tap (in pixels)

// touch start handler
canvas.addEventListener('touchstart', (event) => {
    event.preventDefault(); // prevent page scrolling
    const touch = event.touches[0];
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
    touchStartTime = Date.now(); // remember the start time of the touch
});

// touch end handler
canvas.addEventListener('touchend', (event) => {
    event.preventDefault();

    // if the game is not running, do nothing
    if (currentGameState === STATES.START || currentGameState === STATES.GAMEOVER) return;

    const touchEndTime = Date.now();
    const touchDuration = touchEndTime - touchStartTime;
    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - touchStartX;
    const deltaY = touch.clientY - touchStartY;

    // check if it's a tap
    if (
        touchDuration < MAX_TAP_DURATION_MS &&
        Math.abs(deltaX) < maxTapDistance &&
        Math.abs(deltaY) < maxTapDistance
    ) {
        if (currentGameState === STATES.PLAYING) {
            pause();
        } else if (currentGameState === STATES.PAUSE) {
            resumeGame();
        }
        return;
    }

    // check if the movement is large enough for a swipe
    if (Math.abs(deltaX) > minSwipeDistance || Math.abs(deltaY) > minSwipeDistance) {
        // if the game is paused, swipe will unpause the game
        if (currentGameState === STATES.PAUSE) {
            resumeGame();
        }

        if (currentGameState === STATES.PLAYING) {
            let newDirection = null;

            // determine the swipe direction
            if (Math.abs(deltaX) > Math.abs(deltaY)) {
                // horizontal swipe
                if (deltaX > 0 && newDirection !== 'LEFT') {
                    newDirection = 'RIGHT';
                } else if (deltaX < 0 && newDirection !== 'RIGHT') {
                    newDirection = 'LEFT';
                }
            } else {
                // vertical swipe
                if (deltaY > 0 && newDirection !== 'UP') {
                    newDirection = 'DOWN';
                } else if (deltaY < 0 && newDirection !== 'DOWN') {
                    newDirection = 'UP';
                }
            }

            // call the general function to change direction
            if (newDirection) {
                tryChangeDirection(newDirection);
            }
        }
    }
});


const nextButtons = document.querySelectorAll('.step-btn');
let currentStepElement = document.querySelector('.step-item.visible');

function updateStep() {
    currentStepElement.classList.remove('visible');

    const nextStep = currentStepElement.nextElementSibling;
    if (nextStep && nextStep.classList.contains('step-item')) {
        currentStepElement = nextStep;
        currentStepElement.classList.add('visible');
    }
}
nextButtons.forEach(button => {
    button.addEventListener('click', updateStep);
});


// --- Device/Window management ---
// adaptation to screen size
const resizeCanvas = () => {
    // maximum and minimum canvas width
    const maxWidth = 400; // maximum canvas size
    const minWidth = 200; // minimum size for gameplay convenience

    // considering the screen width and height, choose the smaller value
    // get the width including padding but excluding border/margin
    const widthWithPadding = gameContainer.getBoundingClientRect().width;
    // get the computed styles to find padding values
    const computedStyle = getComputedStyle(gameContainer);
    const paddingLeft = parseFloat(computedStyle.paddingLeft) || 0;
    const paddingRight = parseFloat(computedStyle.paddingRight) || 0;
    // calculate the content width without padding
    const contentWidth = widthWithPadding - paddingLeft - paddingRight;
    const availableWidth = Math.min(contentWidth, window.innerHeight);

    // limit the canvas width
    let newWidth = Math.min(availableWidth, maxWidth);
    newWidth = Math.max(newWidth, minWidth);

    // round the width to a multiple of gridSize to make the field whole
    canvas.width = Math.floor(newWidth / gridSize) * gridSize;
    canvas.height = canvas.width; // keep the field square

    // recalculate the snake and food positions if the game is running
    if (currentGameState !== STATES.START) {
        snake = snake.map(segment => ({
            x: Math.min(Math.floor(segment.x / gridSize) * gridSize, canvas.width - gridSize),
            y: Math.min(Math.floor(segment.y / gridSize) * gridSize, canvas.height - gridSize)
        }));
        food.x = Math.min(Math.floor(food.x / gridSize) * gridSize, canvas.width - gridSize);
        food.y = Math.min(Math.floor(food.y / gridSize) * gridSize, canvas.height - gridSize);

        if (currentGameState === STATES.PLAYING) {
            drawGame();
        }
    }
};

// debouncing for resize and orientationchange events
let resizeTimeout;
const debounceResize = () => {
    if (window.innerWidth < 500) {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(resizeCanvas, 100);
    }
};

// event handlers
window.addEventListener('resize', debounceResize);
window.addEventListener('orientationchange', debounceResize);

// call on initial load
readThemeFromCSS();
resizeCanvas();
setGameState(STATES.START)
