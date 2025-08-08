const canvasDots = function () {
    const canvas = document.querySelector('.connecting-dots'),
        ctx = canvas.getContext('2d'),
        colorDot = [
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
        ],
        color = 'rgb(81, 162, 233)';

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // ctx.globalAlpha = 0.8;
    canvas.width = document.body.scrollWidth;
    canvas.height = window.innerHeight;
    canvas.style.display = 'block';
    // ctx.fillStyle = colorDot;
    // ctx.fillStyle = 'hsl(' + 360 * Math.random() + ', 50%, 50%)';
    ctx.lineWidth = 0.3;
    ctx.strokeStyle = color;

    let mousePosition = {
        x: (30 * canvas.width) / 100,
        y: (30 * canvas.height) / 100,
    };

    const windowSize = window.innerWidth;
    let dots;

    if (windowSize > 1600) {
        dots = {
            nb: 150, // Reduced from 600
            array: [],
        };
    } else if (windowSize > 1300) {
        dots = {
            nb: 120, // Reduced from 575
            array: [],
        };
    } else if (windowSize > 1100) {
        dots = {
            nb: 100, // Reduced from 500
            array: [],
        };
    } else if (windowSize > 800) {
        dots = {
            nb: 80, // Reduced from 300
            array: [],
        };
    } else if (windowSize > 600) {
        dots = {
            nb: 60, // Reduced from 200
            array: [],
        };
    } else {
        dots = {
            nb: 40, // Reduced from 100
            array: [],
        };
    }

    function Dot() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;

        this.vx = -0.5 + Math.random();
        this.vy = -0.5 + Math.random();

        this.radius = Math.random() * 3 + 2; // Larger dots: 2-5px radius

        // this.colour = 'hsl(' + 360 * Math.random() + ', 50%, 50%)';
        this.colour = colorDot[Math.floor(Math.random() * colorDot.length)];
    }

    Dot.prototype = {
        create: function () {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2, false);

            // Always visible dots with full opacity
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
        for (let i = 0; i < dots.nb; i++) {
            dots.array.push(new Dot());
            var dot = dots.array[i];

            dot.create();
        }
        if (!prefersReducedMotion) {
            dot.animate();
        }
    }

    // Removed mouse following functionality
    // window.onmousemove = function (parameter) {
    //   mousePosition.x = parameter.pageX;
    //   mousePosition.y = parameter.pageY;

    //   // sometimes if the mouse is off screen on refresh, it bugs out
    //   try {
    //     // want the first dot to follow the mouse
    //     dots.array[0].x = parameter.pageX;
    //     dots.array[0].y = parameter.pageY;
    //   } catch {
    //     //
    //   }
    // };

    mousePosition.x = window.innerWidth / 2;
    mousePosition.y = window.innerHeight / 2;

    if (prefersReducedMotion) {
        createDots();
    } else {
        const draw = setInterval(createDots, 1000 / 30);

        window.onresize = function () {
            clearInterval(draw);
            canvasDots();
        };
    }
};

export default canvasDots;
