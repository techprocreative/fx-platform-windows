import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

// Request validation schema
const ContactRequestSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  subject: z.enum(['general', 'support', 'billing', 'feedback', 'partnership']),
  message: z.string().min(10).max(5000),
});

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = ContactRequestSchema.parse(body);

    // Here you would normally:
    // 1. Store the message in your database
    // 2. Send an email notification
    // 3. Create a ticket in your support system

    // For now, we'll just log it and return success
    console.log('Contact form submission:', {
      name: validatedData.name,
      email: validatedData.email,
      subject: validatedData.subject,
      message: validatedData.message,
      timestamp: new Date().toISOString(),
    });

    // In a real implementation, you might use a service like:
    // - SendGrid, AWS SES, or Resend for email
    // - Zendesk, Intercom, or Freshdesk for support tickets
    // - Your own database for storage

    return NextResponse.json({
      success: true,
      message: 'Your message has been sent successfully. We\'ll get back to you within 24 hours.',
    });

  } catch (error) {
    console.error('Contact form error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: 'Invalid form data',
          details: error.errors,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { 
        error: 'Failed to send message',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
