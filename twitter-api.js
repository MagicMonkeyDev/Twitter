const TWITTER_API_BASE = 'https://api.twitter.com/2';
const TWITTER_API_VERSION = '2';
const BEARER_TOKEN_REGEX = /^[A-Za-z0-9%._\-]+$/;

const log = {
  info: (...args) => console.log(new Date().toISOString(), ...args),
  error: (...args) => console.error(new Date().toISOString(), ...args)
};

function validateBearerToken(token) {
  if (!token) return false;
  const cleanToken = token.trim();

  // Remove 'Bearer ' prefix if present
  const tokenValue = cleanToken.startsWith('Bearer ') 
    ? cleanToken.substring(7).trim() 
    : cleanToken;

  return tokenValue.length > 0 && BEARER_TOKEN_REGEX.test(tokenValue);
}

async function fetchWithAuth(endpoint) {
  let token = process.env.TWITTER_BEARER_TOKEN;

  if (!validateBearerToken(token)) {
    log.error('Invalid Twitter Bearer Token format');
    throw {
      status: 500,
      title: 'Configuration Error',
      description: 'Invalid Twitter API Bearer Token format'
    };
  }

  // Ensure token has 'Bearer ' prefix
  const authToken = token.trim().startsWith('Bearer ')
    ? token.trim()
    : `Bearer ${token.trim()}`;

  // Log request details (without sensitive data)
  log.info(`Making Twitter API request to: ${endpoint}`);

  const response = await fetch(`${TWITTER_API_BASE}${endpoint}`, {
    headers: {
      'Authorization': authToken,
      'Content-Type': 'application/json',
      'User-Agent': `TwitterAIAgent/${TWITTER_API_VERSION}`
    }
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    log.error('Twitter API Error:', {
      status: response.status,
      endpoint,
      error: error?.errors?.[0],
      type: error?.type,
      title: error?.title
    });

    // Handle specific error cases
    if (response.status === 401) {
      throw {
        status: 401,
        title: 'Authentication Error',
        description: 'Please check the Twitter API credentials'
      };
    }

    throw {
      status: response.status,
      title: 'Twitter API Error',
      description: error?.errors?.[0]?.message || 
        `Twitter API error: ${response.status} ${response.statusText}`
    };
  }

  return response.json();
}

export async function fetchTwitterProfile(username) {
  // Get user data
  const userResponse = await fetchWithAuth(
    `/users/by/username/${encodeURIComponent(username)}?user.fields=description,profile_image_url`
  );

  if (!userResponse.data) {
    throw {
      status: 404,
      title: 'Profile Not Found',
      description: 'Twitter profile not found'
    };
  }

  const userId = userResponse.data.id;

  // Get recent tweets
  const tweetsResponse = await fetchWithAuth(
    `/users/${userId}/tweets?max_results=10&tweet.fields=created_at,public_metrics`
  );

  if (!tweetsResponse.data) {
    throw {
      status: 404,
      title: 'Tweet Fetch Error',
      description: 'Failed to fetch tweets'
    };
  }

  const tweets = tweetsResponse.data.map(tweet => ({
    id: tweet.id,
    text: tweet.text,
    timestamp: tweet.created_at,
    likes: tweet.public_metrics.like_count,
    retweets: tweet.public_metrics.retweet_count
  }));

  return {
    username,
    displayName: userResponse.data.name,
    bio: userResponse.data.description,
    tweets
  };
}