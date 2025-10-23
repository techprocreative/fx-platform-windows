import crypto from "crypto";
import { getEnvVar } from "./env-validator";

// Encryption algorithm
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16; // For AES, this is always 16
const SALT_LENGTH = 32;
const TAG_LENGTH = 16; // GCM authentication tag length

// Key derivation settings
const KEY_DERIVATION_ITERATIONS = 100000;

/**
 * Derive encryption key from password using PBKDF2
 * @param password - The password to derive from
 * @param salt - The salt to use
 * @returns Derived key
 */
function deriveKey(password: string, salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(
    password,
    salt,
    KEY_DERIVATION_ITERATIONS,
    32,
    "sha256",
  );
}

/**
 * Encrypt sensitive data (e.g., API keys)
 * @param text - Plain text to encrypt
 * @param customKey - Optional custom encryption key (defaults to ENCRYPTION_KEY)
 * @returns Encrypted data as a base64 string
 */
export function encrypt(text: string, customKey?: string): string {
  try {
    const encryptionKey = customKey || getEnvVar("ENCRYPTION_KEY");

    // Generate a random salt for each encryption
    const salt = crypto.randomBytes(SALT_LENGTH);

    // Derive key from password and salt
    const key = deriveKey(encryptionKey, salt);

    // Generate a random IV
    const iv = crypto.randomBytes(IV_LENGTH);

    // Create cipher
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    cipher.setAAD(Buffer.from("nexus-trade", "utf8"));

    let encrypted = cipher.update(text, "utf8", "hex");
    encrypted += cipher.final("hex");

    // Get the authentication tag
    const tag = cipher.getAuthTag();

    // Combine salt, iv, tag, and encrypted data
    const combined = Buffer.concat([
      salt,
      iv,
      tag,
      Buffer.from(encrypted, "hex"),
    ]);

    // Return as base64
    return combined.toString("base64");
  } catch (error) {
    console.error("Encryption error:", error);
    throw new Error("Failed to encrypt data");
  }
}

/**
 * Decrypt sensitive data (e.g., API keys)
 * @param encryptedData - Base64 encoded encrypted data
 * @param customKey - Optional custom encryption key (defaults to ENCRYPTION_KEY)
 * @returns Decrypted plain text
 */
export function decrypt(encryptedData: string, customKey?: string): string {
  try {
    const encryptionKey = customKey || getEnvVar("ENCRYPTION_KEY");

    // Decode from base64
    const combined = Buffer.from(encryptedData, "base64");

    // Extract components
    const salt = combined.slice(0, SALT_LENGTH);
    const iv = combined.slice(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
    const tag = combined.slice(
      SALT_LENGTH + IV_LENGTH,
      SALT_LENGTH + IV_LENGTH + TAG_LENGTH,
    );
    const encrypted = combined.slice(SALT_LENGTH + IV_LENGTH + TAG_LENGTH);

    // Derive key from password and salt
    const key = deriveKey(encryptionKey, salt);

    // Create decipher
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAAD(Buffer.from("nexus-trade", "utf8"));
    decipher.setAuthTag(tag);

    const decryptedBuffer = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);

    return decryptedBuffer.toString("utf8");
  } catch (error) {
    console.error("Decryption error:", error);
    throw new Error("Failed to decrypt data");
  }
}

/**
 * Encrypt API keys with a specific key for API keys
 * @param apiKey - API key to encrypt
 * @returns Encrypted API key
 */
export function encryptApiKey(apiKey: string): string {
  try {
    const apiKeyEncryptionKey = getEnvVar("API_KEY_ENCRYPTION_KEY");
    return encrypt(apiKey, apiKeyEncryptionKey);
  } catch (error) {
    console.error("API key encryption error:", error);
    throw new Error("Failed to encrypt API key");
  }
}

/**
 * Decrypt API keys with a specific key for API keys
 * @param encryptedApiKey - Encrypted API key
 * @returns Decrypted API key
 */
export function decryptApiKey(encryptedApiKey: string): string {
  try {
    const apiKeyEncryptionKey = getEnvVar("API_KEY_ENCRYPTION_KEY");
    return decrypt(encryptedApiKey, apiKeyEncryptionKey);
  } catch (error) {
    console.error("API key decryption error:", error);
    throw new Error("Failed to decrypt API key");
  }
}

/**
 * Generate a secure random string
 * @param length - Length of the string to generate
 * @returns Secure random string
 */
export function generateSecureRandom(length: number = 32): string {
  return crypto.randomBytes(length).toString("hex");
}

/**
 * Hash a password using bcrypt (this would require the bcrypt package)
 * For now, we'll use a secure hash with PBKDF2
 * @param password - Password to hash
 * @param salt - Optional salt (will generate if not provided)
 * @returns Hashed password with salt
 */
export function hashPassword(
  password: string,
  salt?: string,
): { hash: string; salt: string } {
  const passwordSalt = salt
    ? Buffer.from(salt, "hex")
    : crypto.randomBytes(SALT_LENGTH);
  const hash = crypto.pbkdf2Sync(
    password,
    passwordSalt,
    KEY_DERIVATION_ITERATIONS,
    64,
    "sha512",
  );

  return {
    hash: hash.toString("hex"),
    salt: passwordSalt.toString("hex"),
  };
}

/**
 * Verify a password against its hash
 * @param password - Password to verify
 * @param hash - Hash to verify against
 * @param salt - Salt used for the hash
 * @returns Whether the password is valid
 */
export function verifyPassword(
  password: string,
  hash: string,
  salt: string,
): boolean {
  try {
    const { hash: computedHash } = hashPassword(password, salt);
    return crypto.timingSafeEqual(
      Buffer.from(hash, "hex"),
      Buffer.from(computedHash, "hex"),
    );
  } catch (error) {
    console.error("Password verification error:", error);
    return false;
  }
}

/**
 * Create a SHA-256 hash of data
 * @param data - Data to hash
 * @returns SHA-256 hash
 */
export function sha256(data: string): string {
  return crypto.createHash("sha256").update(data).digest("hex");
}

/**
 * Create a HMAC-SHA256 signature
 * @param data - Data to sign
 * @param secret - Secret key for signing
 * @returns HMAC-SHA256 signature
 */
export function hmacSha256(data: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(data).digest("hex");
}

/**
 * Generate a key pair for asymmetric encryption
 * @returns RSA key pair
 */
export function generateRSAKeyPair(): {
  publicKey: string;
  privateKey: string;
} {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: "spki",
      format: "pem",
    },
    privateKeyEncoding: {
      type: "pkcs8",
      format: "pem",
    },
  });

  return { publicKey, privateKey };
}

/**
 * Encrypt data with RSA public key
 * @param data - Data to encrypt
 * @param publicKey - RSA public key
 * @returns Encrypted data
 */
export function rsaEncrypt(data: string, publicKey: string): string {
  try {
    const encrypted = crypto.publicEncrypt(
      {
        key: publicKey,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: "sha256",
      },
      Buffer.from(data, "utf8"),
    );

    return encrypted.toString("base64");
  } catch (error) {
    console.error("RSA encryption error:", error);
    throw new Error("Failed to encrypt data with RSA");
  }
}

/**
 * Decrypt data with RSA private key
 * @param encryptedData - Base64 encoded encrypted data
 * @param privateKey - RSA private key
 * @returns Decrypted data
 */
export function rsaDecrypt(encryptedData: string, privateKey: string): string {
  try {
    const decrypted = crypto.privateDecrypt(
      {
        key: privateKey,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: "sha256",
      },
      Buffer.from(encryptedData, "base64"),
    );

    return decrypted.toString("utf8");
  } catch (error) {
    console.error("RSA decryption error:", error);
    throw new Error("Failed to decrypt data with RSA");
  }
}

export default {
  encrypt,
  decrypt,
  encryptApiKey,
  decryptApiKey,
  generateSecureRandom,
  hashPassword,
  verifyPassword,
  sha256,
  hmacSha256,
  generateRSAKeyPair,
  rsaEncrypt,
  rsaDecrypt,
};
