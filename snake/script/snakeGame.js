class SnakeGame {
    constructor(snakeCanvasSelector, options = {}) {
        // --- DOM elements ---
        this.canvas = document.querySelector(snakeCanvasSelector);
        if (!this.canvas) {
            console.error('Canvas element not found');
            return;
        }
        this.ctx = this.canvas.getContext('2d');
        this.root = document.documentElement;

        this.gameContainer = document.querySelector('.game-container');
        this.infoScoreBlock = document.querySelector('.info-score-block');
        this.scoreText = document.querySelectorAll('.score-text');
        this.recordText = document.querySelectorAll('.record-text');
        this.speedText = document.querySelectorAll('.speed-text');
        this.checkboxItem = document.querySelector('.checkbox-item');
        this.checkbox = document.querySelector('.path-checkbox');
        this.overlay = document.querySelector('.game-overlay-block');
        this.controlButtons = document.querySelectorAll('.control-button');
        this.nextButtons = document.querySelectorAll('.step-btn');
        this.currentStepElement = document.querySelector('.step-item.visible');

        // --- Constants and global state ---
        this.gridSize = options.gridSize || 20;
        this.initialGameSpeed = options.gameSpeed || 250;
        this.responseSize = options.responseSize || 500;

        // Object for storing colors used in canvas
        this.THEME = {};
        // Game state enum
        this.STATES = {
            START: 'start',
            PLAYING: 'playing',
            PAUSE: 'pause',
            GAMEOVER: 'gameover'
        };
        //  Swipe thresholds
        this.SWIPE_GRID_THRESHOLD = 2; // minimum swipe distance in grid cells
        this.minSwipeDistance = this.gridSize * this.SWIPE_GRID_THRESHOLD; // threshold for swipe
        this.MAX_TAP_DURATION_MS = 300; // maximum time for tap (in milliseconds)
        this.maxTapDistance = 30; // maximum movement for tap (in pixels)

        // --- Game state properties ---
        this.snake = [];
        this.direction = 'RIGHT';
        this.nextDirection = null;
        this.food = {};
        this.score = 0;
        this.gameSpeed = this.initialGameSpeed;
        this.recordNum = JSON.parse(localStorage.getItem('record')) || 0;
        // Time & loop control
        this.isPaused = false;
        this.lastFrameTime = 0; // last update time (for tracking delay)
        this.animationID = null; // identifier for canceling rAF
        this.currentGameState = this.STATES.START;
        // UI settings
        this.isPathLighting = this.checkbox.checked ? true : false;
        // States for touch events
        this.touchStartX = 0;
        this.touchStartY = 0;
        this.touchStartTime = 0;
        // States for resize
        this.resizeTimeout = null;

        // --- Bind 'this' ---
        this.gameLoop = this.gameLoop.bind(this);
        this.handleKeyboardInput = this.handleKeyboardInput.bind(this);
        this.handleButtonAction = this.handleButtonAction.bind(this);
        this.handleCheckboxClick = this.handleCheckboxClick.bind(this);
        this.handleTouchStart = this.handleTouchStart.bind(this);
        this.handleTouchEnd = this.handleTouchEnd.bind(this);
        this.updateStep = this.updateStep.bind(this);
        this.debounceResize = this.debounceResize.bind(this);

        // --- Init ---
        this.recordText.forEach(item => item.textContent = this.recordNum);
        this.bindEvents();
        this.readThemeFromCSS();
        this.resizeCanvas(); // first resize for load page
        this.setGameState(this.STATES.START);
    }

    // --- Event binding ---
    bindEvents() {
        this.checkboxItem.addEventListener('click', this.handleCheckboxClick);
        this.controlButtons.forEach(button => {
            button.addEventListener('click', this.handleButtonAction);
        });
        document.addEventListener('keydown', this.handleKeyboardInput);
        this.canvas.addEventListener('touchstart', this.handleTouchStart);
        this.canvas.addEventListener('touchend', this.handleTouchEnd);
        this.nextButtons.forEach(button => {
            button.addEventListener('click', this.updateStep);
        });
        window.addEventListener('resize', this.debounceResize);
        window.addEventListener('orientationchange', this.debounceResize);
    }

    handleCheckboxClick() {
        this.checkbox.checked = !this.checkbox.checked;
        this.isPathLighting = this.checkbox.checked;
    }

    // --- Utilities ---
    // Function for reading CSS variables
    readThemeFromCSS() {
        const style = getComputedStyle(this.root);

        this.THEME.FOOD = style.getPropertyValue('--game-food').trim();
        this.THEME.SNAKE_HEAD = style.getPropertyValue('--game-snake-head').trim();
        this.THEME.SNAKE_BODY = style.getPropertyValue('--game-snake-body').trim();
        this.THEME.GRID = style.getPropertyValue('--game-grid').trim();
        this.THEME.PATH_HIGHLIGHT = style.getPropertyValue('--game-path-highlight').trim();
    }

    // Core state management
    setGameState(newState) {
        this.currentGameState = newState;
        this.gameContainer.dataset.state = newState;

        if (newState !== this.STATES.PLAYING) {
             // cancel loop, if no play
             if (this.animationID) {
                cancelAnimationFrame(this.animationID);
                this.animationID = null;
            }
        }

        const isGameActive = newState === this.STATES.PLAYING || newState === this.STATES.PAUSE;
        if (isGameActive) {
            this.checkboxItem.classList.remove('is-hidden');
            this.infoScoreBlock.classList.remove('is-hide');
        } else {
            this.checkboxItem.classList.add('is-hidden');
            this.infoScoreBlock.classList.add('is-hide');
        }
    }

    // Canvas / UI
    // clear the screen to redraw the pause state
    clearCanvas() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
    getGridCenter() {
        const centerX = Math.floor((this.canvas.width - this.gridSize) / 2 / this.gridSize) * this.gridSize;
        const centerY = Math.floor((this.canvas.height - this.gridSize) / 2 / this.gridSize) * this.gridSize;
        return { x: centerX, y: centerY };
    }

    // Position check
    // if there is no snake, create food
    isPositionOnSnake(position) {
        return this.snake.some(segment => segment.x === position.x && segment.y === position.y);
    }

    // set info for score block
    updateScoreUI() {
        this.recordText.forEach(item => item.textContent = this.recordNum);
        this.scoreText.forEach(item => item.textContent = this.score);
        this.speedText.forEach(item => item.textContent = this.gameSpeed);
    }

    // --- Game Core Logic & State Management ---

    // Game state management
    // initializes all variables and starts the loop
    startGame() {
        this.snake = [{ ...this.getGridCenter() }];

        // default: the snake moves to the right
        this.direction = 'RIGHT';
        this.nextDirection = null;

        // creating food
        this.food = this.getRandomFoodPosition(); // food = { x, y }
        this.score = 0;
        this.gameSpeed = this.initialGameSpeed; // important: reset speed at start
        this.isPaused = false; // important: reset pause
        this.lastFrameTime = 0; // initialize time

        // set info for score block
        this.updateScoreUI();

        // change state
        this.setGameState(this.STATES.PLAYING);

        // start rAF loop
        this.animationID = requestAnimationFrame(this.gameLoop);
    };

    // ends the game, saves the record
    gameOver() {
        // set new record
        if (this.score > this.recordNum) {
            this.recordNum = this.score;
            localStorage.setItem('record', this.score);

            this.updateScoreUI();
        }

        // change state
        this.setGameState(this.STATES.GAMEOVER);
    }

    // toggles the pause state
    pause() {
        if (this.currentGameState !== this.STATES.PLAYING)
            return;
        this.isPaused = true;

        this.setGameState(this.STATES.PAUSE);
    }
    resumeGame() {
        if (this.currentGameState !== this.STATES.PAUSE)
            return;
        this.isPaused = false;
        // update time to avoid a sharp jump after unpausing
        this.lastFrameTime = performance.now();

        this.setGameState(this.STATES.PLAYING);

        // start rAF loop
        this.animationID = requestAnimationFrame(this.gameLoop);
    }

    // updates score, speed, creates new food
    // if the snake ate an apple
    handleFoodEaten() {
        this.food = this.getRandomFoodPosition();
        this.score += 1;

        if (this.gameSpeed > 150) this.gameSpeed -= 15;
        else if (this.gameSpeed > 100) this.gameSpeed -= 10;
        else if (this.gameSpeed > 50) this.gameSpeed -= 5;

        // set info for score block
        this.updateScoreUI();

        if ('vibrate' in navigator) {
            navigator.vibrate(100);
        }
    }

    // Positioning
    // finds a random free position
    getRandomFoodPosition() {
        let newFoodPosition;

        do {
            newFoodPosition = {
                x: Math.floor(Math.random() * (this.canvas.width / this.gridSize)) * this.gridSize,
                y: Math.floor(Math.random() * (this.canvas.height / this.gridSize)) * this.gridSize,
            }
        } while (this.isPositionOnSnake(newFoodPosition));

        return newFoodPosition;
    }

    // --- Game logic ---
    // Movement and collisions
    // updating the game state
    calculateNextHeadPosition() {
        const head = { ...this.snake[0] };
        if (this.direction === 'UP')    head.y -= this.gridSize;
        if (this.direction === 'DOWN')  head.y += this.gridSize;
        if (this.direction === 'LEFT')  head.x -= this.gridSize;
        if (this.direction === 'RIGHT') head.x += this.gridSize;

        return head;
    }
    // if hit a wall
    checkWallCollision(head) {
        return (
            head.x < 0 || head.x >= this.canvas.width ||
            head.y < 0 || head.y >= this.canvas.height
        );
    }
    // if run into ourselves
    checkSelfCollision(head) {
        for (let i = 1; i < this.snake.length; i++) {
            if (head.x === this.snake[i].x && head.y === this.snake[i].y) {
                return true;
            }
        }
        return false;
    }
    checkFoodCollision(head) {
        return head.x === this.food.x && head.y === this.food.y;
    }

    // Main update
    updateGame() {
        if (this.nextDirection) {
            this.direction = this.nextDirection;
            this.nextDirection = null; // clear buffer
        }

        const head = this.calculateNextHeadPosition();

        // if hit a wall and run into ourselves - game over
        if (this.checkWallCollision(head) || this.checkSelfCollision(head)) {
            this.gameOver();
            return;
        }

        // move snake
        this.snake.unshift(head);

        if (this.checkFoodCollision(head)) {
            this.handleFoodEaten();
        } else {
            // delete tail
            this.snake.pop();
        }
    }


    // --- Rendering ---
    drawFood() {
        this.ctx.fillStyle = this.THEME.FOOD;
        this.ctx.fillRect(this.food.x, this.food.y, this.gridSize, this.gridSize);
    }

    drawSnake() {
        this.ctx.fillStyle = this.THEME.SNAKE_HEAD;
        this.ctx.fillRect(this.snake[0].x, this.snake[0].y, this.gridSize, this.gridSize);
        // body snake
        this.ctx.fillStyle = this.THEME.SNAKE_BODY;
        for (let i = 1; i < this.snake.length; i++) {
            this.ctx.fillRect(this.snake[i].x, this.snake[i].y, this.gridSize, this.gridSize);
        }
    }

    drawGrid() {
        this.ctx.lineWidth = 0.2;
        this.ctx.strokeStyle = this.THEME.GRID;

        // draw vertical lines
        for (let x = 0; x < this.canvas.width; x += this.gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.canvas.height);
            this.ctx.stroke();
        }
        // draw horizontal lines
        for (let y = 0; y < this.canvas.height; y += this.gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(this.canvas.width, y);
            this.ctx.stroke();
        }
    }

    drawPathHighlight() {
        this.ctx.fillStyle = this.THEME.PATH_HIGHLIGHT;

        if (this.direction === 'UP' || this.direction === 'DOWN') {
            // vertical row
            this.ctx.fillRect(this.snake[0].x, 0, this.gridSize, this.canvas.height);
        } else if (this.direction === 'LEFT' || this.direction === 'RIGHT') {
            // horizontal row
            this.ctx.fillRect(0, this.snake[0].y, this.canvas.width, this.gridSize);
        }
    }

    drawGame() {
        this.clearCanvas();

        if (this.isPathLighting) {
            this.drawPathHighlight();
        }

        this.drawGrid();
        this.drawFood();
        this.drawSnake();
    }


    // --- Game loop & input handlers ---
    gameLoop(timestamp) {
        // check if the game is running; if not, exit
        if (this.currentGameState !== this.STATES.PLAYING) {
            cancelAnimationFrame(this.animationID);
            this.animationID = null;
            return;
        }

        // if the game is paused, do not continue the loop
        // and just request the next frame without updating logic
        if (this.isPaused) {
            // request the next frame
            this.animationID = requestAnimationFrame(this.gameLoop);
            return;
        }

        // --- time-based speed control logic ---
        const deltaTime = timestamp - this.lastFrameTime;

        // update game logic only if enough time has passed (gamespeed ms)
        if (deltaTime >= this.gameSpeed) {
            this.lastFrameTime = timestamp - (deltaTime % this.gameSpeed); // adjustment for accuracy

            this.updateGame();

            if (this.currentGameState === this.STATES.PLAYING) {
                this.drawGame();
            }
        }

        // request the next frame regardless of whether the logic was updated
        this.animationID = requestAnimationFrame(this.gameLoop);
    }

    // game controls
    tryChangeDirection(newDirection) {
        // rules for changing direction
        if (newDirection === 'UP' && this.direction !== 'DOWN') {
            this.nextDirection = 'UP';
        } else if (newDirection === 'DOWN' && this.direction !== 'UP') {
            this.nextDirection = 'DOWN';
        } else if (newDirection === 'LEFT' && this.direction !== 'RIGHT') {
            this.nextDirection = 'LEFT';
        } else if (newDirection === 'RIGHT' && this.direction !== 'LEFT') {
            this.nextDirection = 'RIGHT';
        }
    }

    // input handling (keyboard)
    handleKeyDirection(key) {
        switch (key) {
            case 'ArrowUp':
                this.tryChangeDirection('UP');
                break;
            case 'ArrowDown':
                this.tryChangeDirection('DOWN');
                break;
            case 'ArrowLeft':
                this.tryChangeDirection('LEFT');
                break;
            case 'ArrowRight':
                this.tryChangeDirection('RIGHT');
                break;
        }
    }
    handleKeyboardInput(event) {
        const code = event.code;

        // pause: 'space' - the same physical key
        if (code === 'Space') {
            event.preventDefault();
            // pause();
            if (this.currentGameState === this.STATES.PLAYING) {
                this.pause();
            } else if (this.currentGameState === this.STATES.PAUSE) {
                this.resumeGame();
            }
            return;
        }

        // if the game is paused, any arrow key press will unpause the game
        if (this.currentGameState !== this.STATES.PLAYING) {
            if (this.currentGameState === this.STATES.PAUSE && code.startsWith('Arrow')) {
                // processing directions
                this.handleKeyDirection(event.key);
                this.resumeGame();
            }
            return;
        }

        // processing directions
        this.handleKeyDirection(event.key);
    }

    handleButtonAction(event) {
        const action = event.target.dataset.action;

        if (!action) return;

        switch (action) {
            case 'start':
                this.startGame();
                break;
            case 'resume':
                this.resumeGame();
                break;
            default:
                console.warn(`Unknown action: ${action}`);
        }
    }

    // Input handling (Touch/Swipe)
    // touch start handler
    handleTouchStart(event) {
        event.preventDefault(); // prevent page scrolling
        const touch = event.touches[0];
        this.touchStartX = touch.clientX;
        this.touchStartY = touch.clientY;
        this.touchStartTime = Date.now(); // remember the start time of the touch
    }

    // touch end handler
    handleTouchEnd(event) {
        event.preventDefault();

        // if the game is not running, do nothing
        if (this.currentGameState === this.STATES.START || this.currentGameState === this.STATES.GAMEOVER) return;

        const touchEndTime = Date.now();
        const touchDuration = touchEndTime - this.touchStartTime;
        const touch = event.changedTouches[0];
        const deltaX = touch.clientX - this.touchStartX;
        const deltaY = touch.clientY - this.touchStartY;

        // check if it's a tap
        if (
            touchDuration < this.MAX_TAP_DURATION_MS &&
            Math.abs(deltaX) < this.maxTapDistance &&
            Math.abs(deltaY) < this.maxTapDistance
        ) {
            if (this.currentGameState === this.STATES.PLAYING) {
                this.pause();
            } else if (this.currentGameState === this.STATES.PAUSE) {
                this.resumeGame();
            }
            return;
        }

        // check if the movement is large enough for a swipe
        if (Math.abs(deltaX) > this.minSwipeDistance || Math.abs(deltaY) > this.minSwipeDistance) {
            // if the game is paused, swipe will unpause the game
            if (this.currentGameState === this.STATES.PAUSE) {
                this.resumeGame();
            }

            if (this.currentGameState === this.STATES.PLAYING) {
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
                    this.tryChangeDirection(newDirection);
                }
            }
        }
    }

    // --- UI management ---
    updateStep() {
        this.currentStepElement.classList.remove('visible');

        const nextStep = this.currentStepElement.nextElementSibling;
        if (nextStep && nextStep.classList.contains('step-item')) {
            this.currentStepElement = nextStep;
            this.currentStepElement.classList.add('visible');
        }
    }

    // --- Device/Window management ---
    // adaptation to screen size
    resizeCanvas() {
        // maximum and minimum canvas width
        const maxWidth = 400; // maximum canvas size
        const minWidth = 200; // minimum size for gameplay convenience

        // considering the screen width and height, choose the smaller value
        // get the width including padding but excluding border/margin
        const widthWithPadding = this.gameContainer.getBoundingClientRect().width;
        // get the computed styles to find padding values
        const computedStyle = getComputedStyle(this.gameContainer);
        const paddingLeft = parseFloat(computedStyle.paddingLeft) || 0;
        const paddingRight = parseFloat(computedStyle.paddingRight) || 0;
        // calculate the content width without padding
        const contentWidth = widthWithPadding - paddingLeft - paddingRight;
        const availableWidth = Math.min(contentWidth, window.innerHeight);

        // limit the canvas width
        let newWidth = Math.min(availableWidth, maxWidth);
        newWidth = Math.max(newWidth, minWidth);

        // round the width to a multiple of gridSize to make the field whole
        this.canvas.width = Math.floor(newWidth / this.gridSize) * this.gridSize;
        this.canvas.height = this.canvas.width; // keep the field square

        // recalculate the snake and food positions if the game is running
        if (this.currentGameState !== this.STATES.START) {
            this.snake = this.snake.map(segment => ({
                x: Math.min(Math.floor(segment.x / this.gridSize) * this.gridSize, this.canvas.width - this.gridSize),
                y: Math.min(Math.floor(segment.y / this.gridSize) * this.gridSize, this.canvas.height - this.gridSize)
            }));
            if (this.food.x !== undefined && this.food.y !== undefined) {
                this.food.x = Math.min(Math.floor(this.food.x / this.gridSize) * this.gridSize, this.canvas.width - this.gridSize);
                this.food.y = Math.min(Math.floor(this.food.y / this.gridSize) * this.gridSize, this.canvas.height - this.gridSize);
            }

            if (this.currentGameState === this.STATES.PLAYING) {
                this.drawGame();
            }
        }
    }

    // debouncing for resize and orientationchange events
    debounceResize() {
        if (window.innerWidth < this.responseSize) {
            clearTimeout(this.resizeTimeout);
            this.resizeTimeout = setTimeout(() => this.resizeCanvas(), 100);
        }
    }
}
