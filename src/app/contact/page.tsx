'use client';

import { useState } from 'react';
import { Zap, Send, Mail, Phone, MapPin } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

export default function ContactPage() {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
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
      await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      toast.success('Message sent successfully! We\'ll get back to you soon.');
      setFormData({ name: '', email: '', subject: '', message: '' });
    } catch (error) {
      toast.error('Failed to send message. Please try again.');
    } finally {
      setLoading(false);
    }
  };

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

      {/* Hero Section */}
      <div className="bg-primary-600 text-white">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold sm:text-5xl">Contact Us</h1>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-primary-100">
              Have questions? Need support? We're here to help you succeed with your trading journey.
            </p>
          </div>
        </div>
      </div>

      {/* Contact Content */}
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-2">
          {/* Contact Form */}
          <div className="bg-white rounded-lg shadow-sm p-8">
            <h2 className="text-2xl font-bold text-neutral-900 mb-6">Send us a Message</h2>
            
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-neutral-700 mb-2">
                  Name
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  required
                  value={formData.name}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-neutral-300 px-4 py-2 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                  placeholder="Your name"
                />
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-neutral-700 mb-2">
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-neutral-300 px-4 py-2 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                  placeholder="your.email@example.com"
                />
              </div>

              <div>
                <label htmlFor="subject" className="block text-sm font-medium text-neutral-700 mb-2">
                  Subject
                </label>
                <select
                  id="subject"
                  name="subject"
                  required
                  value={formData.subject}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-neutral-300 px-4 py-2 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                >
                  <option value="">Select a topic</option>
                  <option value="general">General Inquiry</option>
                  <option value="support">Technical Support</option>
                  <option value="billing">Billing Question</option>
                  <option value="feedback">Feedback</option>
                  <option value="partnership">Partnership Opportunity</option>
                </select>
              </div>

              <div>
                <label htmlFor="message" className="block text-sm font-medium text-neutral-700 mb-2">
                  Message
                </label>
                <textarea
                  id="message"
                  name="message"
                  required
                  rows={5}
                  value={formData.message}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-neutral-300 px-4 py-2 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                  placeholder="Tell us how we can help you..."
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-primary-600 px-6 py-3 text-white font-semibold hover:bg-primary-700 disabled:bg-primary-600/50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'Sending...' : 'Send Message'}
              </button>
            </form>
          </div>

          {/* Contact Information */}
          <div className="space-y-8">
            <div className="bg-white rounded-lg shadow-sm p-8">
              <h2 className="text-2xl font-bold text-neutral-900 mb-6">Get in Touch</h2>
              
              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="rounded-lg bg-primary-100 p-3">
                    <Mail className="h-6 w-6 text-primary-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-neutral-900">Email</h3>
                    <p className="text-neutral-600">support@nexustrade.com</p>
                    <p className="text-sm text-neutral-500">We respond within 24 hours</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="rounded-lg bg-primary-100 p-3">
                    <Phone className="h-6 w-6 text-primary-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-neutral-900">Phone</h3>
                    <p className="text-neutral-600">+1 (555) 123-4567</p>
                    <p className="text-sm text-neutral-500">Mon-Fri 9AM-6PM EST</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="rounded-lg bg-primary-100 p-3">
                    <MapPin className="h-6 w-6 text-primary-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-neutral-900">Address</h3>
                    <p className="text-neutral-600">
                      NexusTrade Inc.<br />
                      123 Trading Street<br />
                      Finance City, FC 12345
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <h3 className="font-semibold text-blue-900 mb-2">Looking for Documentation?</h3>
              <p className="text-blue-700 mb-4">
                Check out our comprehensive documentation for answers to common questions and detailed guides.
              </p>
              <Link
                href="/docs"
                className="inline-flex items-center gap-2 text-blue-600 font-medium hover:text-blue-700"
              >
                View Documentation →
              </Link>
            </div>

            <div className="bg-green-50 border border-green-200 rounded-lg p-6">
              <h3 className="font-semibold text-green-900 mb-2">Community Support</h3>
              <p className="text-green-700 mb-4">
                Join our community forum to connect with other traders and get help from experienced users.
              </p>
              <Link
                href="/community"
                className="inline-flex items-center gap-2 text-green-600 font-medium hover:text-green-700"
              >
                Join Community →
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* FAQ Section */}
      <div className="bg-white">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-neutral-900">Frequently Asked Questions</h2>
            <p className="mx-auto mt-4 max-w-2xl text-neutral-600">
              Quick answers to common questions about NexusTrade
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-2">
            <div className="space-y-4">
              <div className="border-l-4 border-primary-600 pl-6">
                <h3 className="font-semibold text-neutral-900 mb-2">How do I get started?</h3>
                <p className="text-neutral-600">
                  Sign up for a free account, create your first strategy, and test it with our backtesting engine before going live.
                </p>
              </div>

              <div className="border-l-4 border-primary-600 pl-6">
                <h3 className="font-semibold text-neutral-900 mb-2">Is my data secure?</h3>
                <p className="text-neutral-600">
                  Yes! We use industry-standard encryption and security measures to protect your data and trading strategies.
                </p>
              </div>

              <div className="border-l-4 border-primary-600 pl-6">
                <h3 className="font-semibold text-neutral-900 mb-2">What brokers do you support?</h3>
                <p className="text-neutral-600">
                  We support most major forex and crypto brokers through API integration. Check our documentation for the full list.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="border-l-4 border-primary-600 pl-6">
                <h3 className="font-semibold text-neutral-900 mb-2">Can I use custom indicators?</h3>
                <p className="text-neutral-600">
                  Yes! You can create custom indicators and use them in your trading strategies. Our API supports custom indicator development.
                </p>
              </div>

              <div className="border-l-4 border-primary-600 pl-6">
                <h3 className="font-semibold text-neutral-900 mb-2">What's the pricing?</h3>
                <p className="text-neutral-600">
                  We offer a free tier for basic use, with paid plans for advanced features. Check our pricing page for details.
                </p>
              </div>

              <div className="border-l-4 border-primary-600 pl-6">
                <h3 className="font-semibold text-neutral-900 mb-2">Do you offer refunds?</h3>
                <p className="text-neutral-600">
                  We offer a 30-day money-back guarantee for new subscriptions. Contact support for refund requests.
                </p>
              </div>
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
              <Link href="/terms" className="hover:text-neutral-900 transition-colors">
                Terms
              </Link>
              <Link href="/contact" className="text-primary-600 font-medium">
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
