import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '../lib/auth';
import Link from 'next/link';
import { ArrowRight, Zap, Shield, TrendingUp } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const session = await getServerSession(authOptions);

  if (session) {
    redirect('/dashboard');
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-900 via-primary-800 to-primary-700">
      {/* Navigation */}
      <nav className="border-b border-white/10 backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="h-8 w-8 text-yellow-400" />
              <span className="text-2xl font-bold text-white">NexusTrade</span>
            </div>
            <div className="flex gap-4">
              <Link
                href="/login"
                className="rounded-lg px-4 py-2 text-white hover:bg-white/10 transition-colors"
              >
                Login
              </Link>
              <Link
                href="/register"
                className="rounded-lg bg-primary-500 px-4 py-2 text-white hover:bg-primary-600 transition-colors"
              >
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="text-center">
          <h1 className="text-5xl font-bold tracking-tight text-white sm:text-7xl">
            AI-Powered Trading for Everyone
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-xl text-white/80">
            Design, test, and execute trading strategies with the power of artificial intelligence.
            No coding required.
          </p>
          <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:justify-center sm:gap-6">
            <Link
              href="/register"
              className="inline-flex items-center gap-2 rounded-lg bg-primary-500 px-8 py-3 text-lg font-semibold text-white hover:bg-primary-600 transition-colors"
            >
              Start Free Trial <ArrowRight className="h-5 w-5" />
            </Link>
            <Link
              href="/docs"
              className="inline-flex items-center gap-2 rounded-lg border border-white/20 px-8 py-3 text-lg font-semibold text-white hover:bg-white/10 transition-colors"
            >
              Learn More
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="grid gap-8 md:grid-cols-3">
          <div className="rounded-lg border border-white/10 bg-white/5 p-8 backdrop-blur-sm hover:bg-white/10 transition-colors">
            <Zap className="mb-4 h-12 w-12 text-yellow-400" />
            <h3 className="mb-2 text-xl font-bold text-white">AI Strategy Generation</h3>
            <p className="text-white/70">
              Describe your trading idea in plain English. Our AI converts it into a working
              strategy instantly.
            </p>
          </div>

          <div className="rounded-lg border border-white/10 bg-white/5 p-8 backdrop-blur-sm hover:bg-white/10 transition-colors">
            <TrendingUp className="mb-4 h-12 w-12 text-green-400" />
            <h3 className="mb-2 text-xl font-bold text-white">Backtesting Engine</h3>
            <p className="text-white/70">
              Test your strategies on historical data. Understand performance, risks, and potential
              returns.
            </p>
          </div>

          <div className="rounded-lg border border-white/10 bg-white/5 p-8 backdrop-blur-sm hover:bg-white/10 transition-colors">
            <Shield className="mb-4 h-12 w-12 text-blue-400" />
            <h3 className="mb-2 text-xl font-bold text-white">Enterprise Security</h3>
            <p className="text-white/70">
              Military-grade encryption. Your strategies and trades are protected. Always.
            </p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="rounded-xl border border-white/10 bg-white/5 p-8 backdrop-blur-sm sm:p-12">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-white sm:text-4xl">Ready to Start Trading?</h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-white/70">
              Join hundreds of traders already using NexusTrade to automate their trading strategies.
            </p>
            <Link
              href="/register"
              className="mt-8 inline-flex items-center gap-2 rounded-lg bg-primary-500 px-8 py-3 text-lg font-semibold text-white hover:bg-primary-600 transition-colors"
            >
              Create Free Account <ArrowRight className="h-5 w-5" />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 bg-white/5 backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <div className="flex items-center gap-2">
              <Zap className="h-6 w-6 text-yellow-400" />
              <span className="font-semibold text-white">NexusTrade</span>
            </div>
            <div className="flex gap-6 text-sm text-white/70">
              <Link href="/privacy" className="hover:text-white transition-colors">
                Privacy
              </Link>
              <Link href="/terms" className="hover:text-white transition-colors">
                Terms
              </Link>
              <Link href="/contact" className="hover:text-white transition-colors">
                Contact
              </Link>
            </div>
            <p className="text-sm text-white/50">© 2024 NexusTrade. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
