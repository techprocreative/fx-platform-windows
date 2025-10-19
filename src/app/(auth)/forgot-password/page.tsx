'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { Zap, Mail, ArrowLeft, CheckCircle } from 'lucide-react';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [emailSent, setEmailSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.message || 'Failed to send reset email');
        setLoading(false);
        return;
      }

      setEmailSent(true);
      toast.success('Reset email sent! Check your inbox.');
    } catch (error) {
      toast.error('An error occurred');
      setLoading(false);
    }
  };

  if (emailSent) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-900 via-primary-800 to-primary-700 flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          <div className="text-center">
            <div className="mx-auto mb-8 flex items-center justify-center gap-2">
              <Zap className="h-8 w-8 text-yellow-400" />
              <span className="text-3xl font-bold text-white">NexusTrade</span>
            </div>

            <div className="rounded-lg border border-white/10 bg-white/10 p-8 backdrop-blur-sm">
              <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-green-500/20">
                <CheckCircle className="h-8 w-8 text-green-400" />
              </div>

              <h2 className="text-2xl font-bold text-white mb-4">Email Sent!</h2>
              
              <p className="text-white/80 mb-6">
                We've sent a password reset link to <span className="font-semibold">{email}</span>. 
                Please check your inbox and follow the instructions.
              </p>

              <div className="space-y-3 text-sm text-white/60">
                <p>• Make sure to check your spam folder</p>
                <p>• The link will expire in 1 hour</p>
                <p>• If you don't receive it, try again</p>
              </div>

              <div className="mt-8 space-y-3">
                <button
                  onClick={() => setEmailSent(false)}
                  className="w-full rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-white font-medium hover:bg-white/20 transition-colors"
                >
                  Try Again
                </button>

                <Link
                  href="/login"
                  className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-white/20 px-4 py-2 text-white font-medium hover:bg-white/30 transition-colors"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to Login
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-900 via-primary-800 to-primary-700 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Zap className="h-8 w-8 text-yellow-400" />
            <span className="text-3xl font-bold text-white">NexusTrade</span>
          </div>
          <p className="text-white/70">Reset your password</p>
        </div>

        {/* Form */}
        <div className="rounded-lg border border-white/10 bg-white/10 p-8 backdrop-blur-sm">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary-500/20">
              <Mail className="h-6 w-6 text-primary-300" />
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">Forgot Password?</h2>
            <p className="text-white/70 text-sm">
              Enter your email address and we'll send you a link to reset your password.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-white mb-2">
                Email Address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                className="w-full rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-white placeholder-white/50 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-400/20 disabled:opacity-50"
                placeholder="you@example.com"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-primary-500 px-4 py-2.5 font-semibold text-white hover:bg-primary-600 disabled:bg-primary-500/50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Sending...' : 'Send Reset Link'}
            </button>
          </form>

          <div className="mt-6 space-y-2 text-center text-sm text-white/70">
            <p>
              Remember your password?{' '}
              <Link href="/login" className="font-medium text-primary-300 hover:text-primary-200">
                Back to Login
              </Link>
            </p>
            <p>
              Don't have an account?{' '}
              <Link href="/register" className="font-medium text-primary-300 hover:text-primary-200">
                Sign up
              </Link>
            </p>
          </div>
        </div>

        {/* Security Notice */}
        <div className="mt-8 rounded-lg border border-white/10 bg-white/5 p-4 text-sm">
          <p className="text-white/70 text-center">
            🔒 Your account security is important to us. Password reset links expire after 1 hour for your protection.
          </p>
        </div>
      </div>
    </div>
  );
}
