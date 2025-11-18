document.addEventListener('DOMContentLoaded', () => {
    // init game
    const gameOptions = {
        gameSpeed: 250, // base speed
        gridSize: 20,

        minSpeed: 50, // speed limit

        // default for big screen
        accelerationSteps: [
            { threshold: 150, decrement: 15 }, // if gameSpeed > 150, speed up by 15
            { threshold: 100, decrement: 10 }, // if gameSpeed > 100, speed up by 10
            { threshold: 50,  decrement: 5 }   // if gameSpeed > 50, speed up by 5
        ],

        response: [
            // desctop
            { responseSize: 1500, gameSpeed: 150, gridSize: 20 },

            // tablet
            { responseSize: 850, gameSpeed: 200, gridSize: 28,
              accelerationSteps: [
                { threshold: 150, decrement: 10 },
                { threshold: 100, decrement: 8 },
                { threshold: 50,  decrement: 4 }
              ]
            },

            // mobile
            { responseSize: 400, gameSpeed: 250, gridSize: 21,
              accelerationSteps: [
                { threshold: 200, decrement: 10 },
                { threshold: 150, decrement: 5 }
              ]
            },
        ],
    };

    const mySnakeGame = new SnakeGame('#canvasSnake', gameOptions);
});
