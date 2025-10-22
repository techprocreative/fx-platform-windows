// API Route: PATCH/DELETE /api/alerts/[id]
// Update or delete specific alert

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// PATCH /api/alerts/[id] - Acknowledge or mark as read
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { acknowledged, read } = body;

    // Get existing alert (audit log)
    const alert = await prisma.auditLog.findFirst({
      where: {
        id: params.id,
        userId: session.user.id
      }
    });

    if (!alert) {
      return NextResponse.json(
        { error: 'Alert not found' },
        { status: 404 }
      );
    }

    // Update metadata
    const currentMetadata = (alert.metadata as any) || {};
    const updatedMetadata = {
      ...currentMetadata,
      ...(acknowledged !== undefined && { acknowledged }),
      ...(read !== undefined && { read }),
      updatedAt: new Date().toISOString()
    };

    // Update alert
    const updated = await prisma.auditLog.update({
      where: { id: params.id },
      data: {
        metadata: updatedMetadata
      }
    });

    return NextResponse.json({
      success: true,
      alert: {
        id: updated.id,
        acknowledged: updatedMetadata.acknowledged,
        read: updatedMetadata.read,
        updatedAt: updatedMetadata.updatedAt
      }
    });

  } catch (error: any) {
    console.error('❌ Update alert API error:', error);
    
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/alerts/[id] - Delete alert
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Verify ownership
    const alert = await prisma.auditLog.findFirst({
      where: {
        id: params.id,
        userId: session.user.id
      }
    });

    if (!alert) {
      return NextResponse.json(
        { error: 'Alert not found' },
        { status: 404 }
      );
    }

    // Delete alert
    await prisma.auditLog.delete({
      where: { id: params.id }
    });

    return NextResponse.json({
      success: true,
      message: 'Alert deleted successfully'
    });

  } catch (error: any) {
    console.error('❌ Delete alert API error:', error);
    
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
