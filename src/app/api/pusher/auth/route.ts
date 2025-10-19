/**
 * PUSHER AUTHENTICATION ENDPOINT
 * Authenticates Pusher channel subscriptions for private/presence channels
 * Required for Vercel deployment with Pusher
 */

import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../../lib/auth';
import { authenticatePusherChannel, isRealtimeConfigured } from '../../../../lib/realtime/pusher-service';
import { 
  createErrorResponse, 
  createSecureResponse,
  extractAPIKey,
  validateAPIKey,
  rateLimit,
  getClientIP
} from '../../../../lib/api-security';

export async function POST(request: NextRequest) {
  try {
    // Check if Pusher is configured
    if (!isRealtimeConfigured()) {
      return createErrorResponse('Realtime service not configured', 501);
    }

    // Rate limiting
    const ip = getClientIP(request);
    const rateLimitResult = await rateLimit(
      `pusher_auth_${ip}`,
      30, // 30 requests
      60000 // per minute
    );

    if (!rateLimitResult.allowed) {
      return createErrorResponse('Rate limit exceeded', 429, {
        retryAfter: Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000),
      });
    }

    // Parse request body
    const body = await request.formData();
    const socketId = body.get('socket_id') as string;
    const channelName = body.get('channel_name') as string;

    if (!socketId || !channelName) {
      return createErrorResponse('Missing socket_id or channel_name', 400);
    }

    // Authenticate based on channel type
    if (channelName.startsWith('private-executor-')) {
      // Executor channels require API key
      const apiKey = extractAPIKey(request);
      if (!apiKey) {
        return createErrorResponse('API key required for executor channels', 401);
      }

      const executor = await validateAPIKey(apiKey);
      if (!executor) {
        return createErrorResponse('Invalid API key', 401);
      }

      // Verify executor owns this channel
      const channelExecutorId = channelName.replace('private-executor-', '');
      if (executor.id !== channelExecutorId) {
        return createErrorResponse('Unauthorized channel access', 403);
      }

      // Generate auth response
      const authResponse = await authenticatePusherChannel(
        socketId,
        channelName,
        executor.userId
      );

      return createSecureResponse(authResponse);
    } else if (channelName.startsWith('private-user-')) {
      // User channels require session
      const session = await getServerSession(authOptions);
      if (!session?.user?.id) {
        return createErrorResponse('Authentication required', 401);
      }

      // Verify user owns this channel
      const channelUserId = channelName.replace('private-user-', '');
      if (session.user.id !== channelUserId) {
        return createErrorResponse('Unauthorized channel access', 403);
      }

      // Generate auth response
      const authResponse = await authenticatePusherChannel(
        socketId,
        channelName,
        session.user.id
      );

      return createSecureResponse(authResponse);
    } else if (channelName.startsWith('presence-')) {
      // Presence channels require session
      const session = await getServerSession(authOptions);
      if (!session?.user?.id) {
        return createErrorResponse('Authentication required', 401);
      }

      // Generate auth response with user data
      const authResponse = await authenticatePusherChannel(
        socketId,
        channelName,
        session.user.id
      );

      return createSecureResponse(authResponse);
    } else {
      // Public channels don't need authentication
      return createErrorResponse('Public channels do not require authentication', 400);
    }
  } catch (error) {
    console.error('Pusher auth error:', error);
    return createErrorResponse('Failed to authenticate channel', 500);
  }
}
