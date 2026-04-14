import { NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
const TIMEOUT_MS = 8000; // 8 seconds timeout to prevent long hangs

/**
 * Utility function to enforce a timeout on asynchronous operations
 */
const withTimeout = async (promise, ms) => {
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error('Request timed out')), ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutId));
};

/**
 * Primary AI Call: Google Gemini API
 */
async function callGemini(message, systemPrompt) {
  console.log('Attempting to call primary API (Gemini)...');
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
  const chat = model.startChat({
    history: [
      { role: 'user', parts: [{ text: systemPrompt }] },
      { role: 'model', parts: [{ text: 'I understand. I will provide helpful menstrual health guidance.' }] }
    ]
  });
  
  const result = await chat.sendMessage(message);
  return result.response.text();
}

/**
 * Fallback AI Call: Groq API (llama3-8b-8192)
 */
async function callGroq(message, systemPrompt) {
  console.log('Attempting to call fallback API (Groq)...');
  if (!process.env.GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY environment variable is not defined.');
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
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message }
      ],
      max_tokens: 300 // Keeping response small per prompt constraints
    })
  });

  if (!response.ok) {
    throw new Error(`Groq API returned status ${response.status}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

/**
 * Orchestrates failover from Gemini to Groq.
 */
async function getAIResponse(message, systemPrompt) {
  try {
    // 1. Try Gemini first (with timeout)
    const responseText = await withTimeout(callGemini(message, systemPrompt), TIMEOUT_MS);
    return responseText;
  } catch (error) {
    console.warn(`[API Warning] Gemini API failed (${error.message}). Switching to Groq...`);
    
    // 2. Try Groq as fallback (with timeout)
    try {
      const fallbackText = await withTimeout(callGroq(message, systemPrompt), TIMEOUT_MS);
      return fallbackText;
    } catch (fallbackError) {
      console.error('[API Error] Both Gemini and Groq APIs failed.', fallbackError.message);
      throw new Error('All AI service proxies failed.');
    }
  }
}

export async function POST(request) {
  let language = 'en'; // default
  
  try {
    const body = await request.json();
    language = body.language || 'en';
    const { message, context } = body;
    
    let systemPrompt = `You are a helpful menstrual health assistant. Provide empathetic, accurate health guidance.`;
    
    if (language === 'हि') {
      systemPrompt = `आप एक सहायक मासिक धर्म स्वास्थ्य सहायक हैं। सहानुभूतिपूर्ण, सटीक स्वास्थ्य मार्गदर्शन प्रदान करें। हमेशा हिंदी में जवाब दें।`;
    }
    
    if (context?.nextPeriodDate) {
      systemPrompt += `\n\nUser's next period is predicted on ${context.nextPeriodDate}. Average cycle length: ${context.averageCycleLength || 28} days.`;
    }
    
    systemPrompt += `\n\nImportant: Keep responses under 100 words. Be supportive and conversational.`;
    
    // Fetch response with fallback mechanism
    const responseText = await getAIResponse(message, systemPrompt);
    
    return NextResponse.json({ success: true, response: responseText });
  } catch (error) {
    console.error('API Route Error:', error);
    
    // 3. Fallback response so no crash/error is revealed to the user (Returns clean response)
    const politeFallback = language === 'हि' 
      ? 'मुझे खेद है, मुझे अभी कुछ तकनीकी समस्या आ रही है। कृपया थोड़ी देर बाद पुनः प्रयास करें। 💕' 
      : 'I apologize, but I am experiencing a technical hiccup right now. Please try again in a little while. 💕';
      
    // Even if we fail, return HTTP 200 with success: true (or handle gently in the frontend) to ensure app never breaks
    return NextResponse.json({
      success: true,
      response: politeFallback
    });
  }
}
