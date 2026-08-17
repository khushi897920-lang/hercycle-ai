import { jsonSuccess, jsonError } from '@/lib/api-helpers';
import { getAuthUserId } from '@/lib/clerk-server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import crypto from 'crypto';

export async function POST(req) {
  try {
    const userId = await getAuthUserId();
    
    if (!userId) {
      return jsonError('Unauthorized', 401);
    }

    let body;
    try {
      body = await req.json();
    } catch (parseError) {
      console.warn(`Malformed JSON payload in forum vote: ${parseError.message}`);
      return jsonError('Bad Request: Invalid JSON payload', 400);
    }
    const { itemType, itemId, voteValue } = body;

    if (!itemType || !itemId || !voteValue) {
      return jsonError('Missing required fields', 400);
    }

    if (!['post', 'comment'].includes(itemType)) {
      return jsonError('Invalid item type', 400);
    }

    if (![1, -1].includes(voteValue)) {
      return jsonError('Invalid vote value', 400);
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
      return jsonError('Failed to record vote', 500);
    }

    // Determine correct HTTP status based on the action taken
    const status = result.action === 'added' ? 201 : 200;
    
    return jsonSuccess({ currentVote: result.current_vote }, `Vote ${result.action}`, status);
  } catch (error) {
    console.error('Vote Error:', error);
    return jsonError('Internal server error', 500);
  }
}

