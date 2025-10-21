import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

// Request validation schema
const ForgotPasswordRequestSchema = z.object({
  email: z.string().email(),
});

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = ForgotPasswordRequestSchema.parse(body);

    // Here you would normally:
    // 1. Check if the email exists in your database
    // 2. Generate a secure reset token
    // 3. Store the token with expiration time
    // 4. Send an email with the reset link

    // For demo purposes, we'll always return success to prevent email enumeration
    console.log('Password reset request for:', validatedData.email);

    // In a real implementation, you might use:
    // - JWT tokens for reset links
    // - Email service like SendGrid, Resend, or AWS SES
    // - Database to store reset tokens with expiration

    // Generate a mock reset token (in production, use proper crypto)
    const resetToken = Buffer.from(`${validatedData.email}:${Date.now()}`).toString('base64');
    const resetLink = `${process.env.NEXTAUTH_URL}/reset-password?token=${resetToken}`;

    console.log('Mock reset link:', resetLink);

    // Store in database (mock implementation)
    // await prisma.passwordReset.create({
    //   data: {
    //     email: validatedData.email,
    //     token: resetToken,
    //     expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
    //   },
    // });

    // Send email (mock implementation)
    // await emailService.send({
    //   to: validatedData.email,
    //   subject: 'Reset your NexusTrade password',
    //   template: 'password-reset',
    //   data: { resetLink },
    // });

    return NextResponse.json({
      success: true,
      message: 'If an account with this email exists, we\'ve sent a password reset link to your inbox.',
    });

  } catch (error) {
    console.error('Forgot password error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: 'Invalid email address',
          details: error.errors,
        },
        { status: 400 }
      );
    }

    // Always return success for security (prevent email enumeration)
    return NextResponse.json({
      success: true,
      message: 'If an account with this email exists, we\'ve sent a password reset link to your inbox.',
    });
  }
}
