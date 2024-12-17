const TWITTER_API_BASE = 'https://api.twitter.com/2';

async function fetchWithAuth(endpoint) {
  if (!process.env.TWITTER_BEARER_TOKEN) {
    throw {
      status: 500,
      title: 'Configuration Error',
      description: 'Twitter API Bearer Token is not configured'
    };
  }

  // Validate and format the bearer token
  const token = process.env.TWITTER_BEARER_TOKEN.trim();
  
  // Check if token matches expected format
  if (!/^[A-Za-z0-9-._~+/]+=*$/.test(token)) {
    throw {
      status: 500,
      title: 'Configuration Error',
      description: 'Invalid Twitter Bearer Token format'
    };
  }

  const response = await fetch(`${TWITTER_API_BASE}${endpoint}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    console.error('Twitter API Error:', {
      status: response.status,
      error: error?.errors?.[0]
    });
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