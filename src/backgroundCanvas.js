const canvasDotsBg = function () {
    const canvas = document.querySelector('.canvas-2'),
        ctx = canvas.getContext('2d');

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Set up canvas
    canvas.width = document.body.scrollWidth;
    canvas.height = window.innerHeight;
    canvas.style.display = 'block';

    // Background dots settings - same as hero
    const colorDot = [
        'rgb(100, 149, 237)',   // Cornflower Blue
        'rgb(255, 182, 193)',   // Light Pink
        'rgb(255, 218, 185)',   // Peach
        'rgb(144, 238, 144)',   // Light Green
        'rgb(255, 160, 122)',   // Light Salmon
        'rgb(221, 160, 221)',   // Plum
        'rgb(176, 224, 230)',   // Powder Blue
        'rgb(255, 250, 205)',   // Lemon Chiffon
        'rgb(255, 192, 203)',   // Pink
        'rgb(210, 180, 140)',   // Tan
        'rgb(211, 211, 211)',   // Light Gray
        'rgb(240, 128, 128)',   // Light Coral
    ];
    const color = 'rgb(81, 162, 233)'; // Same connecting lines color as hero

    ctx.lineWidth = 0.3; // Same line width as hero
    ctx.strokeStyle = color;

    let mousePosition = {
        x: (30 * canvas.width) / 100,
        y: (30 * canvas.height) / 100,
    };

    const windowSize = window.innerWidth;
    let dots;

    // Fewer dots for background to avoid overwhelming
    if (windowSize > 1600) {
        dots = {
            nb: 80,
            array: [],
        };
    } else if (windowSize > 1300) {
        dots = {
            nb: 60,
            array: [],
        };
    } else if (windowSize > 1100) {
        dots = {
            nb: 50,
            array: [],
        };
    } else if (windowSize > 800) {
        dots = {
            nb: 40,
            array: [],
        };
    } else if (windowSize > 600) {
        dots = {
            nb: 30,
            array: [],
        };
    } else {
        dots = {
            nb: 20,
            array: [],
        };
    }

    function Dot() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;

        this.vx = -0.3 + Math.random() * 0.6; // Slower movement
        this.vy = -0.3 + Math.random() * 0.6;

        this.radius = Math.random() * 3 + 2; // Same size as hero dots

        this.colour = colorDot[Math.floor(Math.random() * colorDot.length)];
    }

    Dot.prototype = {
        create: function () {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2, false);

            ctx.fillStyle = this.colour;
            ctx.fill();
        },

        animate: function () {
            // dont animate the first dot, it will follow mouse
            for (let i = 1; i < dots.nb; i++) {
                const dot = dots.array[i];

                if (dot.y < 0 || dot.y > canvas.height) {
                    dot.vx = dot.vx;
                    dot.vy = -dot.vy;
                } else if (dot.x < 0 || dot.x > canvas.width) {
                    dot.vx = -dot.vx;
                    dot.vy = dot.vy;
                }
                dot.x += dot.vx;
                dot.y += dot.vy;
            }
        },
    };

    function createDots() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Create dots
        for (let i = 0; i < dots.nb; i++) {
            dots.array.push(new Dot());
            var dot = dots.array[i];
            dot.create();
        }

        // first dot to be relatively large - same as hero
        dots.array[0].radius = 4;
        dots.array[0].colour = '#51a2e9';

        // Removed connecting lines for cleaner background

        if (!prefersReducedMotion) {
            dot.animate();
        }
    }

    if (!prefersReducedMotion) {
        window.onmousemove = function (parameter) {
            mousePosition.x = parameter.pageX;
            mousePosition.y = parameter.pageY;

            try {
                dots.array[0].x = parameter.pageX;
                dots.array[0].y = parameter.pageY;
            } catch {
                //
            }
        };
    }

    mousePosition.x = window.innerWidth / 2;
    mousePosition.y = window.innerHeight / 2;

    if (prefersReducedMotion) {
        createDots();
    } else {
        const draw = setInterval(createDots, 1000 / 30);

        window.onresize = function () {
            clearInterval(draw);
            canvasDotsBg();
        };
    }
};

export default canvasDotsBg;
