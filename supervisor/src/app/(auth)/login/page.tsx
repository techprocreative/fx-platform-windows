'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { Zap } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    try {
      console.log('Attempting login with:', formData.email);
      
      const result = await signIn('credentials', {
        email: formData.email,
        password: formData.password,
        redirect: false,
      });

      console.log('Login result:', result);

      if (result?.error) {
        console.error('Login error:', result.error);
        toast.error(result.error || 'Login failed');
        setLoading(false);
        return;
      }

      if (result?.ok) {
        toast.success('Login successful!');
        console.log('Redirecting to dashboard...');
        // Force a hard navigation to ensure session is loaded
        window.location.href = '/dashboard';
      } else {
        toast.error('Login failed. Please try again.');
        setLoading(false);
      }
    } catch (error) {
      console.error('Login exception:', error);
      toast.error('An error occurred during login');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-900 via-primary-800 to-primary-700 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="mb-8 text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Zap className="h-8 w-8 text-yellow-400" />
            <span className="text-3xl font-bold text-white">NexusTrade</span>
          </div>
          <p className="text-white/70">Welcome back to your trading platform</p>
        </div>

        {/* Form */}
        <div className="rounded-lg border border-white/10 bg-white/10 p-8 backdrop-blur-sm">
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
                value={formData.email}
                onChange={handleChange}
                disabled={loading}
                className="w-full rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-white placeholder-white/50 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-400/20 disabled:opacity-50"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-white mb-2">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                value={formData.password}
                onChange={handleChange}
                disabled={loading}
                className="w-full rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-white placeholder-white/50 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-400/20 disabled:opacity-50"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-primary-500 px-4 py-2.5 font-semibold text-white hover:bg-primary-600 disabled:bg-primary-500/50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Logging in...' : 'Login'}
            </button>
          </form>

          <div className="mt-6 space-y-2 text-center text-sm text-white/70">
            <p>
              Don't have an account?{' '}
              <Link href="/register" className="font-medium text-primary-300 hover:text-primary-200">
                Create one
              </Link>
            </p>
            <p>
              <Link href="/forgot-password" className="font-medium text-primary-300 hover:text-primary-200">
                Forgot your password?
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
