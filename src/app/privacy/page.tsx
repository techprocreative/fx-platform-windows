import { Zap } from 'lucide-react';
import Link from 'next/link';

export default function PrivacyPage() {
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
          <h1 className="text-3xl font-bold text-neutral-900 mb-8">Privacy Policy</h1>
          
          <div className="prose prose-neutral max-w-none">
            <section className="mb-8">
              <h2 className="text-xl font-semibold text-neutral-900 mb-4">1. Information We Collect</h2>
              <p className="text-neutral-600 mb-4">
                We collect several types of information for various purposes to provide and improve our service to you.
              </p>
              
              <h3 className="text-lg font-medium text-neutral-900 mb-3">Personal Data</h3>
              <ul className="list-disc list-inside text-neutral-600 space-y-2 mb-4">
                <li>Email address</li>
                <li>First name and last name</li>
                <li>Phone number (optional)</li>
                <li>Usage data and analytics</li>
              </ul>

              <h3 className="text-lg font-medium text-neutral-900 mb-3">Trading Data</h3>
              <ul className="list-disc list-inside text-neutral-600 space-y-2">
                <li>Trading strategies and configurations</li>
                <li>Backtest results and analytics</li>
                <li>Trading history and performance</li>
                <li>API keys and broker credentials (encrypted)</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-neutral-900 mb-4">2. How We Use Your Information</h2>
              <p className="text-neutral-600 mb-4">NexusTrade uses the collected data for various purposes:</p>
              <ul className="list-disc list-inside text-neutral-600 space-y-2">
                <li>To provide and maintain our Service</li>
                <li>To manage your account and trading activities</li>
                <li>To process transactions and manage subscriptions</li>
                <li>To send you notifications and updates</li>
                <li>To monitor the usage of the Service</li>
                <li>To detect, prevent and address technical issues</li>
                <li>To comply with legal obligations</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-neutral-900 mb-4">3. Data Security</h2>
              <p className="text-neutral-600 mb-4">
                The security of your data is important to us. We implement appropriate security measures to protect your personal information:
              </p>
              <ul className="list-disc list-inside text-neutral-600 space-y-2">
                <li>All data is encrypted in transit using SSL/TLS</li>
                <li>Sensitive data is encrypted at rest</li>
                <li>Two-factor authentication is available</li>
                <li>Regular security audits and penetration testing</li>
                <li>Limited access to data on a need-to-know basis</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-neutral-900 mb-4">4. Data Sharing and Disclosure</h2>
              <p className="text-neutral-600 mb-4">
                We do not sell, trade, or otherwise transfer your personal information to third parties. We may share your data in the following circumstances:
              </p>
              <ul className="list-disc list-inside text-neutral-600 space-y-2">
                <li>With service providers for the purpose of operating the Service</li>
                <li>For legal compliance and protection of rights</li>
                <li>With your explicit consent</li>
                <li>As part of business transfers or mergers</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-neutral-900 mb-4">5. Cookies and Tracking</h2>
              <p className="text-neutral-600 mb-4">
                We use cookies and similar tracking technologies to track activity on our Service and hold certain information:
              </p>
              <ul className="list-disc list-inside text-neutral-600 space-y-2">
                <li>Essential cookies for Service functionality</li>
                <li>Analytics cookies to understand user behavior</li>
                <li>Preference cookies to remember your settings</li>
                <li>Security cookies for fraud prevention</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-neutral-900 mb-4">6. Data Retention</h2>
              <p className="text-neutral-600">
                We retain your personal information only as long as necessary for the purposes outlined in this privacy policy, unless a longer retention period is required or permitted by law.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-neutral-900 mb-4">7. Your Data Rights</h2>
              <p className="text-neutral-600 mb-4">You have the right to:</p>
              <ul className="list-disc list-inside text-neutral-600 space-y-2">
                <li>Access your personal data</li>
                <li>Correct inaccurate information</li>
                <li>Request deletion of your data</li>
                <li>Object to processing of your data</li>
                <li>Request data portability</li>
                <li>Withdraw consent at any time</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-neutral-900 mb-4">8. Third-Party Services</h2>
              <p className="text-neutral-600 mb-4">
                Our Service may contain links to third-party websites or services. We are not responsible for the privacy practices of these third-party services. We encourage you to review their privacy policies.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-neutral-900 mb-4">9. Children's Privacy</h2>
              <p className="text-neutral-600">
                Our Service does not address anyone under the age of 18. We do not knowingly collect personally identifiable information from anyone under the age of 18.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-neutral-900 mb-4">10. Changes to This Privacy Policy</h2>
              <p className="text-neutral-600">
                We may update our Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last updated" date.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-neutral-900 mb-4">11. Contact Us</h2>
              <p className="text-neutral-600">
                If you have any questions about this Privacy Policy, please contact us:
              </p>
              <div className="mt-4 text-neutral-600">
                <p>Email: <a href="mailto:privacy@nexustrade.com" className="text-primary-600 hover:underline">privacy@nexustrade.com</a></p>
                <p>Address: NexusTrade Inc., 123 Trading Street, Finance City, FC 12345</p>
              </div>
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
              <Link href="/privacy" className="text-primary-600 font-medium">
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
