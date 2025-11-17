document.addEventListener('DOMContentLoaded', () => {
    // init game
    const gameOptions = {
        gameSpeed: 250,
        gridSize: 20,
        response: [
            { responseSize: 1500, gridSize: 20 },
            { responseSize: 800, gridSize: 28 },
            { responseSize: 350, gridSize: 24 },
        ],
    };
    const mySnakeGame = new SnakeGame('#canvasSnake', gameOptions);
});
