import { NextResponse } from 'next/server';
import { getAuthUserId } from '@/lib/clerk-server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import crypto from 'crypto';

export async function POST(req) {
  try {
    const userId = await getAuthUserId();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { itemType, itemId, voteValue } = body;

    if (!itemType || !itemId || !voteValue) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (!['post', 'comment'].includes(itemType)) {
      return NextResponse.json({ error: 'Invalid item type' }, { status: 400 });
    }

    if (![1, -1].includes(voteValue)) {
      return NextResponse.json({ error: 'Invalid vote value' }, { status: 400 });
    }

    // Hash the user ID so we don't store raw clerk IDs directly, but we can uniquely identify them
    const hashedUserId = crypto.createHash('sha256').update(userId).digest('hex');

    const supabase = getSupabaseAdmin();
    
    // 1. Execute atomic vote operation via Postgres RPC
    const { data: result, error: rpcError } = await supabase.rpc('handle_vote', {
      p_user_id: hashedUserId,
      p_item_type: itemType,
      p_item_id: itemId,
      p_vote_value: voteValue
    });

    if (rpcError) {
      console.error('Vote RPC Error:', rpcError);
      return NextResponse.json({ error: 'Failed to record vote' }, { status: 500 });
    }

    // Determine correct HTTP status based on the action taken
    const status = result.action === 'added' ? 201 : 200;
    
    return NextResponse.json({ 
      message: `Vote ${result.action}`, 
      currentVote: result.current_vote 
    }, { status });
  } catch (error) {
    console.error('Vote Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
