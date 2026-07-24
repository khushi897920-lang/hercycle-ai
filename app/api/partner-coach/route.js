import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

const COACH_FALLBACKS = {
  Menstrual: "Her energy is naturally low during the menstrual phase. Bring her a warm heating pad, prepare herbal chamomile tea, and take care of heavy chores so she can rest.",
  Follicular: "Her energy & stamina are rising during the follicular phase! Great time to plan an outdoor walk, a nice date night, or try a new recipe together.",
  Ovulation: "Her confidence and social energy are at their peak during ovulation! Plan a fun social outing, express your appreciation, and enjoy vibrant conversations.",
  Luteal: "Progesterone is high, which can cause fatigue, bloating, or emotional sensitivity. Be extra patient, offer soothing hugs, and avoid overwhelming plans."
}

async function callGeminiCoach(query, phase, cycleDay, symptoms, history = []) {
  if (!process.env.GEMINI_API_KEY) return null

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

    const systemPrompt = `You are HerCycle's AI Partner Coach — an empathetic, expert, and practical advisor helping a partner support their partner during her menstrual cycle.
Current Context:
- Cycle Phase: ${phase}
- Cycle Day: ${cycleDay}
- Active Symptoms: ${symptoms.length > 0 ? symptoms.join(', ') : 'None reported'}

Guidelines:
- Provide concise (2-4 sentences max), warm, actionable, and supportive advice tailored for a partner.
- Focus on practical support (comfort foods, massage, rest, emotional patience, date ideas).
- Always be encouraging, respectful, and empathetic.`

    const prompt = `Partner asks: "${query}"\nProvide a warm, expert, concise response for how to support her right now.`

    const result = await model.generateContent([systemPrompt, prompt])
    const response = await result.response
    return response.text()
  } catch (err) {
    console.error("Gemini Partner Coach API error:", err)
    return null
  }
}

export async function POST(req) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { phase = 'Follicular', cycleDay = 1, symptoms = [], query = '' } = await req.json()

    // 1. Initial Briefing request (no query)
    if (!query || !query.trim()) {
      const defaultBriefing = COACH_FALLBACKS[phase] || COACH_FALLBACKS.Follicular
      const extraSymptoms = symptoms.length > 0 ? ` Active symptoms logged today: ${symptoms.join(', ')}.` : ''
      return NextResponse.json({
        reply: `${defaultBriefing}${extraSymptoms}`,
        phase,
        cycleDay
      })
    }

    // 2. Chatbot Question: Attempt Gemini AI
    const geminiReply = await callGeminiCoach(query, phase, cycleDay, symptoms)
    if (geminiReply) {
      return NextResponse.json({ reply: geminiReply, phase, cycleDay })
    }

    // 3. Robust Knowledge Fallback if Gemini API key not set or fails
    const qLower = query.toLowerCase()
    let reply = `During her ${phase} phase (Day ${cycleDay}), support her by listening actively, offering warm drinks, and giving her comforting care.`

    if (qLower.includes('cramps') || qLower.includes('pain') || qLower.includes('ache')) {
      reply = `For cramps during ${phase} phase (Day ${cycleDay}): Apply a warm heating pad to her lower abdomen or lower back, offer ginger/chamomile tea, and encourage restful positioning.`
    } else if (qLower.includes('food') || qLower.includes('diet') || qLower.includes('snack') || qLower.includes('eat') || qLower.includes('chocolate')) {
      reply = `Recommended treats for ${phase} phase: Magnesium-rich dark chocolate, iron-rich warm soups, fresh berries, and hydrating herbal teas.`
    } else if (qLower.includes('mood') || qLower.includes('sad') || qLower.includes('pms') || qLower.includes('angry') || qLower.includes('cry')) {
      reply = `During ${phase} phase (Day ${cycleDay}), hormone shifts (especially progesterone) can cause emotional sensitivity. Offer a warm hug, give her cozy space, and avoid taking emotional spikes personally.`
    } else if (qLower.includes('date') || qLower.includes('out') || qLower.includes('fun') || qLower.includes('activity')) {
      if (phase === 'Ovulation' || phase === 'Follicular') {
        reply = `Energy is high in ${phase} phase! Great time for a romantic dinner date, an outdoor walk, or a fun movie night.`
      } else {
        reply = `Energy is lower in ${phase} phase. A cozy movie night at home with takeout and warm blankets is the best date idea!`
      }
    }

    return NextResponse.json({ reply, phase, cycleDay })

  } catch (error) {
    console.error("Error in partner-coach API:", error)
    return NextResponse.json({
      reply: "I'm here to help you support her! Try asking about cramp relief, food ideas, or mood support."
    })
  }
}
