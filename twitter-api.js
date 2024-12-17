const TWITTER_API_BASE = 'https://api.twitter.com/2';
const TWITTER_API_VERSION = '2';
const TWITTER_API_TIMEOUT = 15000; // 15 second timeout
let permissionsValidated = false;

const log = {
  info: (...args) => console.log(new Date().toISOString(), ...args),
  error: (...args) => console.error(new Date().toISOString(), ...args)
};

// Validate Twitter API permissions
async function validateApiPermissions(token) {
  try {
    const response = await fetch('https://api.twitter.com/2/tweets/search/recent?query=test', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.status === 401) {
      const error = await response.json();
      log.error('Permission validation failed:', error);
      
      if (error?.title?.includes('Unauthorized')) {
        throw new Error('Twitter API requires elevated access. Please ensure you have enabled elevated access in the Twitter Developer Portal.');
      }
    }
  } catch (error) {
    log.error('Error validating permissions:', error);
    throw error;
  }
}

function prepareAuthToken(token) {
  if (!token) return null;
  
  // Decode URL-encoded token
  const decodedToken = decodeURIComponent(token);
  
  // Remove any 'Bearer ' prefix if present
  return decodedToken.replace(/^Bearer\s+/i, '').trim();
}

const fetchWithAuth = async (endpoint) => {
  if (!process.env.TWITTER_BEARER_TOKEN) {
    throw new Error('Twitter Bearer Token is not configured');
  }

  const token = prepareAuthToken(process.env.TWITTER_BEARER_TOKEN);
  if (!token) {
    throw new Error('Invalid Twitter Bearer Token');
  }

  // Validate permissions on first request
  if (!permissionsValidated) {
    await validateApiPermissions(token);
    permissionsValidated = true;
  }

  // Log request details (without sensitive data)
  log.info(`Making Twitter API request to: ${endpoint}`);

  const response = await fetch(`${TWITTER_API_BASE}${endpoint}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': `TwitterAIAgent/${TWITTER_API_VERSION}`
    },
    timeout: TWITTER_API_TIMEOUT
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
      const errorMessage = error?.errors?.[0]?.message || error?.detail || error?.title;
      
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