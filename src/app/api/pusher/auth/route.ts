/**
 * Pusher Authentication Endpoint
 * 
 * This endpoint authenticates private channel subscriptions.
 * Required for private-* channels in Pusher.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getPusherServer } from '@/lib/pusher/server';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const data = await req.formData();
    const socketId = data.get('socket_id') as string;
    const channelName = data.get('channel_name') as string;

    if (!socketId || !channelName) {
      return NextResponse.json(
        { error: 'Missing socket_id or channel_name' },
        { status: 400 }
      );
    }

    // Validate channel access
    const userId = session.user.id;
    
    // User can only subscribe to their own private channel
    if (channelName.startsWith('private-user-')) {
      const requestedUserId = channelName.replace('private-user-', '');
      if (requestedUserId !== userId) {
        return NextResponse.json(
          { error: 'Forbidden: Cannot subscribe to another user\'s channel' },
          { status: 403 }
        );
      }
    }
    
    // User can only subscribe to their own executor channels
    if (channelName.startsWith('private-executor-')) {
      const executorId = channelName.replace('private-executor-', '');
      
      // TODO: Verify user owns this executor
      // For now, we'll allow it if user is authenticated
    }

    const pusher = getPusherServer();
    
    // Authenticate the channel subscription
    const authResponse = pusher.authorizeChannel(socketId, channelName, {
      user_id: userId,
      user_info: {
        email: session.user.email,
        name: session.user.name,
      },
    });

    return NextResponse.json(authResponse);
  } catch (error) {
    console.error('Pusher auth error:', error);
    return NextResponse.json(
      { error: 'Authentication failed' },
      { status: 500 }
    );
  }
}
