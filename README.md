# My Portfolio Site

Hi! This is my personal portfolio website. Check it out live at [owenkobasz.com](https://owenkobasz.com).

Built to showcase my work as a software engineer. Vanilla JavaScript, Webpack, and Sass — simple stack, fast and lightweight.

## Features

- **Met Museum hero background** — loads a random public domain painting from The Metropolitan Museum of Art on page visit
- **Typed.js integration** — cycling subtitle animation in the hero
- **Skill tooltips** — hover/tap tooltips on each skill tile in the About section
- **Blog** — static Markdown blog at `/blog`
- **EmailJS contact form**
- **Responsive design**

## Tech Stack

- JavaScript (vanilla)
- Webpack 5 for bundling
- Sass for styling
- Typed.js for hero subtitle animation
- Met Museum Open Access API (no key required) for hero background
- Node.js/Express backend — serves blog static files and proxies Met API in dev
- EmailJS for the contact form
- `markdown-it`, `gray-matter`, `highlight.js` — custom static blog generator
- `concurrently` for running dev server and webpack in parallel

## Projects Featured

1. **Cyclone** — An AI-powered cycling route generator. Uses GPT to understand natural language route requests and generates GPX-compatible rides with elevation data and turn-by-turn navigation via GraphHopper, Valhalla, and OpenStreetMap. [Live app](https://cyclone-front-end.onrender.com/#home)

2. **Turbo** — A used car market insights tool that aggregates Craigslist listings and enriches them with VIN and MSRP data. PostgreSQL on AWS, Node.js/Express backend, React frontend. Note: live demo is currently offline — AWS RDS instance is paused to avoid costs. Codebase is active on GitHub.

## A Bit About Me

I'm a software engineer with an unconventional background. I studied liberal arts at St. John's College (the great books program) before switching to tech. Before that, I worked in the fine art world as a gallery director and curator.

These days I'm building data-driven, systems-oriented applications — APIs, routing algorithms, simulation tools, and AI-integrated systems. When I'm not coding, I'm cycling, taking photos, or outdoors somewhere.

## Met Museum Hero Background

The hero section loads a random painting from [The Met's Open Access collection](https://www.metmuseum.org/about-the-met/policies-and-documents/open-access) — no API key needed.

**How it works:**
- On first page load, a background fetch begins immediately while the default image (Fra Angelico's *Annunciation*) is shown
- Same-session refreshes restore the last artwork from sessionStorage instantly (search IDs are cached for 30 minutes)
- The "Load random artwork (Met API)" button forces a fresh fetch and cancels any in-progress load
- 20 object fetches run in parallel; each candidate's dimensions are checked via a 64 KB JPEG Range request (not a full download) to select orientation-appropriate images — landscape on desktop, portrait on mobile
- Preview image loads first, then silently swaps to full resolution in the background
- An attribution panel shows the painting's title (linked to the Met's page), artist, and date

**Relevant files:** `src/index.js` (all fetch logic), `src/sass/_header.scss` (attribution panel), `src/sass/_ai-hero.scss` (button styles).

## Contact Form (EmailJS)

The contact form uses [EmailJS](https://emailjs.com). Configuration lives in `src/config.js` — replace the `serviceId`, `templateId`, and `publicKey` values with your own from the EmailJS dashboard. There's also an optional Formspree fallback field in the same file.

## Dormant Code

Some features are built but not active in the UI:

- **DALL-E hero image generator** — `src/aiHeroModal.js` and the `POST /api/hero-image` endpoint in `server.js` are complete but the modal is not exposed in the UI (`new AIHeroModal()` is never called and no trigger button exists in the HTML). I put this together when I was experimenting with different approaches for the header but decided to use the Met Api instead. The infrastructure is still there to re-activate it.
- **Canvas animations** — `src/headerCanvas.js` and `src/backgroundCanvas.js` exist from the previous animated site design; their imports in `index.js` are commented out.
- **Rangefinder overlay** — a viewfinder-style overlay is fully coded in HTML/CSS but hidden with `display: none`.

## Contact

Reach out through the contact form on the site, or find me on [LinkedIn](https://www.linkedin.com/in/owen-kobasz/) or [GitHub](https://github.com/owenkobasz).
