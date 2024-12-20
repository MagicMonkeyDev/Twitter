import { ApifyClient } from 'apify-client';

const apifyClient = new ApifyClient({
  token: process.env.APIFY_API_TOKEN,
});

export async function fetchTwitterProfile(username) {
  try {
    // Start the scraper run
    const run = await apifyClient.actor('quacker/twitter-scraper').call({
      searchTerms: [`from:${username}`],
      maxItems: 10,
      addUserInfo: true,
      proxyConfig: { useApifyProxy: true }
    });

    // Get the results
    const { items } = await apifyClient.dataset(run.defaultDatasetId).listItems();
    
    // Find the user info from the tweets
    const userInfo = items.find(item => item.user)?.user;
    
    if (!userInfo) {
      throw {
        status: 404,
        title: 'Profile Not Found',
        description: 'Twitter profile not found'
      };
    }

    return {
      username: userInfo.username,
      displayName: userInfo.displayName || userInfo.username,
      bio: userInfo.description || '',
      imageUrl: userInfo.profileImageUrl,
      tweets: [], // Empty tweets array since we're not fetching them
      personality: [] // Will be populated by OpenAI
    };
  } catch (error) {
    console.error('Apify API Error:', error);
    if (error.message?.includes('Invalid token')) {
      throw {
        status: 401,
        title: 'Authentication Error',
        description: 'Invalid Apify API token'
      };
    }
    throw {
      status: error.status || 500,
      title: 'Twitter Scraper Error',
      description: error.description || 'Failed to fetch Twitter data'
    };
  }
}