async function fetchOpenAI(messages) {
  if (!process.env.OPENAI_API_KEY) {
    console.error('OpenAI API key is not configured');
    throw {
      status: 500,
      title: 'OpenAI API Error',
      description: 'OpenAI API key is not configured'
    };
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages,
        temperature: 0.7,
        max_tokens: 150
      })
    });

    if (!response.ok) {
      console.error('OpenAI API Error:', await response.text());
      throw {
        status: response.status,
        title: 'OpenAI API Error',
        description: 'Failed to generate personality traits'
      };
    }

    return response.json();
  } catch (error) {
    console.error('OpenAI API Error:', error);
    throw {
      status: 500,
      title: 'OpenAI API Error',
      description: 'Failed to generate personality traits'
    };
  }
}

export async function generatePersonality(tweets) {
  try {
    // Combine tweets into a single text for analysis
    const tweetText = tweets.join('\n\n');
    
    const response = await fetchOpenAI([
      {
        role: 'system',
        content: 'You are an expert at analyzing Twitter content and determining personality traits. List 4 key personality traits based on the tweets provided. Format each trait as a single word or short phrase, focusing on professional and public-facing characteristics.'
      },
      {
        role: 'user',
        content: `Analyze these tweets and provide 4 key personality traits:\n\n${tweetText}`
      }
    ]);

    return response.choices[0].message.content
      .split('\n')
      .filter(Boolean)
      .map(trait => trait.replace(/^\d+\.\s*/, '').trim().replace(/^["-\s]+|["-\s]+$/g, ''))
      .slice(0, 4);
  } catch (error) {
    console.error('Error generating personality:', error);
    // Return fallback traits
    return ['Analytical', 'Professional', 'Tech-Savvy', 'Innovative'];
  }
}