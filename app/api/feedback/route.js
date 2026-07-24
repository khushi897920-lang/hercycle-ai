import { NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';

export async function POST(req) {
  try {
    const user = await currentUser();
    const userEmail = user?.emailAddresses?.[0]?.emailAddress || 'Unknown User';
    
    const body = await req.json();
    const { message, type } = body;

    if (!message) {
      return NextResponse.json({ success: false, error: 'Message is required' }, { status: 400 });
    }

    const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
    if (!webhookUrl) {
      console.error("DISCORD_WEBHOOK_URL is not configured.");
      return NextResponse.json({ success: false, error: 'Discord webhook not configured' }, { status: 500 });
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

    return NextResponse.json({ success: true }, { status: 200 });

  } catch (error) {
    console.error('Feedback API error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
