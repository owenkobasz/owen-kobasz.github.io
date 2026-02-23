import './sass/main.scss';
// import canvasDots from './headerCanvas.js';
import canvasDotsBg from './backgroundCanvas.js';
import Typed from 'typed.js';
import { sendEmail } from './emailjs.js';
import { initSkillTooltips } from './tooltip.js';
import AIHeroModal from './aiHeroModal.js';

// Import all images
import htmlImg from './assets/html.png';
import unrealImg from './assets/unreal.svg';
import brainEngineImg from './assets/brain-engine.svg';
import jsImg from './assets/js.png';
import cssImg from './assets/css.png';
import dockerImg from './assets/docker.svg';
import globeImg from './assets/globe.svg';
import pythonImg from './assets/snake.svg';
import sqlSvgImg from './assets/SQL.svg';
import puzzleImg from './assets/puzzle.svg';
import githubLogoImg from './assets/github-logo.png';
import mailImg from './assets/mail.png';
import linkedinLogoImg from './assets/linkedin_logo.png';
import aboutImg from './assets/about.jpg';
import turboImg from './assets/turbo.jpg';
import cycloneImg from './assets/cyclone.jpg';
import clipboardImg from './assets/clipboard.svg';
import briefcaseImg from './assets/briefcase-2.svg';
import webdev from './assets/web-dev.svg';
import algorithms from './assets/Algorithms.svg';
import serverImg from './assets/server.svg';
import annunciationImg from './assets/Annunciation.png';


// Import resume
import resumeFile from './assets/resume.pdf';

// Color palette for skills section
const skillColors = {
    'webdev': 'rgb(100, 149, 237)',        // Cornflower Blue
    'llm': 'rgb(255, 182, 193)',           // Light Pink
    'problemsolving': 'rgb(255, 218, 185)', // Peach
    'backend': 'rgb(144, 238, 144)',        // Light Green
    'algorithms': 'rgb(255, 160, 122)',     // Light Salmon
    'devtool': 'rgb(221, 160, 221)',        // Plum
    'geospatial': 'rgb(240, 128, 128)',      // Light Coral
    'python': 'rgb(255, 250, 205)',         // Lemon Chiffon
    'datamodel': 'rgb(255, 192, 203)',      // Pink
    'simulation': 'rgb(176, 224, 230)'      // Powder Blue
};

// Convert RGB to CSS filter for SVG coloring
function rgbToCssFilter(rgb) {
    const match = rgb.match(/\d+/g);
    if (!match || match.length !== 3) return '';
    
    const r = parseInt(match[0]) / 255;
    const g = parseInt(match[1]) / 255;
    const b = parseInt(match[2]) / 255;
    
    // Calculate brightness (luminance)
    const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
    
    // Calculate hue and saturation
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;
    
    let hue = 0;
    if (delta !== 0) {
        if (max === r) {
            hue = ((g - b) / delta) % 6;
        } else if (max === g) {
            hue = (b - r) / delta + 2;
        } else {
            hue = (r - g) / delta + 4;
        }
    }
    hue = hue * 60;
    if (hue < 0) hue += 360;
    
    const saturation = max === 0 ? 0 : delta / max;
    const invertAmount = Math.max(0, Math.min(100, brightness * 100));
    
    return `brightness(0) saturate(100%) invert(${invertAmount}%) sepia(${Math.round(saturation * 100)}%) hue-rotate(${Math.round(hue)}deg) saturate(${Math.round(saturation * 300 + 100)}%) brightness(${Math.round((brightness * 0.8 + 0.2) * 100)}%)`;
}

// ------- Met Museum Hero Background --------

// Use local API proxy to avoid browser CORS issues with The Met's API
const MET_API_BASE = '/api/met';
const MET_HERO_STORAGE_KEY = 'metHeroArtwork';

function getStoredMetHero() {
    try {
        const stored = sessionStorage.getItem(MET_HERO_STORAGE_KEY);
        if (!stored) return null;
        return JSON.parse(stored);
    } catch (e) {
        return null;
    }
}

function storeMetHero(data) {
    try {
        sessionStorage.setItem(MET_HERO_STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
        // Ignore storage errors (e.g., disabled storage)
    }
}

function isHorizontalImage(url) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            // Treat "horizontal" as wider than tall by a comfortable margin
            resolve(img.naturalWidth >= img.naturalHeight);
        };
        img.onerror = () => resolve(false);
        img.src = url;
    });
}

function showMetProgress(percent, text) {
    const container = document.getElementById('met-attr');
    const progressBar = document.getElementById('met-attr-progress-bar');
    const progressText = document.getElementById('met-attr-progress-text');

    if (!container || !progressBar || !progressText) return;

    container.classList.add('met-attr--loading');
    container.style.display = 'flex';
    progressBar.style.width = `${Math.min(100, Math.max(0, percent))}%`;
    progressText.textContent = text || 'Loading artwork...';
}

function hideMetProgress() {
    const container = document.getElementById('met-attr');
    if (container) {
        container.classList.remove('met-attr--loading');
    }
}

function updateMetAttribution(artwork) {
    const container = document.getElementById('met-attr');
    const titleEl = document.getElementById('met-attr-title');
    const metaEl = document.getElementById('met-attr-meta');
    const linkEl = document.getElementById('met-attr-link');

    if (!container || !titleEl || !metaEl || !linkEl) return;

    hideMetProgress();

    if (!artwork || !artwork.imageUrl || !artwork.objectURL) {
        container.style.display = 'none';
        titleEl.textContent = '';
        metaEl.textContent = '';
        linkEl.removeAttribute('href');
        return;
    }

    const title = artwork.title || 'Untitled';
    const parts = [];
    if (artwork.artistDisplayName) parts.push(artwork.artistDisplayName);
    if (artwork.objectDate) parts.push(artwork.objectDate);

    titleEl.textContent = title;
    metaEl.textContent = parts.join(' · ');
    linkEl.href = artwork.objectURL;
    container.style.display = 'flex';
}
async function fetchRandomMetArtworkWithImage(onProgress) {
    // Use search endpoint to narrow to artworks that are likely paintings and have images
    onProgress?.(10, 'Searching paintings...');
    const searchRes = await fetch(
        `${MET_API_BASE}/search?hasImages=true&q=painting`
    );
    if (!searchRes.ok) {
        throw new Error('Failed to search Met objects');
    }
    const searchData = await searchRes.json();
    const objectIDs = searchData.objectIDs || [];
    if (!objectIDs.length) {
        throw new Error('No Met painting object IDs returned');
    }

    onProgress?.(30, 'Finding suitable artwork...');
    // Try a larger number of random picks to find a horizontal painting with an image
    const maxAttempts = 20;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const randomId = objectIDs[Math.floor(Math.random() * objectIDs.length)];
        onProgress?.(30 + (attempt * 5), `Checking artwork ${attempt + 1}/${maxAttempts}...`);
        const objRes = await fetch(`${MET_API_BASE}/objects/${randomId}`);
        if (!objRes.ok) {
            continue;
        }
        const objData = await objRes.json();
        const imageUrl = objData.primaryImage || objData.primaryImageSmall;
        const classification = (objData.classification || '').toLowerCase();
        const objectName = (objData.objectName || '').toLowerCase();
        const department = (objData.department || '').toLowerCase();

        const isPainting =
            classification.includes('paintings') ||
            objectName.includes('painting') ||
            department.includes('paintings');

        if (imageUrl && isPainting) {
            onProgress?.(70, 'Verifying image orientation...');
            const isHorizontal = await isHorizontalImage(imageUrl);
            if (!isHorizontal) {
                continue;
            }

            onProgress?.(90, 'Loading image...');
            return {
                objectID: objData.objectID,
                imageUrl,
                title: objData.title,
                artistDisplayName: objData.artistDisplayName,
                objectDate: objData.objectDate,
                objectURL: objData.objectURL,
            };
        }
    }

    throw new Error('Unable to find Met artwork with image after several attempts');
}

async function loadMetHeroImage(heroImageEl, fallbackSrc, { useCache = true } = {}) {
    if (!heroImageEl) return;

    // Try to use cached artwork for this session first
    if (useCache) {
        const cached = getStoredMetHero();
        if (cached && cached.imageUrl) {
            const preload = new Image();
            preload.onload = () => {
                heroImageEl.src = cached.imageUrl;
                updateMetAttribution(cached);
            };
            preload.onerror = () => {
                // If cached URL fails, silently fall back to static image
                heroImageEl.src = fallbackSrc;
                updateMetAttribution(null);
            };
            preload.src = cached.imageUrl;
            return;
        }
    }

    // Otherwise, fetch a fresh random artwork (or when forcing refresh)
    try {
        showMetProgress(0, 'Starting...');
        const artwork = await fetchRandomMetArtworkWithImage((percent, text) => {
            showMetProgress(percent, text);
        });
        
        if (!artwork || !artwork.imageUrl) {
            // If we fail to get a new artwork, keep whatever image is currently shown
            updateMetAttribution(null);
            return;
        }

        showMetProgress(95, 'Finalizing...');
        const preload = new Image();
        preload.onload = () => {
            heroImageEl.src = artwork.imageUrl;
            storeMetHero(artwork);
            updateMetAttribution(artwork);
        };
        preload.onerror = () => {
            // If the new image fails to load, keep the previous hero image
            updateMetAttribution(null);
        };
        preload.src = artwork.imageUrl;
    } catch (e) {
        // Network/API failure – keep fallback hero
        heroImageEl.src = fallbackSrc;
        updateMetAttribution(null);
    }
}

// Apply colors to skills
function applyColorsToSkills() {
    const backgroundColor = getComputedStyle(document.body).backgroundColor || 'rgb(26, 26, 26)';
    
    Object.keys(skillColors).forEach((skillKey) => {
        const item = document.querySelector(`.skills__item--${skillKey}`);
        if (item) {
            const color = skillColors[skillKey];
            
            // Apply color to border
            item.style.backgroundImage = `linear-gradient(${backgroundColor}, ${backgroundColor}), radial-gradient(circle at top left, ${color}, ${color})`;
            
            // Apply color to SVG image
            const img = item.querySelector('img');
            if (img) {
                img.style.filter = rgbToCssFilter(color);
            }
        }
    });
}

window.onload = function () {
    canvasDotsBg();
    // canvasDots(); // Replaced with static image

    // Typed Initiate
    if (document.querySelector('.typed-text-output')) {
        const typedStrings = document.querySelector('.typed-text').textContent;
        const typed = new Typed('.typed-text-output', {
            strings: typedStrings.split(', '),
            typeSpeed: 100,
            backSpeed: 20,
            smartBackspace: false,
            loop: true
        });
    }

    // Set image sources after webpack processes them
    const heroImage = document.querySelector('.hero-image');
    if (heroImage) {
        // Use static image as immediate fallback, then upgrade to Met artwork
        loadMetHeroImage(heroImage, annunciationImg, { useCache: true });

        // Attach button to load a brand new Met artwork on demand
        const metButton = document.getElementById('ai-hero-met-btn');
        if (metButton) {
            metButton.addEventListener('click', () => {
                loadMetHeroImage(heroImage, annunciationImg, { useCache: false });
            });
        }
    }
    
    const profileImg = document.querySelector('.profile__picture img');
    if (profileImg) profileImg.src = aboutImg;
    
    const webdevImg = document.querySelector('.skills__item--webdev img');
    if (webdevImg) webdevImg.src = webdev;
    
    const algorithmsImg = document.querySelector('.skills__item--algorithms img');
    if (algorithmsImg) algorithmsImg.src = algorithms;
    
    const backendImgEl = document.querySelector('.skills__item--backend img');
    if (backendImgEl) backendImgEl.src = serverImg;
    
    const llmImg = document.querySelector('.skills__item--llm img');
    if (llmImg) llmImg.src = brainEngineImg;
    
    const jsImgEl = document.querySelector('.skills__item--js img');
    if (jsImgEl) jsImgEl.src = jsImg;
    
    const simulationImgEl = document.querySelector('.skills__item--simulation img');
    if (simulationImgEl) simulationImgEl.src = unrealImg;
    
    const devtoolImgEl = document.querySelector('.skills__item--devtool img');
    if (devtoolImgEl) devtoolImgEl.src = dockerImg;
    
    const geospatialImgEl = document.querySelector('.skills__item--geospatial img');
    if (geospatialImgEl) geospatialImgEl.src = globeImg;
    
    const pythonImgEl = document.querySelector('.skills__item--python img');
    if (pythonImgEl) pythonImgEl.src = pythonImg;
    
    const datamodelImg = document.querySelector('.skills__item--datamodel img');
    if (datamodelImg) datamodelImg.src = sqlSvgImg;
    
    const problemSolvingImg = document.querySelector('.skills__item--problemsolving img');
    if (problemSolvingImg) problemSolvingImg.src = puzzleImg;

    // Project images
    document.querySelector('.project-left .project__image-image img').src = cycloneImg;
    document.querySelector('.project-right .project__image-image img').src = turboImg;

    // Footer images
    document.querySelector('.socials__github img').src = githubLogoImg;
    document.querySelector('.socials__email img').src = mailImg;
    document.querySelector('.socials__linkedin img').src = linkedinLogoImg;

    // Set resume link and briefcase icon
    document.getElementById('resume-link').href = resumeFile;
    const resumeClipboard = document.querySelector('.heading-cta--resume img');
    if (resumeClipboard) {
        resumeClipboard.src = briefcaseImg;
    }
    
    // Apply colors to skills
    applyColorsToSkills();
    
    // Initialize skill tooltips
    initSkillTooltips();
    
    // Initialize AI Hero Modal
    new AIHeroModal();
};

// loads in about section on scroll
function aboutFadeIn(entries, observer) {
    entries.forEach((entry) => {
        if (entry.isIntersecting && document.body.scrollWidth > 1300) {
            // console.log('yo');
            // fade in bio
            document.querySelector('.profile').classList.add('profile__fade-in');

            // fade in skills 1 at a time after bio has loaded
            const sleep = (milliseconds) => {
                return new Promise((resolve) => setTimeout(resolve, milliseconds));
            };

            //webdev
            sleep(1000).then(() => {
                document
                    .querySelector('.skills__item--webdev')
                    .classList.add('skills__item-fade-in');
            });

            //datamodel
            sleep(1100).then(() => {
                document
                    .querySelector('.skills__item--datamodel')
                    .classList.add('skills__item-fade-in');
            });

            //algorithms
            sleep(1200).then(() => {
                document
                    .querySelector('.skills__item--algorithms')
                    .classList.add('skills__item-fade-in');
            });

            //geospatial
            sleep(1300).then(() => {
                document
                    .querySelector('.skills__item--geospatial')
                    .classList.add('skills__item-fade-in');
            });

            //python
            sleep(1400).then(() => {
                document
                    .querySelector('.skills__item--python')
                    .classList.add('skills__item-fade-in');
            });

            //llm
            sleep(1500).then(() => {
                document
                    .querySelector('.skills__item--llm')
                    .classList.add('skills__item-fade-in');
            });

            //devtool
            sleep(1600).then(() => {
                document
                    .querySelector('.skills__item--devtool')
                    .classList.add('skills__item-fade-in');
            });

            //backend
            sleep(1700).then(() => {
                document
                    .querySelector('.skills__item--backend')
                    .classList.add('skills__item-fade-in');
            });

            //problemsolving
            sleep(1800).then(() => {
                document
                    .querySelector('.skills__item--problemsolving')
                    .classList.add('skills__item-fade-in');
            });

            //simulation
            sleep(1900).then(() => {
                document
                    .querySelector('.skills__item--simulation')
                    .classList.add('skills__item-fade-in');
            });
        }
    });
}

let options = {
    root: null,
    rootMargin: '0px',
    threshold: 0.5,
};

let options2 = {
    root: null,
    rootMargin: '0px',
    threshold: 0.2,
};

let observer = new IntersectionObserver(aboutFadeIn, options);

const aboutContentEl = document.querySelector('.about__content');
if (aboutContentEl) {
    observer.observe(aboutContentEl);
}

// navigation items in nav bar
const navLinks = document.querySelectorAll('.navigation__item');

// change highlighted nav link depending on page position
function navFadeIn(entries, observer) {
    entries.forEach((entry) => {
        if (entry.isIntersecting) {
            // console.log(entry.target.id);

            navLinks.forEach((link) => {
                link.classList.remove('navigation__item--active');
            });

            document
                .querySelector(`#nav-${entry.target.id}`)
                .classList.add('navigation__item--active');
        }
    });
}

// projects section is a lot longer and needs custom settings
function navFadeInProjects(entries, observer) {
    entries.forEach((entry) => {
        if (entry.isIntersecting) {
            // console.log(entry.target.id);

            navLinks.forEach((link) => {
                link.classList.remove('navigation__item--active');
            });

            document
                .querySelector(`#nav-${entry.target.id}`)
                .classList.add('navigation__item--active');
        }
    });
}

let observerNav = new IntersectionObserver(navFadeIn, options);

const headerEl = document.querySelector('#header');
const aboutEl = document.querySelector('#about');
const contactEl = document.querySelector('#contact');

if (headerEl) observerNav.observe(headerEl);
if (aboutEl) observerNav.observe(aboutEl);
if (contactEl) observerNav.observe(contactEl);

let observerNavProjects = new IntersectionObserver(navFadeInProjects, options2);

const projectsEl = document.querySelector('#projects');
if (projectsEl) observerNavProjects.observe(projectsEl);

// parralax scrolling effect on hero canvas

// window.onscroll = function (e) {
//   console.log(document.scrollTop);
// };

// document.addEventListener('scroll', () => {
//   // console.log(window.scrollY);

//   document.querySelector('.connecting-dots').style.top = `${window.scrollY}px`;
// });

// form validation

const re = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
document.querySelector('#form-submit').addEventListener('click', () => {
    const unameInput = document.querySelector('.contact__form-name');
    const emailInput = document.querySelector('.contact__form-email');
    const msgInput = document.querySelector('.contact__form-message');

    const uname = unameInput.value;
    const email = emailInput.value;
    const msg = msgInput.value;

    const unameError = document.querySelector('.form-error__name');
    const emailError = document.querySelector('.form-error__email');
    const msgError = document.querySelector('.form-error__msg');

    let validUname = false;
    let validEmail = false;
    let validMsg = false;

    // console.log(uname, email, msg);
    if (!uname) {
        validUname = false;
        unameInput.classList.add('input-error');
        unameError.style.display = 'block';
    } else {
        validUname = true;
        unameInput.classList.remove('input-error');
        unameError.style.display = 'none';
    }

    if (!email.match(re)) {
        validEmail = false;
        emailInput.classList.add('input-error');
        emailError.style.display = 'block';
    } else {
        validEmail = true;
        emailInput.classList.remove('input-error');
        emailError.style.display = 'none';
    }

    if (!msg) {
        validMsg = false;
        msgInput.classList.add('input-error');
        msgError.style.display = 'block';
    } else {
        validMsg = true;
        msgInput.classList.remove('input-error');
        msgError.style.display = 'none';
    }

    if (validUname && validEmail && validMsg) {
        // Submit to Firebase instead of default form submission
        const formData = {
            name: uname,
            email: email,
            message: msg
        };

        // Show loading state
        const submitButton = document.querySelector('#form-submit');
        const originalText = submitButton.textContent;
        submitButton.textContent = 'Sending...';
        submitButton.disabled = true;

        // Send email via EmailJS only
        sendEmail(formData).then((emailResult) => {
            if (emailResult.success) {
                // Show success message
                submitButton.textContent = 'Sent!';
                submitButton.style.color = '#4CAF50';

                // Clear form
                document.querySelector('.contact__form').reset();

                // Reset button after delay
                setTimeout(() => {
                    submitButton.textContent = originalText;
                    submitButton.style.color = '';
                    submitButton.disabled = false;
                }, 3000);
            } else {
                // Show error message
                submitButton.textContent = 'Error!';
                submitButton.style.color = '#f44336';

                // Reset button after delay
                setTimeout(() => {
                    submitButton.textContent = originalText;
                    submitButton.style.color = '';
                    submitButton.disabled = false;
                }, 3000);

                console.error('Email sending failed:', emailResult);
            }
        }).catch((error) => {
            submitButton.textContent = 'Error!';
            submitButton.style.color = '#f44336';
            setTimeout(() => {
                submitButton.textContent = originalText;
                submitButton.style.color = '';
                submitButton.disabled = false;
            }, 3000);
            console.error('Email sending error:', error);
        });
    }
});
