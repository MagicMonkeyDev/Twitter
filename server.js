import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { fetchTwitterProfile } from './twitter-api.js';
import { generatePersonality } from './openai-api.js';

// Load environment variables
dotenv.config();

// Initialize Express app early to catch startup errors
const app = express();
const port = process.env.PORT || 3000;

// Configure trust proxy settings for running behind Render's proxy
app.set('trust proxy', 1);

// Enhanced logging
const log = {
  info: (...args) => console.log(new Date().toISOString(), ...args),
  error: (...args) => console.error(new Date().toISOString(), ...args)
};

process.on('uncaughtException', (error) => {
  log.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  log.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Log environment status (but not the actual values)
log.info('Environment Check:', {
  APIFY_API_TOKEN: !!process.env.APIFY_API_TOKEN,
  OPENAI_API_KEY: !!process.env.OPENAI_API_KEY,
  CORS_ORIGIN: process.env.CORS_ORIGIN || '*'
});

// Validate required environment variables
const requiredEnvVars = [
  'APIFY_API_TOKEN',
  'OPENAI_API_KEY'
];

// Validate environment variables
const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);
if (missingEnvVars.length > 0) {
  throw new Error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
}

// Log token format (without revealing the actual token)
console.log('Using Apify API token:', process.env.APIFY_API_TOKEN ? 'XXXX...' : 'Not provided');

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN,
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(limiter);

// Basic route to confirm server is running
app.get('/', (req, res) => res.json({ status: 'ok', message: 'Server is running' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok',
    timestamp: new Date().toISOString(),
    apify: !!process.env.APIFY_API_TOKEN,
    openai: !!process.env.OPENAI_API_KEY
  });
});

// Routes
app.get('/api/twitter/:username', async (req, res) => {
  log.info(`Fetching profile for username: ${req.params.username}`);
  try {
    const profile = await fetchTwitterProfile(req.params.username);
    // Generate personality based on tweets
    const personality = await generatePersonality(profile.tweets.map(t => t.text));
    
    log.info(`Successfully generated profile for: ${req.params.username}`);
    res.json({
      ...profile,
      personality
    });
  } catch (error) {
    log.error('Error processing request:', error);
    res.status(error.status || 500).json({
      error: {
        title: error.title || 'Server Error',
        description: error.description || 'An unexpected error occurred'
      }
    });
  }
});

app.listen(port, () => {
  log.info(`Server running on port ${port}`);
});