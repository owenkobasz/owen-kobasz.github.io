/**
 * Express Server for AI Hero Image Generation
 * Handles OpenAI API calls and rate limiting
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const { OpenAI } = require('openai');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;
const isProduction = process.env.NODE_ENV === 'production';

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Serve static files in production
if (isProduction) {
    app.use(express.static(path.join(__dirname, 'dist')));
}

// Rate limiting (in-memory store)
const rateLimitStore = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 5; // 5 requests per minute per IP

// Get client IP address
const getClientIP = (req) => {
    return req.ip || 
           req.connection.remoteAddress || 
           req.socket.remoteAddress ||
           (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
           'unknown';
};

// Rate limiting middleware
const rateLimit = (req, res, next) => {
    const ip = getClientIP(req);
    const now = Date.now();
    
    if (!rateLimitStore.has(ip)) {
        rateLimitStore.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
        return next();
    }
    
    const record = rateLimitStore.get(ip);
    
    // Reset if window expired
    if (now > record.resetTime) {
        record.count = 1;
        record.resetTime = now + RATE_LIMIT_WINDOW;
        return next();
    }
    
    // Check if limit exceeded
    if (record.count >= RATE_LIMIT_MAX_REQUESTS) {
        return res.status(429).json({ 
            error: 'Rate limit exceeded. Please wait a moment and try again.' 
        });
    }
    
    record.count++;
    next();
};

// Clean up old rate limit entries periodically
setInterval(() => {
    const now = Date.now();
    for (const [ip, record] of rateLimitStore.entries()) {
        if (now > record.resetTime) {
            rateLimitStore.delete(ip);
        }
    }
}, RATE_LIMIT_WINDOW);

// Initialize OpenAI client
if (!process.env.OPENAI_API_KEY) {
    console.error('ERROR: OPENAI_API_KEY environment variable is not set');
    process.exit(1);
}

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// Aesthetic description for all generated images
const AESTHETIC_DESCRIPTION = `Create a contemporary neoclassical poster-style image inspired by Renaissance painting. The composition is bold, simplified, and iconic but is rendered with graphic restraint rather than realism. The paint style emphasizes flat color fields, clean edges, and minimal shading, with only subtle tonal modeling to suggest form. Surfaces feel matte and silkscreen-like, as if designed for a printed poster rather than a gallery canvas. Use a limited, intentional color palette — warm whites, muted greens, soft blues, and stone tones — with one striking modern accent color used sparingly for contrast. Large areas of negative space create breathing room and visual calm. Modern objects are simplified into near-symbolic shapes and integrated seamlessly into the composition. The overall feeling is timeless, graphic, and contemplative: classical imagery distilled into a modern poster aesthetic. Avoid photorealism, heavy texture, complex lighting, or visual clutter. Prioritize clarity, balance, and bold visual impact.`;

// Analyze image using GPT-4 Vision
const analyzeImage = async (imageBase64) => {
    try {
        const response = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
                {
                    role: 'user',
                    content: [
                        {
                            type: 'text',
                            text: 'Describe this image in detail, focusing on the main subjects, composition, colors, mood, and key visual elements. Be specific and concise.'
                        },
                        {
                            type: 'image_url',
                            image_url: {
                                url: `data:image/jpeg;base64,${imageBase64}`
                            }
                        }
                    ]
                }
            ],
            max_tokens: 300
        });
        
        return response.choices[0].message.content;
    } catch (error) {
        console.error('Error analyzing image:', error);
        throw new Error('Failed to analyze image');
    }
};

// Build the enhanced prompt with aesthetic and safety constraints
const buildPrompt = (userPrompt, imageDescription = null) => {
    let contentDescription = '';
    
    if (imageDescription) {
        contentDescription = `Transform the following image into the requested style. Image description: ${imageDescription}`;
        if (userPrompt) {
            contentDescription += ` Additional guidance: ${userPrompt}`;
        }
    } else if (userPrompt) {
        contentDescription = userPrompt;
    }
    
    const systemPrompt = `
  A contemporary neoclassical poster-style illustration depicting: ${contentDescription}
  
  The image is composed like a Renaissance fresco or early Italian panel painting, organized within a clear architectural frame (arches, columns, or shallow spatial bays). The composition is calm, balanced, and iconic, with a small number of human figures arranged in readable poses and gestures.
  
  The visual style is flat and graphic rather than painterly or realistic. Forms are built from clean-edged color shapes with minimal shading. Tonal modeling is subtle and restrained, used only to suggest volume. Surfaces appear matte and softly textured, resembling a silkscreen or offset-printed poster rather than an oil painting or photograph.
  
  The color palette is limited and intentional: warm off-whites, stone neutrals, muted greens, and soft sky blues, with a single modern accent color used sparingly as a focal contrast. Large areas of negative space and simplified backgrounds create visual quiet and clarity.
  
  Any modern elements are reduced to symbolic, simplified shapes and integrated naturally into the scene without breaking the classical harmony. The overall mood is timeless, contemplative, and graphic — classical imagery distilled into a modern print poster aesthetic.
  
  Avoid photorealism, cinematic lighting, glossy textures, dramatic shadows, hyper-detailed faces, surreal distortion, exaggerated anatomy, or cluttered compositions. Prioritize clarity, balance, flatness, and strong silhouette readability.
  `;
  
    return systemPrompt.trim();
};  

// Sanitize user input
const sanitizeInput = (input) => {
    if (typeof input !== 'string') {
        return '';
    }
    
    // Remove potentially harmful characters and limit length
    return input
        .trim()
        .slice(0, 500) // Enforce max length
        .replace(/[<>]/g, '') // Remove HTML brackets
        .replace(/javascript:/gi, '') // Remove javascript: protocol
        .replace(/on\w+=/gi, ''); // Remove event handlers
};

// POST /api/hero-image
app.post('/api/hero-image', rateLimit, async (req, res) => {
    try {
        const { prompt, image } = req.body;
        
        // Validation: must have either prompt or image
        if (!prompt && !image) {
            return res.status(400).json({ error: 'Either a prompt or an image must be provided' });
        }
        
        let sanitizedPrompt = '';
        let imageDescription = null;
        
        // Validate and sanitize prompt if provided
        if (prompt) {
            if (typeof prompt !== 'string') {
                return res.status(400).json({ error: 'Prompt must be a string' });
            }
            sanitizedPrompt = sanitizeInput(prompt);
            
            // Only enforce min length if no image is provided
            if (!image && sanitizedPrompt.length < 10) {
                return res.status(400).json({ error: 'Prompt must be at least 10 characters long' });
            }
            
            if (sanitizedPrompt.length > 500) {
                return res.status(400).json({ error: 'Prompt must be 500 characters or less' });
            }
        }
        
        // Validate and process image if provided
        if (image) {
            if (typeof image !== 'string') {
                return res.status(400).json({ error: 'Image must be a base64 string' });
            }
            
            // Validate base64 format (basic check)
            if (!image.match(/^[A-Za-z0-9+/=]+$/)) {
                return res.status(400).json({ error: 'Invalid image format' });
            }
            
            // Analyze image with GPT-4 Vision
            try {
                imageDescription = await analyzeImage(image);
            } catch (error) {
                console.error('Image analysis error:', error);
                return res.status(500).json({ error: 'Failed to analyze image. Please try again.' });
            }
        }
        
        // Build enhanced prompt with aesthetic description
        const enhancedPrompt = buildPrompt(sanitizedPrompt, imageDescription);
        
        // Call OpenAI API
        // Note: Using DALL-E 3 (dall-e-3) as the model name
        // The user mentioned "gpt-image-1" but that's not a valid model name
        // DALL-E 3 is the current image generation model
        const response = await openai.images.generate({
            model: 'dall-e-3',
            prompt: enhancedPrompt,
            n: 1,
            size: '1792x1024', // Good size for hero images
            quality: 'standard',
            response_format: 'b64_json', // Return base64 encoded image
        });
        
        const imageData = response.data[0].b64_json;
        
        if (!imageData) {
            throw new Error('No image data received from OpenAI');
        }
        
        // Return base64 data URL
        const imageDataUrl = `data:image/png;base64,${imageData}`;
        
        res.json({ imageDataUrl });
        
    } catch (error) {
        console.error('Error generating image:', error);
        
        // Handle OpenAI API errors
        if (error.response) {
            const statusCode = error.response.status;
            const errorMessage = error.response.data?.error?.message || 'OpenAI API error';
            
            if (statusCode === 429) {
                return res.status(429).json({ error: 'OpenAI rate limit exceeded. Please try again later.' });
            }
            
            if (statusCode === 400) {
                return res.status(400).json({ error: `Invalid request: ${errorMessage}` });
            }
            
            return res.status(500).json({ error: `OpenAI API error: ${errorMessage}` });
        }
        
        // Handle network errors
        if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
            return res.status(503).json({ error: 'Unable to connect to OpenAI service. Please try again later.' });
        }
        
        // Generic error
        res.status(500).json({ 
            error: 'Failed to generate image. Please try again.' 
        });
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve index.html for all non-API routes in production (SPA fallback)
if (isProduction) {
    app.get('*', (req, res) => {
        // Don't serve index.html for API routes
        if (req.path.startsWith('/api')) {
            return res.status(404).json({ error: 'Not found' });
        }
        res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
}

// Start server
app.listen(PORT, () => {
    console.log(`AI Hero Image API server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Handle uncaught errors
process.on('unhandledRejection', (error) => {
    console.error('Unhandled promise rejection:', error);
});

process.on('uncaughtException', (error) => {
    console.error('Uncaught exception:', error);
    process.exit(1);
});

