import './sass/main.scss';
// import canvasDots from './headerCanvas.js';
// import canvasDotsBg from './backgroundCanvas.js';
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
    'webdev': 'rgb(158, 126, 42)',         // Muted Brass
    'llm': 'rgb(180, 168, 140)',           // Warm Tan
    'problemsolving': 'rgb(170, 155, 120)', // Sandy Khaki
    'backend': 'rgb(107, 113, 96)',        // Olive Slate
    'algorithms': 'rgb(145, 130, 100)',    // Warm Umber
    'devtool': 'rgb(130, 120, 105)',       // Warm Gray
    'geospatial': 'rgb(150, 135, 110)',    // Warm Sand
    'python': 'rgb(175, 160, 120)',        // Light Amber
    'datamodel': 'rgb(160, 145, 115)',     // Warm Ochre
    'simulation': 'rgb(140, 135, 120)'     // Stone Gray
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

const MET_DIRECT_API_BASE = 'https://collectionapi.metmuseum.org/public/collection/v1';
const MET_PROXY_API_BASE = '/api/met';
const MET_API_BASE =
    window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? MET_PROXY_API_BASE
        : MET_DIRECT_API_BASE;
const MET_HERO_STORAGE_KEY = 'metHeroArtwork';
const MET_SEARCH_CACHE_KEY = 'metSearchIDs';
const MET_SEARCH_CACHE_TTL = 30 * 60 * 1000;

function getStoredMetHero() {
    try {
        const stored = sessionStorage.getItem(MET_HERO_STORAGE_KEY);
        return stored ? JSON.parse(stored) : null;
    } catch { return null; }
}

function storeMetHero(data) {
    try { sessionStorage.setItem(MET_HERO_STORAGE_KEY, JSON.stringify(data)); } catch {}
}

function getCachedSearchIDs() {
    try {
        const raw = sessionStorage.getItem(MET_SEARCH_CACHE_KEY);
        if (!raw) return null;
        const { ids, expires } = JSON.parse(raw);
        if (Date.now() > expires) {
            sessionStorage.removeItem(MET_SEARCH_CACHE_KEY);
            return null;
        }
        return ids;
    } catch { return null; }
}

function cacheSearchIDs(ids) {
    try {
        sessionStorage.setItem(MET_SEARCH_CACHE_KEY, JSON.stringify({
            ids, expires: Date.now() + MET_SEARCH_CACHE_TTL,
        }));
    } catch {}
}

function pickRandom(arr, count) {
    const copy = arr.slice();
    const result = [];
    for (let i = 0; i < Math.min(count, copy.length); i++) {
        const idx = Math.floor(Math.random() * (copy.length - i));
        result.push(copy[idx]);
        copy[idx] = copy[copy.length - 1 - i];
    }
    return result;
}

function timeoutSignal(ms, parentSignal) {
    const controller = new AbortController();
    const timer = setTimeout(
        () => controller.abort(new DOMException('Timeout', 'TimeoutError')), ms
    );
    parentSignal?.addEventListener('abort', () => {
        clearTimeout(timer);
        controller.abort(parentSignal.reason);
    }, { once: true });
    return controller.signal;
}

async function getImageDimensions(url, parentSignal) {
    try {
        const res = await fetch(url, {
            headers: { 'Range': 'bytes=0-65535' },
            signal: timeoutSignal(8000, parentSignal),
        });
        if (!res.ok && res.status !== 206) return null;

        const buffer = await res.arrayBuffer();
        const view = new Uint8Array(buffer);

        if (view[0] !== 0xFF || view[1] !== 0xD8) return null;

        let i = 2;
        while (i < view.length - 8) {
            if (view[i] !== 0xFF) { i++; continue; }
            const marker = view[i + 1];
            const isSOF = (marker >= 0xC0 && marker <= 0xC3)
                       || (marker >= 0xC5 && marker <= 0xC7)
                       || (marker >= 0xC9 && marker <= 0xCB)
                       || (marker >= 0xCD && marker <= 0xCF);
            if (isSOF) {
                return {
                    height: (view[i + 5] << 8) | view[i + 6],
                    width: (view[i + 7] << 8) | view[i + 8],
                };
            }
            if (marker === 0xD8 || marker === 0xD9 || marker === 0x01
                || (marker >= 0xD0 && marker <= 0xD7)) {
                i += 2;
            } else {
                if (i + 3 >= view.length) break;
                i += 2 + ((view[i + 2] << 8) | view[i + 3]);
            }
        }
        return null;
    } catch {
        return null;
    }
}

let _progressHighWater = 0;

function showMetProgress(percent, text) {
    const container = document.getElementById('met-attr');
    const progressBar = document.getElementById('met-attr-progress-bar');
    const progressText = document.getElementById('met-attr-progress-text');
    if (!container || !progressBar || !progressText) return;

    _progressHighWater = Math.max(_progressHighWater, Math.min(100, Math.max(0, percent)));
    container.classList.add('met-attr--loading');
    container.style.display = 'flex';
    progressBar.style.width = `${_progressHighWater}%`;
    progressText.textContent = text || 'Loading artwork...';
}

function hideMetProgress() {
    const container = document.getElementById('met-attr');
    if (container) container.classList.remove('met-attr--loading');
}

function showDefaultHeroInfo() {
    const container = document.getElementById('met-attr');
    const titleEl = document.getElementById('met-attr-title');
    const metaEl = document.getElementById('met-attr-meta');
    const linkEl = document.getElementById('met-attr-link');
    const sourceEl = document.getElementById('met-attr-source');
    if (!container || !titleEl || !metaEl || !linkEl) return;
    hideMetProgress();
    titleEl.textContent = 'The Annunciation (Redux)';
    metaEl.textContent = 'AI Generated';
    linkEl.removeAttribute('href');
    linkEl.style.textDecoration = 'none';
    linkEl.style.cursor = 'default';
    if (sourceEl) sourceEl.textContent = 'A contemporary reinterpretation of a biblical scene; the state of connection and isolation.';
    container.style.display = 'flex';
}

function updateMetAttribution(artwork) {
    const container = document.getElementById('met-attr');
    const titleEl = document.getElementById('met-attr-title');
    const metaEl = document.getElementById('met-attr-meta');
    const linkEl = document.getElementById('met-attr-link');
    const sourceEl = document.getElementById('met-attr-source');
    if (!container || !titleEl || !metaEl || !linkEl) return;
    hideMetProgress();
    if (!artwork || !artwork.imageUrl || !artwork.objectURL) {
        showDefaultHeroInfo();
        return;
    }
    const parts = [];
    if (artwork.artistDisplayName) parts.push(artwork.artistDisplayName);
    if (artwork.objectDate) parts.push(artwork.objectDate);
    titleEl.textContent = artwork.title || 'Untitled';
    metaEl.textContent = parts.join(' · ');
    linkEl.href = artwork.objectURL;
    linkEl.style.textDecoration = '';
    linkEl.style.cursor = '';
    if (sourceEl) sourceEl.textContent = 'The Metropolitan Museum of Art';
    container.style.display = 'flex';
}

async function fetchRandomMetArtworkWithImage(onProgress, signal) {
    onProgress?.(8, 'Searching collection...');
    let objectIDs = getCachedSearchIDs();
    if (!objectIDs) {
        const res = await fetch(
            `${MET_API_BASE}/search?hasImages=true&q=painting`,
            { signal: timeoutSignal(12000, signal) }
        );
        if (!res.ok) throw new Error('Met search failed');
        const data = await res.json();
        objectIDs = data.objectIDs || [];
        if (!objectIDs.length) throw new Error('No Met painting IDs returned');
        cacheSearchIDs(objectIDs);
    }

    onProgress?.(20, 'Fetching candidates...');
    const candidateIDs = pickRandom(objectIDs, 20);
    const objResults = await Promise.allSettled(
        candidateIDs.map(id =>
            fetch(`${MET_API_BASE}/objects/${id}`, { signal: timeoutSignal(10000, signal) })
                .then(r => r.ok ? r.json() : Promise.reject(r.status))
        )
    );

    onProgress?.(50, 'Filtering paintings...');
    const paintings = objResults
        .filter(r => r.status === 'fulfilled')
        .map(r => r.value)
        .filter(obj => {
            if (!obj.primaryImage && !obj.primaryImageSmall) return false;
            const cls = (obj.classification || '').toLowerCase();
            const name = (obj.objectName || '').toLowerCase();
            const dept = (obj.department || '').toLowerCase();
            return cls.includes('paintings') || name.includes('painting') || dept.includes('paintings');
        });

    if (!paintings.length) throw new Error('No paintings found in candidate batch');

    onProgress?.(65, 'Checking image dimensions...');
    const viewportPortrait = window.matchMedia('(orientation: portrait)').matches;

    const dimResults = await Promise.allSettled(
        paintings.map(async obj => {
            const checkUrl = obj.primaryImageSmall || obj.primaryImage;
            const dims = await getImageDimensions(checkUrl, signal);
            if (!dims) return { obj, fits: null };
            const fits = viewportPortrait
                ? dims.height >= dims.width
                : dims.width >= dims.height;
            return { obj, fits };
        })
    );

    const resolved = dimResults
        .filter(r => r.status === 'fulfilled')
        .map(r => r.value);

    let chosen = resolved.find(r => r.fits === true)?.obj;
    if (!chosen) chosen = resolved.find(r => r.fits === null)?.obj;
    if (!chosen) chosen = resolved.find(r => r.fits === false)?.obj;

    if (!chosen) throw new Error('No suitable artwork found in this batch');

    onProgress?.(88, 'Loading image...');
    return {
        objectID: chosen.objectID,
        imageUrl: chosen.primaryImage || chosen.primaryImageSmall,
        previewUrl: chosen.primaryImageSmall || chosen.primaryImage,
        title: chosen.title,
        artistDisplayName: chosen.artistDisplayName,
        objectDate: chosen.objectDate,
        objectURL: chosen.objectURL,
    };
}

async function loadMetHeroImage(heroImageEl, fallbackSrc, { useCache = true, signal } = {}) {
    if (!heroImageEl) return;

    const previousSrc = heroImageEl.src;

    if (useCache) {
        const cached = getStoredMetHero();
        if (cached && cached.imageUrl) {
            const preload = new Image();
            preload.onload = () => {
                heroImageEl.src = cached.imageUrl;
                updateMetAttribution(cached);
            };
            preload.onerror = () => {
                heroImageEl.src = fallbackSrc;
                showDefaultHeroInfo();
            };
            preload.src = cached.imageUrl;
            return;
        }
    }

    try {
        _progressHighWater = 0;
        showMetProgress(0, 'Starting...');

        const artwork = await fetchRandomMetArtworkWithImage(showMetProgress, signal);

        showMetProgress(92, 'Displaying artwork...');

        heroImageEl.src = artwork.previewUrl;
        updateMetAttribution(artwork);
        storeMetHero(artwork);

        if (artwork.imageUrl !== artwork.previewUrl) {
            const fullRes = new Image();
            fullRes.onload = () => {
                if (heroImageEl.src === artwork.previewUrl) {
                    heroImageEl.src = artwork.imageUrl;
                }
            };
            fullRes.src = artwork.imageUrl;
        }

    } catch (e) {
        if (e?.name === 'AbortError') return;

        heroImageEl.src = previousSrc || fallbackSrc;
        showDefaultHeroInfo();
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
    // canvasDotsBg();
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
        heroImage.src = annunciationImg;
        showDefaultHeroInfo();

        const autoController = new AbortController();
        let activeFetchController = autoController;
        loadMetHeroImage(heroImage, annunciationImg, { useCache: true, signal: autoController.signal })
            .finally(() => {
                if (activeFetchController === autoController) activeFetchController = null;
            });

        const metButton = document.getElementById('ai-hero-met-btn');

        if (metButton) {
            metButton.addEventListener('click', () => {
                if (activeFetchController) {
                    activeFetchController.abort();
                }
                activeFetchController = new AbortController();
                const { signal } = activeFetchController;

                metButton.disabled = true;
                metButton.textContent = 'Loading…';

                loadMetHeroImage(heroImage, annunciationImg, { useCache: false, signal })
                    .finally(() => {
                        activeFetchController = null;
                        metButton.disabled = false;
                        metButton.textContent = 'Load random artwork (Met API)';
                    });
            });

            window.matchMedia('(orientation: portrait)').addEventListener('change', () => {
                sessionStorage.removeItem(MET_HERO_STORAGE_KEY);
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

    const scrollIndicator = document.getElementById('scroll-indicator');
    if (scrollIndicator) {
        setTimeout(() => {
            scrollIndicator.classList.add('scroll-indicator--visible');
        }, 2000);

        const heroEl = document.getElementById('header');
        window.addEventListener('scroll', () => {
            const threshold = heroEl ? heroEl.offsetHeight * 0.25 : 200;
            if (window.scrollY > threshold) {
                scrollIndicator.classList.add('scroll-indicator--hidden');
            } else {
                scrollIndicator.classList.remove('scroll-indicator--hidden');
            }
        }, { passive: true });
    }
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
