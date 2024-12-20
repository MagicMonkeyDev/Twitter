import { ApifyClient } from 'apify-client';

const apifyClient = new ApifyClient({
  token: process.env.APIFY_API_TOKEN,
});

export async function fetchTwitterProfile(username) {
  try {
    console.log(`Starting Apify scraper for username: ${username}`);
    
    // Start the new scraper run
    const run = await apifyClient.actor('apidojo/tweet-scraper').call({
      handle: username,
      max_tweets: 10,
      is_retweet: false,
      language: "en",
      add_user_info: true
    });

    console.log(`Scraper run started, dataset ID: ${run.defaultDatasetId}`);

    // Get the results
    const { items } = await apifyClient.dataset(run.defaultDatasetId).listItems();
    
    console.log(`Scraper results:`, {
      itemsCount: items.length,
      hasResults: !!items.length
    });

    // Get the first tweet to extract user info
    const firstTweet = items[0];
    
    if (!firstTweet) {
      console.log(`No results found for username: ${username}`);
      throw {
        status: 404,
        title: 'Profile Not Found',
        description: `Twitter profile @${username} not found or has no public tweets`
      };
    }

    // Extract user info from the tweet
    const userInfo = {
      username: firstTweet.user_screen_name,
      displayName: firstTweet.user_name,
      description: firstTweet.user_description,
      profileImageUrl: firstTweet.user_profile_image
    };

    return {
      username: userInfo.username,
      displayName: userInfo.displayName,
      bio: userInfo.description,
      imageUrl: userInfo.profileImageUrl?.replace('_normal', ''),
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
    
    if (error.message?.includes('rate limit')) {
      throw {
        status: 429,
        title: 'Rate Limit Exceeded',
        description: 'Twitter scraping rate limit reached. Please try again later.'
      };
    }
    throw {
      status: error.status || 500,
      title: 'Twitter Scraper Error',
      description: error.description || `Failed to fetch Twitter data for @${username}. The profile may be private or suspended.`
    };
  }
}