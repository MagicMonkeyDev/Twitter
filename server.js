import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { fetchTwitterProfile } from './twitter-api.js';
import { generatePersonality } from './openai-api.js';

// Load environment variables
dotenv.config();

// Debug environment variables (sanitized)
console.log('Environment Check:', {
  TWITTER_BEARER_TOKEN: process.env.TWITTER_BEARER_TOKEN ? '✓ Present' : '✗ Missing',
  OPENAI_API_KEY: process.env.OPENAI_API_KEY ? '✓ Present' : '✗ Missing',
  CORS_ORIGIN: process.env.CORS_ORIGIN || 'Not set'
});

// Validate required environment variables
const requiredEnvVars = [
  'TWITTER_BEARER_TOKEN',
  'OPENAI_API_KEY'
];

const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);
if (missingEnvVars.length > 0) {
  console.error('Missing required environment variables:', missingEnvVars.join(', '));
  process.exit(1);
}

const app = express();
const port = process.env.PORT || 3000;

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

// Routes
app.get('/api/twitter/:username', async (req, res) => {
  try {
    const profile = await fetchTwitterProfile(req.params.username);
    const personality = await generatePersonality(profile.tweets.map(t => t.text));
    
    res.json({
      ...profile,
      personality
    });
  } catch (error) {
    res.status(error.status || 500).json({
      error: {
        title: error.title || 'Server Error',
        description: error.description || 'An unexpected error occurred'
      }
    });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});