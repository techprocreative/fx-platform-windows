"use client";

import { useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Zap, AlertCircle, CheckCircle } from "lucide-react";

interface FormData {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
  agreeToTerms: boolean;
}

interface FormErrors {
  firstName?: string;
  lastName?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
  agreeToTerms?: string;
}

export default function RegisterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [errors, setErrors] = useState<FormErrors>({});
  const [formData, setFormData] = useState<FormData>({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
    agreeToTerms: false,
  });

  // Simple toast implementation to avoid external library issues
  const showToast = useCallback(
    (message: string, type: "success" | "error" = "success") => {
      // Create toast element
      const toast = document.createElement("div");
      toast.className = `fixed top-4 right-4 px-6 py-3 rounded-lg shadow-lg z-50 transition-all transform translate-x-0 ${
        type === "success" ? "bg-green-500 text-white" : "bg-red-500 text-white"
      }`;
      toast.textContent = message;

      document.body.appendChild(toast);

      // Auto remove after 3 seconds
      setTimeout(() => {
        toast.style.transform = "translateX(400px)";
        setTimeout(() => {
          document.body.removeChild(toast);
        }, 300);
      }, 3000);
    },
    [],
  );

  // Password strength calculation
  const calculatePasswordStrength = useCallback((password: string): number => {
    let score = 0;

    if (password.length >= 8) score += 1;
    if (password.length >= 12) score += 1;
    if (/[a-z]/.test(password)) score += 1;
    if (/[A-Z]/.test(password)) score += 1;
    if (/[0-9]/.test(password)) score += 1;
    if (/[^a-zA-Z0-9]/.test(password)) score += 1;

    return Math.min(score, 5);
  }, []);

  // Form validation
  const validateForm = useCallback((): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.firstName.trim()) {
      newErrors.firstName = "First name is required";
    }

    if (!formData.lastName.trim()) {
      newErrors.lastName = "Last name is required";
    }

    if (!formData.email.includes("@")) {
      newErrors.email = "Valid email is required";
    }

    if (formData.password.length < 8) {
      newErrors.password = "Password must be at least 8 characters";
    }

    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
    }

    if (!formData.agreeToTerms) {
      newErrors.agreeToTerms = "You must agree to terms and conditions";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData]);

  // Handle input changes
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const { name, value, type, checked } = e.target;

      setFormData((prev) => ({
        ...prev,
        [name]: type === "checkbox" ? checked : value,
      }));

      // Clear error for this field
      if (errors[name as keyof FormErrors]) {
        setErrors((prev) => ({
          ...prev,
          [name]: undefined,
        }));
      }

      // Calculate password strength
      if (name === "password") {
        const strength = calculatePasswordStrength(value);
        setPasswordStrength(strength);
      }
    },
    [errors, calculatePasswordStrength],
  );

  // Handle form submission
  const handleSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();

      if (!validateForm()) {
        showToast("Please fix the errors in the form", "error");
        return;
      }

      setLoading(true);

      try {
        const response = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });

        const data = await response.json();

        if (!response.ok) {
          showToast(data.message || "Registration failed", "error");
          return;
        }

        showToast("Registration successful! Redirecting to login...");
        setTimeout(() => {
          router.push("/login");
        }, 1500);
      } catch (error) {
        console.error("Registration error:", error);
        showToast("An error occurred during registration", "error");
      } finally {
        setLoading(false);
      }
    },
    [formData, validateForm, showToast, router],
  );

  // Memoized password strength color
  const passwordStrengthColor = useMemo(() => {
    if (passwordStrength < 2) return "bg-red-500";
    if (passwordStrength < 4) return "bg-yellow-500";
    return "bg-green-500";
  }, [passwordStrength]);

  // Memoized password strength text
  const passwordStrengthText = useMemo(() => {
    if (passwordStrength < 2) return "Weak";
    if (passwordStrength < 4) return "Fair";
    return "Strong";
  }, [passwordStrength]);

  // Memoized password match status
  const passwordMatchStatus = useMemo(() => {
    if (!formData.confirmPassword) return null;
    return formData.password === formData.confirmPassword;
  }, [formData.password, formData.confirmPassword]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-900 via-primary-800 to-primary-700 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="mb-8 text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Zap className="h-8 w-8 text-yellow-400" />
            <span className="text-3xl font-bold text-white">NexusTrade</span>
          </div>
          <p className="text-white/70">Create your trading account</p>
        </div>

        {/* Form */}
        <div className="rounded-lg border border-white/10 bg-white/10 p-8 backdrop-blur-sm">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Names */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="firstName"
                  className="block text-sm font-medium text-white mb-2"
                >
                  First Name
                </label>
                <input
                  id="firstName"
                  name="firstName"
                  type="text"
                  required
                  value={formData.firstName}
                  onChange={handleChange}
                  disabled={loading}
                  className={`w-full rounded-lg border bg-white/10 px-4 py-2 text-white placeholder-white/50 focus:outline-none focus:ring-2 disabled:opacity-50 ${
                    errors.firstName
                      ? "border-red-500 focus:ring-red-500/20"
                      : "border-white/20 focus:border-primary-400 focus:ring-primary-400/20"
                  }`}
                  placeholder="John"
                />
                {errors.firstName && (
                  <p className="mt-1 text-xs text-red-400">
                    {errors.firstName}
                  </p>
                )}
              </div>
              <div>
                <label
                  htmlFor="lastName"
                  className="block text-sm font-medium text-white mb-2"
                >
                  Last Name
                </label>
                <input
                  id="lastName"
                  name="lastName"
                  type="text"
                  required
                  value={formData.lastName}
                  onChange={handleChange}
                  disabled={loading}
                  className={`w-full rounded-lg border bg-white/10 px-4 py-2 text-white placeholder-white/50 focus:outline-none focus:ring-2 disabled:opacity-50 ${
                    errors.lastName
                      ? "border-red-500 focus:ring-red-500/20"
                      : "border-white/20 focus:border-primary-400 focus:ring-primary-400/20"
                  }`}
                  placeholder="Doe"
                />
                {errors.lastName && (
                  <p className="mt-1 text-xs text-red-400">{errors.lastName}</p>
                )}
              </div>
            </div>

            {/* Email */}
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-white mb-2"
              >
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
                className={`w-full rounded-lg border bg-white/10 px-4 py-2 text-white placeholder-white/50 focus:outline-none focus:ring-2 disabled:opacity-50 ${
                  errors.email
                    ? "border-red-500 focus:ring-red-500/20"
                    : "border-white/20 focus:border-primary-400 focus:ring-primary-400/20"
                }`}
                placeholder="you@example.com"
              />
              {errors.email && (
                <p className="mt-1 text-xs text-red-400">{errors.email}</p>
              )}
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-white mb-2"
              >
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
                className={`w-full rounded-lg border bg-white/10 px-4 py-2 text-white placeholder-white/50 focus:outline-none focus:ring-2 disabled:opacity-50 ${
                  errors.password
                    ? "border-red-500 focus:ring-red-500/20"
                    : "border-white/20 focus:border-primary-400 focus:ring-primary-400/20"
                }`}
                placeholder="••••••••"
              />
              {errors.password && (
                <p className="mt-1 text-xs text-red-400">{errors.password}</p>
              )}

              {formData.password && (
                <div className="mt-2 space-y-2">
                  <div className="flex gap-1">
                    {[...Array(5)].map((_, i) => (
                      <div
                        key={i}
                        className={`h-1 flex-1 rounded-full transition-colors ${
                          i < passwordStrength
                            ? passwordStrengthColor
                            : "bg-white/20"
                        }`}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-white/70">
                    Password strength:{" "}
                    <span className="font-semibold">
                      {passwordStrengthText}
                    </span>
                  </p>
                </div>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <label
                htmlFor="confirmPassword"
                className="block text-sm font-medium text-white mb-2"
              >
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                required
                value={formData.confirmPassword}
                onChange={handleChange}
                disabled={loading}
                className={`w-full rounded-lg border bg-white/10 px-4 py-2 text-white placeholder-white/50 focus:outline-none focus:ring-2 disabled:opacity-50 ${
                  errors.confirmPassword
                    ? "border-red-500 focus:ring-red-500/20"
                    : "border-white/20 focus:border-primary-400 focus:ring-primary-400/20"
                }`}
                placeholder="••••••••"
              />
              {errors.confirmPassword && (
                <p className="mt-1 text-xs text-red-400">
                  {errors.confirmPassword}
                </p>
              )}

              {passwordMatchStatus !== null && (
                <div className="mt-2 flex items-center gap-2 text-xs">
                  {passwordMatchStatus ? (
                    <>
                      <CheckCircle className="h-4 w-4 text-green-400" />
                      <span className="text-green-400">Passwords match</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="h-4 w-4 text-red-400" />
                      <span className="text-red-400">
                        Passwords do not match
                      </span>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Terms */}
            <label className="flex items-start gap-2 text-sm text-white/70 cursor-pointer">
              <input
                name="agreeToTerms"
                type="checkbox"
                checked={formData.agreeToTerms}
                onChange={handleChange}
                disabled={loading}
                className="mt-1 cursor-pointer"
              />
              <span>
                I agree to the{" "}
                <Link
                  href="/terms"
                  className="text-primary-300 hover:text-primary-200 underline"
                >
                  Terms of Service
                </Link>{" "}
                and{" "}
                <Link
                  href="/privacy"
                  className="text-primary-300 hover:text-primary-200 underline"
                >
                  Privacy Policy
                </Link>
              </span>
            </label>
            {errors.agreeToTerms && (
              <p className="mt-1 text-xs text-red-400">{errors.agreeToTerms}</p>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-primary-500 px-4 py-2.5 font-semibold text-white hover:bg-primary-600 disabled:bg-primary-500/50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? "Creating account..." : "Create Account"}
            </button>
          </form>

          {/* Login Link */}
          <div className="mt-6 text-center text-sm text-white/70">
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-medium text-primary-300 hover:text-primary-200 underline"
            >
              Login
            </Link>
          </div>
        </div>

        {/* Info Box */}
        <div className="mt-8 rounded-lg border border-white/10 bg-white/5 p-4 text-sm text-white/70">
          <p className="mb-2 font-semibold text-white">🎯 Get Started:</p>
          <ul className="space-y-1 text-xs">
            <li>• Create strategies with AI or manually</li>
            <li>• Backtest on historical data</li>
            <li>• Execute with live trading</li>
            <li>• Monitor from anywhere</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
