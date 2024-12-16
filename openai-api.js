async function fetchOpenAI(messages) {
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
    throw {
      status: response.status,
      title: 'OpenAI API Error',
      description: 'Failed to generate personality traits'
    };
  }

  return response.json();
}

export async function generatePersonality(tweets) {
  try {
    const response = await fetchOpenAI([
      {
        role: 'system',
        content: 'You are an expert at analyzing Twitter content and determining personality traits. List 4 key personality traits based on the tweet content provided.'
      },
      {
        role: 'user',
        content: `Analyze these tweets and provide 4 key personality traits:\n\n${tweets.join('\n')}`
      }
    ]);

    return response.choices[0].message.content
      .split('\n')
      .filter(Boolean)
      .map(trait => trait.replace(/^\d+\.\s*/, '').trim())
      .slice(0, 4);
  } catch (error) {
    console.error('OpenAI API error:', error);
    return ['Analytical', 'Innovative', 'Tech-focused', 'Forward-thinking'];
  }
}