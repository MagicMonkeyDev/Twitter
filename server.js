import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { fetchTwitterProfile } from './twitter-api.js';
import { generatePersonality } from './openai-api.js';

// Load environment variables
dotenv.config();

// Function to validate Twitter Bearer Token
function validateTwitterToken(token) {
  if (!token) return false;
  const cleanToken = token.trim();
  return /^[A-Za-z0-9-._~+/]+=*$/.test(cleanToken) || 
         /^Bearer [A-Za-z0-9-._~+/]+=*$/.test(cleanToken);
}

// Log environment status (but not the actual values)
console.log('Environment Check:', {
  TWITTER_BEARER_TOKEN: !!process.env.TWITTER_BEARER_TOKEN,
  OPENAI_API_KEY: !!process.env.OPENAI_API_KEY,
  CORS_ORIGIN: process.env.CORS_ORIGIN || '*'
});

// Validate required environment variables
const requiredEnvVars = [
  'TWITTER_BEARER_TOKEN',
  'OPENAI_API_KEY'
];

// Validate environment variables
const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);
if (missingEnvVars.length > 0) {
  throw new Error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
}

// Validate Twitter Bearer Token format
if (!validateTwitterToken(process.env.TWITTER_BEARER_TOKEN)) {
  throw new Error('Invalid Twitter Bearer Token format');
}

// Log token format (without revealing the actual token)
console.log('Making Twitter API request with token:', 
  process.env.TWITTER_BEARER_TOKEN ? 
  process.env.TWITTER_BEARER_TOKEN.substring(0, 10) + '...' : 
  'Not provided');

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