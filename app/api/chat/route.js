import { NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)

export async function POST(request) {
  try {
    const { message, language, context } = await request.json()
    
    let systemPrompt = `You are a helpful menstrual health assistant. Provide empathetic, accurate health guidance.`
    
    if (language === 'हि') {
      systemPrompt = `आप एक सहायक मासिक धर्म स्वास्थ्य सहायक हैं। सहानुभूतिपूर्ण, सटीक स्वास्थ्य मार्गदर्शन प्रदान करें। हमेशा हिंदी में जवाब दें।`
    }
    
    if (context?.nextPeriodDate) {
      systemPrompt += `\n\nUser's next period is predicted on ${context.nextPeriodDate}. Average cycle length: ${context.averageCycleLength || 28} days.`
    }
    
    systemPrompt += `\n\nImportant: Keep responses under 100 words. Be supportive and conversational.`
    
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })
    const chat = model.startChat({
      history: [
        { role: 'user', parts: [{ text: systemPrompt }] },
        { role: 'model', parts: [{ text: 'I understand. I will provide helpful menstrual health guidance.' }] }
      ]
    })
    
    const result = await chat.sendMessage(message)
    return NextResponse.json({ success: true, response: result.response.text() })
  } catch (error) {
    console.error('Gemini AI error:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to get AI response',
      response: 'I apologize, but I encountered an error. Please try again or rephrase your question. 💕'
    }, { status: 500 })
  }
}
