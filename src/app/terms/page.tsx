import { Zap } from 'lucide-react';
import Link from 'next/link';

export default function TermsPage() {
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
              <Link href="/docs" className="text-neutral-600 hover:text-neutral-900">
                Docs
              </Link>
              <Link href="/login" className="text-neutral-600 hover:text-neutral-900">
                Login
              </Link>
            </nav>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow-sm p-8">
          <h1 className="text-3xl font-bold text-neutral-900 mb-8">Terms of Service</h1>
          
          <div className="prose prose-neutral max-w-none">
            <section className="mb-8">
              <h2 className="text-xl font-semibold text-neutral-900 mb-4">1. Acceptance of Terms</h2>
              <p className="text-neutral-600">
                By accessing and using NexusTrade, you accept and agree to be bound by the terms and provision of this agreement.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-neutral-900 mb-4">2. Use License</h2>
              <p className="text-neutral-600 mb-4">
                Permission is granted to temporarily access the materials (the "Service") on NexusTrade for personal, non-commercial transitory viewing only. This is the grant of a license, not a transfer of title.
              </p>
              <ul className="list-disc list-inside text-neutral-600 space-y-2">
                <li>You may not modify or copy the materials</li>
                <li>You may not use the materials for any commercial purpose</li>
                <li>You may not reverse engineer any aspect of the Service</li>
                <li>You may not remove any copyright or other proprietary notations</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-neutral-900 mb-4">3. Risk Disclaimer</h2>
              <p className="text-neutral-600 mb-4">
                Trading financial instruments carries a high level of risk and may not be suitable for all investors. The possibility exists that you could sustain a loss of some or all of your initial investment.
              </p>
              <p className="text-neutral-600">
                You should not risk more than you are prepared to lose. Before deciding to trade, you should carefully consider your investment objectives, level of experience, and risk appetite.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-neutral-900 mb-4">4. User Responsibilities</h2>
              <ul className="list-disc list-inside text-neutral-600 space-y-2">
                <li>Maintain the confidentiality of your account credentials</li>
                <li>Provide accurate and complete information</li>
                <li>Not use the Service for any illegal or unauthorized purpose</li>
                <li>Not attempt to gain unauthorized access to the Service</li>
                <li>Not interfere with or disrupt the Service</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-neutral-900 mb-4">5. Payment and Subscription</h2>
              <p className="text-neutral-600">
                Certain features and services may be subject to payment of fees. All fees are non-refundable unless otherwise specified. We reserve the right to modify our fees at any time.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-neutral-900 mb-4">6. Data and Privacy</h2>
              <p className="text-neutral-600">
                Your privacy is important to us. Please review our Privacy Policy, which also governs the Service, to understand our practices.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-neutral-900 mb-4">7. Service Availability</h2>
              <p className="text-neutral-600">
                We do not guarantee that the Service will be available at all times. We may experience hardware, software, or other problems that could lead to interruptions.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-neutral-900 mb-4">8. Limitation of Liability</h2>
              <p className="text-neutral-600">
                In no event shall NexusTrade, nor its directors, employees, partners, agents, suppliers, or affiliates, be liable for any indirect, incidental, special, consequential, or punitive damages, including loss of profits, data, use, or other intangible losses.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-neutral-900 mb-4">9. Termination</h2>
              <p className="text-neutral-600">
                We may terminate or suspend your account immediately, without prior notice or liability, for any reason whatsoever, including without limitation if you breach the Terms.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-neutral-900 mb-4">10. Changes to Terms</h2>
              <p className="text-neutral-600">
                We reserve the right to modify or replace these Terms at any time. If a revision is material, we will try to provide at least 30 days notice prior to any new terms taking effect.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-neutral-900 mb-4">11. Contact Information</h2>
              <p className="text-neutral-600">
                Questions about the Terms of Service should be sent to us at <a href="mailto:support@nexustrade.com" className="text-primary-600 hover:underline">support@nexustrade.com</a>.
              </p>
            </section>

            <div className="mt-12 pt-8 border-t border-neutral-200">
              <p className="text-sm text-neutral-500">
                Last updated: {new Date().toLocaleDateString()}
              </p>
            </div>
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
              <Link href="/terms" className="text-primary-600 font-medium">
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
