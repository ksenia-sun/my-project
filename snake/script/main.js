document.addEventListener('DOMContentLoaded', () => {
    // init game
    const gameOptions = {
        gameSpeed: 250,
        responseSize: 500,
        gridSize: 20,
    };
    const mySnakeGame = new SnakeGame('#canvasSnake', gameOptions);
});
