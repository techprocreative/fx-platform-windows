import { Zap, BookOpen, Code, Play, Settings, Shield } from 'lucide-react';
import Link from 'next/link';

export default function DocsPage() {
  const guides = [
    {
      title: 'Getting Started',
      description: 'Learn the basics of NexusTrade and set up your first strategy',
      icon: Play,
      href: '/docs/getting-started',
    },
    {
      title: 'Strategy Creation',
      description: 'Create manual or AI-powered trading strategies',
      icon: Code,
      href: '/docs/strategies',
    },
    {
      title: 'Backtesting',
      description: 'Test your strategies on historical data',
      icon: BookOpen,
      href: '/docs/backtesting',
    },
    {
      title: 'Live Trading',
      description: 'Deploy strategies to live trading environments',
      icon: Settings,
      href: '/docs/live-trading',
    },
    {
      title: 'API Reference',
      description: 'Complete API documentation for developers',
      icon: Code,
      href: '/docs/api',
    },
    {
      title: 'Security',
      description: 'Learn about our security features and best practices',
      icon: Shield,
      href: '/docs/security',
    },
  ];

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Header */}
      <div className="bg-white border-b border-neutral-200">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <Zap className="h-8 w-8 text-primary-600" />
              <span className="text-2xl font-bold text-neutral-900">NexusTrade</span>
            </Link>
            <nav className="flex gap-6">
              <Link href="/" className="text-neutral-600 hover:text-neutral-900">
                Home
              </Link>
              <Link href="/docs" className="text-primary-600 font-medium">
                Docs
              </Link>
              <Link href="/login" className="text-neutral-600 hover:text-neutral-900">
                Login
              </Link>
            </nav>
          </div>
        </div>
      </div>

      {/* Hero Section */}
      <div className="bg-primary-600 text-white">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold sm:text-5xl">Documentation</h1>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-primary-100">
              Everything you need to know about NexusTrade - from beginner guides to advanced API documentation.
            </p>
          </div>
        </div>
      </div>

      {/* Guides Grid */}
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {guides.map((guide) => (
            <Link
              key={guide.title}
              href={guide.href}
              className="group block rounded-lg border border-neutral-200 bg-white p-6 hover:border-primary-300 hover:shadow-lg transition-all"
            >
              <div className="flex items-start gap-4">
                <div className="rounded-lg bg-primary-100 p-3 group-hover:bg-primary-200 transition-colors">
                  <guide.icon className="h-6 w-6 text-primary-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-neutral-900 group-hover:text-primary-600 transition-colors">
                    {guide.title}
                  </h3>
                  <p className="mt-2 text-sm text-neutral-600">
                    {guide.description}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Quick Start Section */}
      <div className="bg-white">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-neutral-900">Quick Start</h2>
            <p className="mx-auto mt-4 max-w-2xl text-neutral-600">
              Get up and running in just a few minutes
            </p>
          </div>

          <div className="mt-12">
            <div className="grid gap-8 md:grid-cols-4">
              <div className="text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary-600 text-lg font-bold text-white">
                  1
                </div>
                <h3 className="mt-4 font-semibold text-neutral-900">Sign Up</h3>
                <p className="mt-2 text-sm text-neutral-600">
                  Create your free account in seconds
                </p>
              </div>
              <div className="text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary-600 text-lg font-bold text-white">
                  2
                </div>
                <h3 className="mt-4 font-semibold text-neutral-900">Create Strategy</h3>
                <p className="mt-2 text-sm text-neutral-600">
                  Build manual or AI-powered strategies
                </p>
              </div>
              <div className="text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary-600 text-lg font-bold text-white">
                  3
                </div>
                <h3 className="mt-4 font-semibold text-neutral-900">Backtest</h3>
                <p className="mt-2 text-sm text-neutral-600">
                  Test against historical data
                </p>
              </div>
              <div className="text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary-600 text-lg font-bold text-white">
                  4
                </div>
                <h3 className="mt-4 font-semibold text-neutral-900">Go Live</h3>
                <p className="mt-2 text-sm text-neutral-600">
                  Deploy to live trading
                </p>
              </div>
            </div>
          </div>

          <div className="mt-12 text-center">
            <Link
              href="/register"
              className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-8 py-3 text-white font-semibold hover:bg-primary-700 transition-colors"
            >
              Get Started Now
            </Link>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="mt-16 border-t border-neutral-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <div className="flex items-center gap-2">
              <Zap className="h-6 w-6 text-primary-600" />
              <span className="font-semibold text-neutral-900">NexusTrade</span>
            </div>
            <div className="flex gap-6 text-sm text-neutral-600">
              <Link href="/privacy" className="hover:text-neutral-900 transition-colors">
                Privacy
              </Link>
              <Link href="/terms" className="hover:text-neutral-900 transition-colors">
                Terms
              </Link>
              <Link href="/contact" className="hover:text-neutral-900 transition-colors">
                Contact
              </Link>
            </div>
            <p className="text-sm text-neutral-500">© 2024 NexusTrade. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
