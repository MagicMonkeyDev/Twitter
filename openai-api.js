async function fetchOpenAI(messages) {
  if (!process.env.OPENAI_API_KEY) {
    throw {
      status: 500,
      title: 'Configuration Error',
      description: 'OpenAI API key is not configured'
    };
  }

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
        content: 'You are an expert at analyzing Twitter profiles and determining personality traits. List 4 key personality traits based on the Twitter bio provided. Format each trait as a single word or short phrase, focusing on professional and public-facing characteristics.'
      },
      {
        role: 'user',
        content: `Analyze this Twitter bio and provide 4 key personality traits:\n\n${tweets[0]}`
      }
    ]);

    return response.choices[0].message.content
      .split('\n')
      .filter(Boolean)
      .map(trait => trait.replace(/^\d+\.\s*/, '').trim().replace(/^["-\s]+|["-\s]+$/g, ''))
      .slice(0, 4);
  } catch (error) {
    throw {
      status: error.status || 500,
      title: error.title || 'OpenAI API Error',
      description: error.description || 'Failed to generate personality traits'
    };
  }
}