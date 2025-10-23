/**
 * Pusher Authentication Endpoint
 *
 * POST /api/pusher/auth
 *
 * This endpoint authenticates private channel subscriptions.
 * Supports TWO authentication methods:
 * 1. Session-based (for web users via NextAuth)
 * 2. API Key-based (for Windows Executors)
 *
 * Required for private-* channels in Pusher.
 */

import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getPusherServer } from "@/lib/pusher/server";
import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";

export const dynamic = "force-dynamic";

/**
 * Authenticate via Session (for web users)
 */
async function authenticateViaSession(
  req: NextRequest,
): Promise<{ userId: string; authType: string } | null> {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return null;
    }

    return {
      userId: session.user.id,
      authType: "session",
    };
  } catch (error) {
    console.error("Session authentication error:", error);
    return null;
  }
}

/**
 * Authenticate via API Key (for executors)
 */
async function authenticateViaApiKey(
  req: NextRequest,
): Promise<{ userId: string; authType: string; executorId?: string } | null> {
  try {
    const apiKey = req.headers.get("x-api-key");
    const apiSecret = req.headers.get("x-api-secret");

    if (!apiKey || !apiSecret) {
      return null;
    }

    // Find executor by API key
    const executor = await prisma.executor.findFirst({
      where: {
        apiKey,
        deletedAt: null,
      },
      select: {
        id: true,
        userId: true,
        apiSecretHash: true,
      },
    });

    if (!executor) {
      console.warn(`Invalid executor API key attempt: ${apiKey}`);
      return null;
    }

    // Verify API secret
    let isValidSecret = false;
    try {
      isValidSecret = await bcrypt.compare(apiSecret, executor.apiSecretHash);
    } catch (error) {
      console.error("Error comparing API secret:", error);
      return null;
    }

    if (!isValidSecret) {
      console.warn(`Invalid API secret for executor: ${executor.id}`);
      return null;
    }

    return {
      userId: executor.userId,
      authType: "api-key",
      executorId: executor.id,
    };
  } catch (error) {
    console.error("API key authentication error:", error);
    return null;
  }
}

/**
 * Validate user has access to channel
 */
async function validateChannelAccess(
  channelName: string,
  userId: string,
  executorId?: string,
): Promise<boolean> {
  try {
    // User private channels
    if (channelName.startsWith("private-user-")) {
      const requestedUserId = channelName.replace("private-user-", "");
      return requestedUserId === userId;
    }

    // Executor channels
    if (channelName.startsWith("private-executor-")) {
      const requestedExecutorId = channelName.replace("private-executor-", "");

      // If authenticating via API key, verify it's their executor
      if (executorId) {
        return requestedExecutorId === executorId;
      }

      // If authenticating via session, verify they own the executor
      const executor = await prisma.executor.findFirst({
        where: {
          id: requestedExecutorId,
          userId,
          deletedAt: null,
        },
      });

      return !!executor;
    }

    // Presence channels
    if (channelName.startsWith("presence-")) {
      // Allow presence channel subscription if user is authenticated
      return true;
    }

    // Public channels (not applicable for private channels)
    return false;
  } catch (error) {
    console.error("Channel access validation error:", error);
    return false;
  }
}

/**
 * POST /api/pusher/auth
 *
 * Form data:
 *   - socket_id: Pusher socket ID
 *   - channel_name: Channel to subscribe to
 *
 * Headers (for API key auth):
 *   - X-API-Key: Executor API key
 *   - X-API-Secret: Executor API secret
 */
export async function POST(req: NextRequest) {
  const startTime = Date.now();

  try {
    // 1. Parse form data
    const formData = await req.formData();
    const socketId = formData.get("socket_id") as string;
    const channelName = formData.get("channel_name") as string;

    if (!socketId || !channelName) {
      console.warn("Missing socket_id or channel_name in Pusher auth request");
      return NextResponse.json(
        { error: "Missing socket_id or channel_name" },
        { status: 400 },
      );
    }

    // 2. Try both authentication methods
    let authResult = await authenticateViaApiKey(req);

    if (!authResult) {
      authResult = await authenticateViaSession(req);
    }

    if (!authResult) {
      console.warn(
        `Pusher auth failed: No valid authentication for channel ${channelName}`,
      );
      return NextResponse.json(
        { error: "Unauthorized: Invalid credentials" },
        { status: 401 },
      );
    }

    const { userId, authType, executorId } = authResult;

    // 3. Validate channel access
    const hasAccess = await validateChannelAccess(
      channelName,
      userId,
      executorId,
    );

    if (!hasAccess) {
      console.warn(
        `Forbidden: ${authType} auth (user: ${userId}, executor: ${executorId}) ` +
          `attempted to access channel: ${channelName}`,
      );
      return NextResponse.json(
        { error: "Forbidden: Cannot subscribe to this channel" },
        { status: 403 },
      );
    }

    // 4. Generate Pusher authentication response
    const pusher = getPusherServer();

    const authResponse = pusher.authorizeChannel(socketId, channelName, {
      user_id: userId,
      user_info: {
        authType,
        ...(executorId && { executorId }),
      },
    });

    // 5. Log successful authentication for auditing
    const processingTime = Date.now() - startTime;
    console.log(
      `Pusher auth success [${authType}]: user=${userId}, ` +
        `channel=${channelName}, time=${processingTime}ms`,
    );

    return NextResponse.json(authResponse, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    console.error("Pusher authentication error:", error);

    // Don't expose internal error details
    return NextResponse.json(
      { error: "Authentication service error" },
      { status: 500 },
    );
  }
}

/**
 * OPTIONS handler for CORS preflight
 */
export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-API-Key, X-API-Secret",
      "Access-Control-Max-Age": "3600",
    },
  });
}
