const TWITTER_API_BASE = 'https://api.twitter.com/2';

// Helper function to validate and format bearer token
function formatBearerToken(token) {
  if (!token) {
    throw new Error('Twitter Bearer Token is not configured');
  }

  // Remove any existing 'Bearer ' prefix and URL encoding
  token = token.replace(/^Bearer\s+/i, '');
  token = decodeURIComponent(token);

  return `Bearer ${token}`;
}

const fetchWithAuth = async (endpoint) => {
  try {
    const bearerToken = formatBearerToken(process.env.TWITTER_BEARER_TOKEN);

    console.log(`Making Twitter API request to: ${endpoint}`);

    const response = await fetch(`${TWITTER_API_BASE}${endpoint}`, {
      headers: {
        'Authorization': bearerToken,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const error = await response.json().catch(() => null);
      console.error('Twitter API Error:', {
        status: response.status,
        endpoint,
        error: error?.errors?.[0]?.message
      });

      throw {
        status: response.status,
        title: 'Twitter API Error',
        description: error?.errors?.[0]?.message || 'Failed to fetch Twitter data'
      };
    }

    return response.json();
  } catch (error) {
    if (error.status === 401) {
      throw {
        status: 401,
        title: 'Twitter API Authentication Error',
        description: 'Please check your Twitter API credentials'
      };
    }
    throw error;
  }
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
  const imageUrl = userResponse.data.profile_image_url?.replace('_normal', '');

  return {
    username,
    displayName: userResponse.data.name,
    bio: userResponse.data.description,
    imageUrl,
    tweets: [], // Empty tweets array since we're not fetching them
    personality: [] // Will be populated by OpenAI
  };
}