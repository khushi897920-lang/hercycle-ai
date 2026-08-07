import { validateEnv } from "@/lib/env";
import { NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { getAuthUserId } from '@/lib/clerk-server'
import { aiLimiter, getRateLimitIdentifier } from '@/lib/rateLimiter'
import { logger } from '@/lib/logger'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { z } from 'zod'

const TIMEOUT_MS = 8000; // 8 seconds timeout to prevent long hangs

// Maximum number of conversation messages forwarded to the LLM. Sending a full
// transcript costs tokens and risks context-length errors on long threads.
const MAX_CONTEXT_MESSAGES = 15;

const MAX_CONTEXT_CHARS = 12000; // Safe character limit for prompt optimization

/**
 * Truncates a conversation history using a sliding window token estimator.
 * Keeps recent message payloads up to a safe character limit before calling AI models.
 *
 * @param {Array<{role: string, ...}>} messages
 * @param {number} [maxMessages=MAX_CONTEXT_MESSAGES]
 * @param {number} [maxChars=MAX_CONTEXT_CHARS]
 * @returns {Array<{role: string, ...}>}
 */
function pruneMessageHistory(messages, maxMessages = MAX_CONTEXT_MESSAGES, maxChars = MAX_CONTEXT_CHARS) {
  if (!Array.isArray(messages) || messages.length === 0) return messages;

  const systemPrompt = messages[0];
  let currentChars = JSON.stringify(systemPrompt).length;

  const recentMessages = [];

  // Iterate backwards to prioritize most recent conversation turns
  for (let i = messages.length - 1; i > 0; i--) {
    const msg = messages[i];
    const msgChars = JSON.stringify(msg).length;

    if (recentMessages.length >= maxMessages - 1) break;
    if (currentChars + msgChars > maxChars) break;

    recentMessages.unshift(msg);
    currentChars += msgChars;
  }

  return [systemPrompt, ...recentMessages];
}

const chatPayloadSchema = z.object({
  language: z.string().max(10).optional(),
  message: z.string().min(1).max(1000),
  context: z.object({
    nextPeriodDate: z.string().max(50).optional(),
    averageCycleLength: z.number().optional(),
    currentPhase: z.object({
      day: z.number().optional(),
      phase: z.string().max(50).optional()
    }).optional()
  }).nullish(),
  history: z.array(z.any()).optional()
})

/**
 * Utility function to enforce a timeout on asynchronous operations.
 * Uses AbortController so the underlying network call is actually cancelled,
 * not just abandoned.
 */
const withTimeout = async (fn, ms) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), ms);
  try {
    return await fn(controller.signal);
  } finally {
    clearTimeout(timeoutId);
  }
};

/**
 * Primary AI Call: Google Gemini API
 */
async function callGemini(message, systemPrompt, history = [], signal) {
  validateEnv();

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

  const model = genAI.getGenerativeModel({
    model: 'gemini-3.6-flash',
  });

  const formattedHistory = history.map(msg => ({
    role: msg.role === 'ai' ? 'model' : (msg.role || 'user'),
    parts: [{ text: msg.text || msg.content || '' }]
  }));

  const chat = model.startChat({
    history: pruneMessageHistory([
      {
        role: 'user',
        parts: [{ text: systemPrompt }],
      },
      {
        role: 'model',
        parts: [
          {
            text: 'I understand. I will provide helpful menstrual health guidance.',
          },
        ],
      },
      ...formattedHistory
    ]),
  });

  const result = await chat.sendMessage(message, { signal });
  return result.response.text();
}

/**
 * Fallback AI Call: Groq API (llama3-8b-8192)
 */
async function callGroq(message, systemPrompt, history = [], signal) {
  validateEnv();

  if (!process.env.GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY environment variable is not defined.');
  }

  const formattedHistory = history.map(msg => ({
    role: msg.role === 'ai' || msg.role === 'model' ? 'assistant' : (msg.role || 'user'),
    content: msg.text || msg.content || ''
  }));

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'llama-3.1-8b-instant',
      messages: pruneMessageHistory([
        { role: 'system', content: systemPrompt },
        { role: 'assistant', content: 'I understand. I will provide helpful menstrual health guidance.' },
        ...formattedHistory,
        { role: 'user', content: message }
      ]),
      max_tokens: 300 // Keeping response small per prompt constraints
    }),
    signal
  });

  if (!response.ok) {
    throw new Error(`Groq API returned status ${response.status}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function runWithRetry(fn, label) {
  const maxRetries = 3;
  const backoffDelays = [1000, 2000, 4000]; // 1s, 2s, 4s

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await withTimeout((signal) => fn(signal), TIMEOUT_MS);
    } catch (error) {
      const isAbort = error?.name === 'AbortError';
      const reason = isAbort ? 'timed out' : error.message;

      if (attempt === maxRetries) {
        logger.error(`${label} failed after all retries: ${reason}`);
        throw error;
      }
      const delayMs = backoffDelays[attempt];
      logger.warn(`${label} attempt ${attempt + 1} failed (${reason}). Retrying in ${delayMs}ms...`);
      await delay(delayMs);
    }
  }
}

async function callGeminiWithRetry(message, systemPrompt, history = []) {
  return runWithRetry(
    (signal) => callGemini(message, systemPrompt, history, signal),
    'Gemini API'
  );
}

async function callGroqWithRetry(message, systemPrompt, history = []) {
  return runWithRetry(
    (signal) => callGroq(message, systemPrompt, history, signal),
    'Groq API'
  );
}

/**
 * Orchestrates failover from Gemini to Groq.
 */
async function getAIResponse(message, systemPrompt, history = []) {
  try {
    // 1. Try Gemini first (with retries and backoff)
    const responseText = await callGeminiWithRetry(message, systemPrompt, history);
    return responseText;
  } catch (error) {
    logger.warn(`Gemini API failed after all retries (${error.message}). Switching to Groq fallback...`);

    // 2. Try Groq as fallback (with retries and backoff)
    try {
      const fallbackText = await callGroqWithRetry(message, systemPrompt, history);
      return fallbackText;
    } catch (fallbackError) {
      logger.error('Both Gemini and Groq APIs failed.', fallbackError.message);
      throw new Error('All AI service proxies failed.');
    }
  }
}

export async function POST(request) {
  validateEnv();
  let language = 'en'; // default

  // ============ RATE LIMITING ============
  try {
    const identifier = await getRateLimitIdentifier(request);
    await aiLimiter.check(request); // 10 requests per minute
  } catch (rateLimitError) {
    console.warn(`[Rate Limit] Chat endpoint: ${rateLimitError.message}`);
    return NextResponse.json(
      { success: false, error: 'Too many requests, please slow down. AI chat is rate limited.' },
      { status: 429 }
    );
  }
  // =======================================

  try {
    // 1. Clerk Authentication
    const userId = await getAuthUserId()
    if (!userId) {
      logger.warn('Unauthenticated access attempt to AI Chat API');
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // 2. Parse JSON body with error handling for malformed payloads
    let json;
    try {
      json = await request.json();
    } catch (parseError) {
      logger.warn(`Malformed JSON payload in AI Chat API: ${parseError.message}`);
      return NextResponse.json({ success: false, error: 'Bad Request: Invalid JSON payload' }, { status: 400 });
    }

    // 3. Input Validation (Zod)
    const result = chatPayloadSchema.safeParse(json)
    if (!result.success) {
      logger.warn(`Invalid request payload on AI Chat API: ${result.error.message}`);
      return NextResponse.json({ success: false, error: 'Bad Request', details: result.error.errors }, { status: 400 })
    }

    const { message, context, history = [] } = result.data
    language = result.data.language || 'en'

    if (!message || message.trim().length === 0) {
      return NextResponse.json(
        {
          error: "Message content cannot be empty",
        },
        {
          status: 400,
        }
      );
    }

    // 3. Fetch User Health Profile for Context Injection
    let userProfile = null;
    try {
      const supabase = getSupabaseAdmin();
      const { data } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', userId)
        .single();
      userProfile = data;
    } catch (profileErr) {
      logger.warn(`Could not fetch user profile for AI context: ${profileErr.message}`);
    }

    if (userProfile && userProfile.allow_ai_analysis === false) {
      return NextResponse.json({ success: true, response: 'Privacy mode enabled' });
    }

    let systemPrompt = `You are a helpful menstrual health assistant. Provide empathetic, accurate health guidance.`;

    // Sanitize helper to prevent prompt injection
    const sanitizeForPrompt = (str, maxLen = 200) => {
      if (!str) return '';
      return String(str)
        .replace(/[\[\]"'`\\]/g, '')  // Remove prompt control characters
        .replace(/\n/g, ' ')
        .slice(0, maxLen);
    };

    // 4. Inject Profile Context
    if (userProfile) {
      const conditions = userProfile.known_conditions || [];
      const ageStr = userProfile.age ? sanitizeForPrompt(`${userProfile.age} yrs old`) : 'unknown age';
      const weightStr = userProfile.weight_kg ? sanitizeForPrompt(`${userProfile.weight_kg}kg`) : 'unknown weight';
      const conditionsStr = conditions.length > 0
        ? conditions.map(c => sanitizeForPrompt(c)).join(', ')
        : 'none';

      systemPrompt += `\n[CONTEXT: User is ${ageStr}, weighs ${weightStr}, conditions: ${conditionsStr}]. Use this context to personalize your response, but do not explicitly repeat their data back to them unless necessary.`;
    }

    if (language === 'हि' || language === 'hi') {
      systemPrompt = `आप एक सहायक मासिक धर्म स्वास्थ्य सहायक हैं। सहानुभूतिपूर्ण, सटीक स्वास्थ्य मार्गदर्शन प्रदान करें। हमेशा हिंदी में जवाब दें।`;
    }

    if (context?.nextPeriodDate) {
      systemPrompt += `\n\nUser's next period is predicted on ${context.nextPeriodDate}. Average cycle length: ${context.averageCycleLength || 28} days.`;
    }

    if (context?.currentPhase?.day && context?.currentPhase?.phase) {
      systemPrompt += `\n\nCurrent Cycle Day: ${context.currentPhase.day}. Current Phase: ${context.currentPhase.phase}.`;
    }

    systemPrompt += `\n\nImportant: Keep responses under 100 words. Be supportive and conversational.`;

    // Fetch response with fallback mechanism
    const responseText = await getAIResponse(message, systemPrompt, history);

    logger.info(`Successful chat assistant response generated for user ${userId}`);
    return NextResponse.json({ success: true, response: responseText });
  } catch (error) {
    logger.error('AI Chat Route Error:', error);

    // Fallback response so no crash/error is revealed to the user (Returns clean response)
    const politeFallback = language === 'हि' || language === 'hi'
      ? 'मुझे खेद है, मुझे अभी कुछ तकनीकी समस्या आ रही है। कृपया थोड़ी देर बाद पुनः प्रयास करें। 💕'
      : 'I apologize, but I am experiencing a technical hiccup right now. Please try again in a little while. 💕';

    return NextResponse.json({
      success: true,
      response: politeFallback
    });
  }
}