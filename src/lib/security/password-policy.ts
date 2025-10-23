import { z } from "zod";
import { getEnvVar } from "./env-validator";
import { createAuditLogFromRequest, AuditEventType } from "./audit-log";

// Password policy configuration
export interface PasswordPolicy {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSymbols: boolean;
  maxAge: number; // Days
  preventReuse: number; // Number of previous passwords to prevent reuse
  preventCommonPasswords: boolean;
  preventUserInfo: boolean;
}

// Default password policy
export function getDefaultPasswordPolicy(): PasswordPolicy {
  const minLength = parseInt(getEnvVar("MIN_PASSWORD_LENGTH") || "12", 10);
  const requireUppercase =
    (getEnvVar("PASSWORD_REQUIRE_UPPERCASE") || "true") === "true";
  const requireLowercase =
    (getEnvVar("PASSWORD_REQUIRE_LOWERCASE") || "true") === "true";
  const requireNumbers =
    (getEnvVar("PASSWORD_REQUIRE_NUMBERS") || "true") === "true";
  const requireSymbols =
    (getEnvVar("PASSWORD_REQUIRE_SYMBOLS") || "true") === "true";
  const maxAge = parseInt(getEnvVar("PASSWORD_MAX_AGE_DAYS") || "90", 10);

  return {
    minLength,
    requireUppercase,
    requireLowercase,
    requireNumbers,
    requireSymbols,
    maxAge,
    preventReuse: 5, // Prevent reuse of last 5 passwords
    preventCommonPasswords: true,
    preventUserInfo: true,
  };
}

// Password validation schema
export function createPasswordSchema(
  policy: PasswordPolicy = getDefaultPasswordPolicy(),
) {
  let schema = z
    .string()
    .min(
      policy.minLength,
      `Password must be at least ${policy.minLength} characters`,
    );

  if (policy.requireUppercase) {
    schema = schema.regex(
      /[A-Z]/,
      "Password must contain at least one uppercase letter",
    );
  }

  if (policy.requireLowercase) {
    schema = schema.regex(
      /[a-z]/,
      "Password must contain at least one lowercase letter",
    );
  }

  if (policy.requireNumbers) {
    schema = schema.regex(/[0-9]/, "Password must contain at least one number");
  }

  if (policy.requireSymbols) {
    schema = schema.regex(
      /[^A-Za-z0-9]/,
      "Password must contain at least one special character",
    );
  }

  return schema;
}

// Password validation result
export interface PasswordValidationResult {
  isValid: boolean;
  score: number; // 0-5
  strength: "very weak" | "weak" | "fair" | "good" | "strong";
  feedback: string[];
  errors: string[];
}

// Common passwords list (simplified)
const commonPasswords = [
  "password",
  "123456",
  "123456789",
  "qwerty",
  "abc123",
  "password123",
  "admin",
  "letmein",
  "welcome",
  "monkey",
  "1234567890",
  "password1",
  "123123",
  "qwertyuiop",
  "starwars",
  "football",
  "whatever",
  "iloveyou",
];

/**
 * Validate password against policy
 * @param password - Password to validate
 * @param policy - Password policy to use
 * @param userInfo - User information to check against
 * @returns Password validation result
 */
export function validatePassword(
  password: string,
  policy: PasswordPolicy = getDefaultPasswordPolicy(),
  userInfo?: {
    firstName?: string;
    lastName?: string;
    email?: string;
    username?: string;
  },
): PasswordValidationResult {
  const result: PasswordValidationResult = {
    isValid: true,
    score: 0,
    strength: "very weak",
    feedback: [],
    errors: [],
  };

  // Check minimum length
  if (password.length < policy.minLength) {
    result.isValid = false;
    result.errors.push(
      `Password must be at least ${policy.minLength} characters`,
    );
  } else if (password.length >= policy.minLength) {
    result.score += 1;
  }

  // Check character requirements
  if (policy.requireUppercase && !/[A-Z]/.test(password)) {
    result.isValid = false;
    result.errors.push("Password must contain at least one uppercase letter");
  } else if (/[A-Z]/.test(password)) {
    result.score += 1;
  }

  if (policy.requireLowercase && !/[a-z]/.test(password)) {
    result.isValid = false;
    result.errors.push("Password must contain at least one lowercase letter");
  } else if (/[a-z]/.test(password)) {
    result.score += 1;
  }

  if (policy.requireNumbers && !/[0-9]/.test(password)) {
    result.isValid = false;
    result.errors.push("Password must contain at least one number");
  } else if (/[0-9]/.test(password)) {
    result.score += 1;
  }

  if (policy.requireSymbols && !/[^A-Za-z0-9]/.test(password)) {
    result.isValid = false;
    result.errors.push("Password must contain at least one special character");
  } else if (/[^A-Za-z0-9]/.test(password)) {
    result.score += 1;
  }

  // Check for common passwords
  if (
    policy.preventCommonPasswords &&
    commonPasswords.includes(password.toLowerCase())
  ) {
    result.isValid = false;
    result.errors.push(
      "Password is too common. Please choose a more unique password",
    );
  }

  // Check for user information
  if (policy.preventUserInfo && userInfo) {
    const lowerPassword = password.toLowerCase();

    if (
      userInfo.firstName &&
      lowerPassword.includes(userInfo.firstName.toLowerCase())
    ) {
      result.isValid = false;
      result.errors.push("Password cannot contain your first name");
    }

    if (
      userInfo.lastName &&
      lowerPassword.includes(userInfo.lastName.toLowerCase())
    ) {
      result.isValid = false;
      result.errors.push("Password cannot contain your last name");
    }

    if (userInfo.email) {
      const emailParts = userInfo.email.toLowerCase().split("@");
      if (emailParts[0] && lowerPassword.includes(emailParts[0])) {
        result.isValid = false;
        result.errors.push("Password cannot contain your email address");
      }
    }

    if (
      userInfo.username &&
      lowerPassword.includes(userInfo.username.toLowerCase())
    ) {
      result.isValid = false;
      result.errors.push("Password cannot contain your username");
    }
  }

  // Check for repeating characters
  if (/(.)\1{2,}/.test(password)) {
    result.score = Math.max(0, result.score - 1);
    result.feedback.push("Avoid repeating characters");
  }

  // Check for sequential characters
  if (
    /(abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz|012|123|234|345|456|567|678|789)/i.test(
      password,
    )
  ) {
    result.score = Math.max(0, result.score - 1);
    result.feedback.push("Avoid sequential characters");
  }

  // Determine strength
  if (result.score <= 2) {
    result.strength = "weak";
    result.feedback.push("Consider using a stronger password");
  } else if (result.score === 3) {
    result.strength = "fair";
  } else if (result.score === 4) {
    result.strength = "good";
  } else {
    result.strength = "strong";
  }

  // Add additional feedback based on score
  if (password.length < 12) {
    result.feedback.push("Consider using a longer password (12+ characters)");
  }

  return result;
}

/**
 * Generate a random password
 * @param policy - Password policy to follow
 * @returns Generated password
 */
export function generatePassword(
  policy: PasswordPolicy = getDefaultPasswordPolicy(),
): string {
  const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const lowercase = "abcdefghijklmnopqrstuvwxyz";
  const numbers = "0123456789";
  const symbols = "!@#$%^&*()_+-=[]{}|;:,.<>?";

  let charset = lowercase;
  let password = "";

  // Include required character types
  if (policy.requireUppercase) {
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    charset += uppercase;
  }

  if (policy.requireLowercase) {
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    charset += lowercase;
  }

  if (policy.requireNumbers) {
    password += numbers[Math.floor(Math.random() * numbers.length)];
    charset += numbers;
  }

  if (policy.requireSymbols) {
    password += symbols[Math.floor(Math.random() * symbols.length)];
    charset += symbols;
  }

  // Fill remaining length
  const remainingLength = Math.max(policy.minLength, 12) - password.length;
  for (let i = 0; i < remainingLength; i++) {
    password += charset[Math.floor(Math.random() * charset.length)];
  }

  // Shuffle the password
  return password
    .split("")
    .sort(() => Math.random() - 0.5)
    .join("");
}

/**
 * Hash a password
 * @param password - Password to hash
 * @returns Hashed password
 */
export async function hashPassword(password: string): Promise<string> {
  // In a real implementation, you would use bcrypt or argon2
  // For now, we'll use a simple hash for demonstration
  const crypto = require("crypto");
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto
    .pbkdf2Sync(password, salt, 10000, 64, "sha512")
    .toString("hex");
  return `${salt}:${hash}`;
}

/**
 * Verify a password against its hash
 * @param password - Password to verify
 * @param hashedPassword - Hashed password
 * @returns Whether the password is valid
 */
export async function verifyPassword(
  password: string,
  hashedPassword: string,
): Promise<boolean> {
  try {
    const crypto = require("crypto");
    const [salt, hash] = hashedPassword.split(":");
    const verifyHash = crypto
      .pbkdf2Sync(password, salt, 10000, 64, "sha512")
      .toString("hex");
    return hash === verifyHash;
  } catch (error) {
    console.error("Error verifying password:", error);
    return false;
  }
}

/**
 * Check if password needs to be changed
 * @param lastChanged - Date password was last changed
 * @param policy - Password policy
 * @returns Whether password needs to be changed
 */
export function needsPasswordChange(
  lastChanged: Date,
  policy: PasswordPolicy = getDefaultPasswordPolicy(),
): boolean {
  const now = new Date();
  const daysSinceChange = Math.floor(
    (now.getTime() - lastChanged.getTime()) / (1000 * 60 * 60 * 24),
  );
  return daysSinceChange >= policy.maxAge;
}

/**
 * Middleware to validate password in requests
 * @param policy - Password policy to use
 * @param fieldName - Field name containing the password
 * @returns Express middleware function
 */
export function validatePasswordMiddleware(
  policy: PasswordPolicy = getDefaultPasswordPolicy(),
  fieldName: string = "password",
) {
  return async (req: any, res: any, next: any) => {
    try {
      const password = req.body[fieldName];

      if (!password) {
        return res.status(400).json({
          error: "Validation Error",
          message: "Password is required",
        });
      }

      // Get user info for validation
      const userInfo = {
        firstName: req.user?.firstName,
        lastName: req.user?.lastName,
        email: req.user?.email,
        username: req.user?.username,
      };

      // Validate password
      const result = validatePassword(password, policy, userInfo);

      if (!result.isValid) {
        // Log password validation failure
        createAuditLogFromRequest(
          {
            userId: req.user?.id,
            eventType: AuditEventType.PASSWORD_CHANGE,
            resource: "PASSWORD",
            action: "VALIDATION_FAILED",
            result: "REJECTED",
            metadata: {
              errors: result.errors,
              score: result.score,
            },
          },
          req,
        ).catch((error) =>
          console.error("Error logging password validation failure:", error),
        );

        return res.status(400).json({
          error: "Validation Error",
          message: "Password does not meet requirements",
          errors: result.errors,
          strength: result.strength,
          score: result.score,
        });
      }

      // Store validation result in request for later use
      req.passwordValidation = result;

      next();
    } catch (error) {
      console.error("Password validation middleware error:", error);
      res.status(500).json({
        error: "Server Error",
        message: "Password validation failed",
      });
    }
  };
}

/**
 * Check if password has been used before
 * @param userId - User ID
 * @param newPassword - New password to check
 * @param hashedPasswords - Array of previously used hashed passwords
 * @returns Whether the password has been used before
 */
export async function isPasswordReused(
  userId: string,
  newPassword: string,
  hashedPasswords: string[],
): Promise<boolean> {
  try {
    for (const hashedPassword of hashedPasswords) {
      if (await verifyPassword(newPassword, hashedPassword)) {
        return true;
      }
    }
    return false;
  } catch (error) {
    console.error("Error checking password reuse:", error);
    return false;
  }
}

export default {
  getDefaultPasswordPolicy,
  createPasswordSchema,
  validatePassword,
  generatePassword,
  hashPassword,
  verifyPassword,
  needsPasswordChange,
  validatePasswordMiddleware,
  isPasswordReused,
};
