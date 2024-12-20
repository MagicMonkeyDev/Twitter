import { ApifyClient } from 'apify-client';

const apifyClient = new ApifyClient({
  token: process.env.APIFY_API_TOKEN,
});

export async function fetchTwitterProfile(username) {
  try {
    // Start the scraper run
    const run = await apifyClient.actor("quacker/twitter-scraper").call({
      usernames: [username],
      maxItems: 1,
    });

    // Get the results
    const { items } = await apifyClient.dataset(run.defaultDatasetId).listItems();
    
    if (!items || items.length === 0) {
      throw {
        status: 404,
        title: 'Profile Not Found',
        description: 'Twitter profile not found'
      };
    }

    const profile = items[0];

    return {
      username: profile.username,
      displayName: profile.displayName || profile.username,
      bio: profile.description || '',
      imageUrl: profile.profileImageUrl,
      tweets: [], // Empty tweets array since we're not fetching them
      personality: [] // Will be populated by OpenAI
    };
  } catch (error) {
    console.error('Apify API Error:', error);
    throw {
      status: error.status || 500,
      title: 'Twitter Scraper Error',
      description: error.description || 'Failed to fetch Twitter data'
    };
  }
}