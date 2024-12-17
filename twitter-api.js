const TWITTER_API_BASE = 'https://api.twitter.com/2';
const TWITTER_API_VERSION = '2';
const BEARER_TOKEN_REGEX = /^[A-Za-z0-9%._\-]+$/;

// OAuth 2.0 configuration
const OAUTH_CONFIG = {
  clientId: process.env.TWITTER_CLIENT_ID,
  clientSecret: process.env.TWITTER_CLIENT_SECRET,
  bearerToken: process.env.TWITTER_BEARER_TOKEN
};

const log = {
  info: (...args) => console.log(new Date().toISOString(), ...args),
  error: (...args) => console.error(new Date().toISOString(), ...args)
};

const validateBearerToken = (token) => {
  if (!token) return false;
  const cleanToken = token.trim();
  
  try {
    // URL decode the token first
    const decodedToken = decodeURIComponent(cleanToken);

    // Remove 'Bearer ' prefix if present
    const tokenValue = decodedToken.startsWith('Bearer ') 
      ? decodedToken.substring(7).trim() 
      : decodedToken;
  
    // Log token validation attempt (without revealing the full token)
    log.info('Validating token:', tokenValue.substring(0, 10) + '...');
  
    const isValid = tokenValue.length > 0 && BEARER_TOKEN_REGEX.test(tokenValue);
    log.info('Token validation result:', isValid ? 'valid' : 'invalid');
  
    return isValid;
  } catch (error) {
    log.error('Token validation error:', error);
    return false;
  }
};

const fetchWithAuth = async (endpoint) => {
  let token = process.env.TWITTER_BEARER_TOKEN;

  // Decode the token if it's URL encoded
  try {
    token = decodeURIComponent(token);
  } catch (error) {
    log.error('Error decoding token:', error);
  }

  if (!validateBearerToken(token)) {
    log.error('Invalid Twitter Bearer Token format');
    throw {
      status: 500,
      title: 'Configuration Error',
      description: 'Twitter API authentication configuration error'
    };
  }

  // Ensure token has 'Bearer ' prefix
  const cleanToken = token.trim();
  const authToken = cleanToken.startsWith('Bearer ')
    ? cleanToken
    : `Bearer ${cleanToken}`;

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
      // Check response for specific error types
      const errorType = error?.errors?.[0]?.type;
      const errorMessage = error?.errors?.[0]?.message;
      
      // Check for specific permission errors
      if (errorType === 'about:blank' && errorMessage?.includes('User')) {
        throw {
          status: 401,
          title: 'Read Permission Required',
          description: 'Unable to read tweets. Please ensure "Read" permission is enabled in Twitter Developer Portal.'
        };
      }

      // Handle OAuth configuration errors
      if (errorMessage?.includes('OAuth')) {
        throw {
          status: 401,
          title: 'OAuth Configuration Error',
          description: 'Twitter API OAuth settings need to be configured. Please check the application settings in the Twitter Developer Portal.'
        };
      }

      if (errorType === 'https://api.twitter.com/2/problems/not-authorized-for-resource') {
        throw {
          status: 401,
          title: 'Read Permission Required',
          description: 'The Twitter API token needs "Read" permission. Please enable it in Twitter Developer Portal and regenerate your bearer token.'
        };
      }
      
      if (errorType === 'https://api.twitter.com/2/problems/invalid-tokens') {
        throw {
          status: 401,
          title: 'Invalid Token',
          description: 'The Twitter API token is invalid or has expired. Please check your credentials.'
        };
      }

      throw {
        status: 401,
        title: 'Twitter API Authentication Error',
        description: errorMessage || 'Unable to authenticate with Twitter. Please verify your API credentials and permissions.'
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
};

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