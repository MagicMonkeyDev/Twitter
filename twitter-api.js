const TWITTER_API_BASE = 'https://api.twitter.com/2';
const TWITTER_API_VERSION = '2';

function validateBearerToken(token) {
  if (!token) return false;
  // Token should start with 'Bearer ' or be a valid token string
  const cleanToken = token.trim();
  return /^[A-Za-z0-9-._~+/]+=*$/.test(cleanToken) || 
         /^Bearer [A-Za-z0-9-._~+/]+=*$/.test(cleanToken);
}

async function fetchWithAuth(endpoint) {
  const token = process.env.TWITTER_BEARER_TOKEN;
  
  if (!validateBearerToken(token)) {
    throw {
      status: 500,
      title: 'Configuration Error',
      description: 'Invalid Twitter API Bearer Token format'
    };
  }

  // Ensure token has 'Bearer ' prefix
  const authToken = token.startsWith('Bearer ') ? token : `Bearer ${token}`;

  // Log request details (without sensitive data)
  console.log(`Making Twitter API request to: ${endpoint}`);

  const response = await fetch(`${TWITTER_API_BASE}${endpoint}`, {
    headers: {
      'Authorization': authToken,
      'Content-Type': 'application/json',
      'User-Agent': 'v2TweetLookupJS',
      'x-api-version': TWITTER_API_VERSION
    }
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    console.error('Twitter API Error:', {
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