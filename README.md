# My Portfolio Site

Hi! This is my personal portfolio website. You can check it out live at [owenkobasz.com](https://owenkobasz.com).

I built this site to showcase my work as a software engineer. It's a pretty straightforward portfolio—you'll find info about me, some projects I've worked on, and a way to get in touch.

The site itself is built with vanilla JavaScript, Webpack, and Sass. I went with a simple stack because honestly, sometimes the simplest solution is the best one. Plus, I wanted to keep things fast and lightweight.

## Features

- **Animated canvas backgrounds**
- **Typed.js integration**
- **EmailJS contact form**
- **AI Hero Image Generator** - Generate custom hero images using OpenAI's DALL-E
- **Responsive design**

## Tech Stack

- JavaScript (vanilla, no framework needed for this)
- Webpack for bundling
- Sass for styling
- HTML5 canvas for background animations
- EmailJS for the contact form
- Node.js/Express backend for AI image generation
- OpenAI API (DALL-E 3) for hero image generation

## Projects Featured

Right now I'm showcasing two main projects:

1. **Cyclone** - An AI-powered cycling route generator. I'm a cyclist, so this was a fun one to build. It uses GPT to understand natural language route requests and generates GPX files for your bike computer.

2. **Turbo** - A used car market insights tool that scrapes Craigslist and enriches listings with VIN data. Built this to help people make better car-buying decisions.

## A Bit About Me

I'm a software engineer with a bit of an unconventional background. I studied liberal arts at St. John's College (the great books program) before making the switch to tech. Before that, I worked in the fine art world as a gallery director and curator, which taught me a lot about project management and communication.

These days I'm building web applications that often involve AI and machine learning. When I'm not coding, you'll probably find me on my bike, taking photos, or somewhere outdoors.

## Setup & Installation

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- OpenAI API key ([get one here](https://platform.openai.com/api-keys))

### Installation Steps

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd portfolio
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   
   Create a `.env` file in the root directory:
   ```env
   OPENAI_API_KEY=your_openai_api_key_here
   PORT=3001
   NODE_ENV=development
   ```

4. **Run in development mode**
   ```bash
   npm run dev
   ```
   
   This will start both the Express API server (port 3001) and the Webpack dev server (port 8080) concurrently.

5. **Build for production**
   ```bash
   npm run build
   ```

6. **Start production server**
   ```bash
   npm start
   ```
   
   Or build and start together:
   ```bash
   npm run build:start
   ```

### AI Hero Image Feature

The site includes an AI-powered hero image generator that allows visitors to create custom hero images using text prompts.

**How it works:**
- Click the "Generate hero image" button in the hero section
- Enter a text description of the image you want
- Optionally select a style preset (Renaissance-meets-modern, Airy classical, Minimal poster)
- Click Generate to create the image
- The generated image replaces the hero image and is saved in localStorage
- Use "Reset to default" to restore the original image

**Backend API:**
- Endpoint: `POST /api/hero-image`
- Rate limiting: 5 requests per minute per IP
- Input validation and sanitization included
- Uses OpenAI's DALL-E 3 model

**Files added/modified:**
- `src/aiHeroModal.js` - Modal component
- `src/sass/_ai-hero.scss` - Modal styles
- `server.js` - Express backend API
- `src/template.html` - Added buttons
- `src/index.js` - Modal initialization
- `webpack.dev.js` - Added API proxy
- `package.json` - Added dependencies and scripts

## License

This is my personal portfolio, so feel free to look around and get inspired, but please don't just copy it wholesale.

## Contact

Want to chat? Hit me up through the contact form on the site, or find me on [LinkedIn](https://www.linkedin.com/in/owen-kobasz/) or [GitHub](https://github.com/owenkobasz).

---

Thank you for stopping by! 🚴‍♂️
