async function fetchOpenAI(messages) {
  if (!process.env.OPENAI_API_KEY) {
    console.error('OpenAI API key is not configured');
    // Return fallback traits instead of throwing
    return {
      choices: [{
        message: {
          content: `1. Analytical\n2. Professional\n3. Tech-Savvy\n4. Innovative`
        }
      }]
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
      // Return fallback traits instead of throwing
      return {
        choices: [{
          message: {
            content: `1. Analytical\n2. Professional\n3. Tech-Savvy\n4. Innovative`
          }
        }]
      };
    }

    return response.json();
  } catch (error) {
    console.error('OpenAI API Error:', error);
    // Return fallback traits instead of throwing
    return {
      choices: [{
        message: {
          content: `1. Analytical\n2. Professional\n3. Tech-Savvy\n4. Innovative`
          }
      }]
    };
  }
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
    console.error('Error generating personality:', error);
    // Return fallback traits
    return ['Analytical', 'Professional', 'Tech-Savvy', 'Innovative'];
  }
}