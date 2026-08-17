import { jsonSuccess, jsonError } from '@/lib/api-helpers';
import { currentUser } from '@clerk/nextjs/server';

export async function POST(req) {
  try {
    const user = await currentUser();
    const userEmail = user?.emailAddresses?.[0]?.emailAddress || 'Unknown User';
    
    const body = await req.json();
    const { message, type } = body;

    if (!message) {
      return jsonError('Message is required', 400);
    }

    const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
    if (!webhookUrl) {
      console.error("DISCORD_WEBHOOK_URL is not configured.");
      return jsonError('Discord webhook not configured', 500);
    }

    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: `**New ${type} Report from ${userEmail}**\n> ${message}`
      })
    });

    if (!res.ok) {
      throw new Error(`Discord API error: ${res.status}`);
    }

    return jsonSuccess(null, 'Feedback sent successfully', 200);

  } catch (error) {
    console.error('Feedback API error:', error);
    return jsonError('Internal Server Error', 500);
  }
}

