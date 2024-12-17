const TWITTER_API_BASE = 'https://api.twitter.com/2';
const TWITTER_API_VERSION = '2';
const TWITTER_API_TIMEOUT = 15000; // 15 second timeout

// Required Twitter API scopes
const REQUIRED_SCOPES = [
  'tweet.read',
  'users.read'
];

const log = {
  info: (...args) => console.log(new Date().toISOString(), ...args),
  error: (...args) => console.error(new Date().toISOString(), ...args)
};

// Validate Twitter API access
async function validateApiAccess(token) {
  try {
    // Check API access using a simple endpoint
    const response = await fetch(`${TWITTER_API_BASE}/users/me`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw {
        status: response.status,
        title: 'API Access Error',
        description: data?.errors?.[0]?.message || 'Failed to validate API access'
      };
    }
    
    return true;
  } catch (error) {
    log.error('Error validating API access:', error);
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

  // Log request details (without sensitive data)
  log.info(`Making Twitter API request to: ${endpoint}`);

  const response = await fetch(`${TWITTER_API_BASE}${endpoint}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': `TwitterAIAgent/${TWITTER_API_VERSION}`,
      'x-app-version': '1.0.0'
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

  return {
    username,
    displayName: userResponse.data.name,
    bio: userResponse.data.description,
    tweets: [] // Return empty tweets array since we're not fetching them
  };
}