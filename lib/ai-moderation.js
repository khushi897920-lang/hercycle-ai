import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize the Gemini API client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

async function callGroqModeration(content) {
  if (!process.env.GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY is not set');
  }

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'llama-3.1-8b-instant',
      messages: [
        { role: 'system', content: "You are a strict community moderator for a women's health app focusing on PCOD and menstrual health. Analyze text for toxicity, harassment, hate speech, bullying, extreme profanity, or spam. Return ONLY a raw JSON object with { isAppropriate: boolean, reason: '...' }." },
        { role: 'user', content: `Analyze the following content:\n---\n${content}\n---` }
      ],
      max_tokens: 150
    })
  });

  if (!response.ok) {
    throw new Error(`Groq API returned status ${response.status}`);
  }

  const data = await response.json();
  const responseText = data.choices[0].message.content;
  
  const jsonStr = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
  const parsed = JSON.parse(jsonStr);

  if (typeof parsed.isAppropriate !== 'boolean') {
    throw new Error('Invalid response format from Groq');
  }

  return parsed;
}

/**
 * Evaluates text for toxicity, harassment, and appropriateness using Gemini with a Groq fallback.
 * @param {string} content - The text content to moderate.
 * @returns {Promise<{ isAppropriate: boolean, reason: string }>}
 */
export async function moderateContent(content) {
  if (!process.env.GEMINI_API_KEY && !process.env.GROQ_API_KEY) {
    throw new Error('AI Moderation services unavailable (missing API keys). Rejecting content securely.');
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    
    const systemInstruction = "You are a strict community moderator for a women's health app focusing on PCOD and menstrual health. Analyze text for toxicity, harassment, hate speech, bullying, extreme profanity, or spam. Return ONLY a raw JSON object with { isAppropriate: boolean, reason: '...' } with no markdown formatting.";
    
    const chat = model.startChat({
      history: [
        { role: "user", parts: [{ text: systemInstruction }] },
        { role: "model", parts: [{ text: "Understood. I am ready to analyze content." }] }
      ]
    });
    
    const result = await chat.sendMessage(`Analyze the following content:\n---\n${content}\n---`);
    const responseText = result.response.text().trim();
    
    const jsonStr = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(jsonStr);

    if (typeof parsed.isAppropriate !== 'boolean') {
      throw new Error('Invalid response format from Gemini');
    }

    return parsed;
  } catch (error) {
    console.warn('Error during Gemini AI moderation (falling back to Groq):', error.message || error);
    
    try {
      return await callGroqModeration(content);
    } catch (fallbackError) {
      console.error('Error during Groq AI moderation fallback:', fallbackError.message || fallbackError);
      return { isAppropriate: false, reason: 'Content moderation system error. Please try again later.' };
    }
  }
}
