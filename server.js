import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { fetchTwitterProfile } from './twitter-api.js';
import { generatePersonality } from './openai-api.js';

dotenv.config();

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