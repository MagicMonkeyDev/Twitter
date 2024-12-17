const TWITTER_API_BASE = 'https://api.twitter.com/2';

const log = {
  info: (...args) => console.log(new Date().toISOString(), ...args),
  error: (...args) => console.error(new Date().toISOString(), ...args)
};

const fetchWithAuth = async (endpoint) => {
  if (!process.env.TWITTER_BEARER_TOKEN) {
    throw new Error('Twitter Bearer Token is not configured');
  }

  // Log request details (without sensitive data)
  log.info(`Making Twitter API request to: ${endpoint}`);

  const response = await fetch(`${TWITTER_API_BASE}${endpoint}`, {
    headers: {
      'Authorization': `Bearer ${process.env.TWITTER_BEARER_TOKEN}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    log.error('Twitter API Error:', {
      status: response.status,
      endpoint
    });

    // Handle specific error cases
    if (response.status === 401) {
      throw {
        status: 401,
        title: 'Twitter API Authentication Error',
        description: 'Unable to authenticate with Twitter API'
      };
    }

    throw {
      status: response.status,
      title: 'Twitter API Error',
      description: error?.errors?.[0]?.message || 'Failed to fetch Twitter data'
    };
  }

  return response.json();
};

export async function fetchTwitterProfile(username) {
  // Use the v2 API endpoint for user lookup with minimal fields
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
    tweets: [], // Empty tweets array since we're not fetching them
    personality: [] // Will be populated by OpenAI
  };
}