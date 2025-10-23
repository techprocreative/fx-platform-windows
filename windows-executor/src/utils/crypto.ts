import * as crypto from 'crypto';
import { EncryptionResult, DecryptionResult } from '../types/security.types';

export class CryptoUtils {
  private static readonly ALGORITHM = 'aes-256-gcm';
  private static readonly KEY_LENGTH = 32; // 256 bits
  private static readonly IV_LENGTH = 16; // 128 bits
  private static readonly TAG_LENGTH = 16; // 128 bits

  /**
   * Generate a secure encryption key
   */
  static generateKey(): string {
    return crypto.randomBytes(this.KEY_LENGTH).toString('hex');
  }

  /**
   * Derive key from password using PBKDF2
   */
  static deriveKey(password: string, salt: string): string {
    return crypto.pbkdf2Sync(password, salt, 100000, this.KEY_LENGTH, 'sha256').toString('hex');
  }

  /**
   * Generate a random salt
   */
  static generateSalt(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  /**
   * Encrypt data using AES-256-GCM
   */
  static encrypt(data: string, key: string): EncryptionResult {
    try {
      // Convert hex key to buffer
      const keyBuffer = Buffer.from(key, 'hex');
      
      // Generate random IV
      const iv = crypto.randomBytes(this.IV_LENGTH);
      
      // Create cipher
      const cipher = crypto.createCipher(this.ALGORITHM, keyBuffer);
      cipher.setAAD(Buffer.from('fx-executor', 'utf8'));
      
      // Encrypt data
      let encrypted = cipher.update(data, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      // Get authentication tag
      const tag = cipher.getAuthTag();
      
      return {
        success: true,
        data: encrypted,
        iv: iv.toString('hex'),
        tag: tag.toString('hex'),
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }

  /**
   * Decrypt data using AES-256-GCM
   */
  static decrypt(encryptedData: string, key: string, iv: string, tag: string): DecryptionResult {
    try {
      // Convert hex values to buffers
      const keyBuffer = Buffer.from(key, 'hex');
      const ivBuffer = Buffer.from(iv, 'hex');
      const tagBuffer = Buffer.from(tag, 'hex');
      
      // Create decipher
      const decipher = crypto.createDecipher(this.ALGORITHM, keyBuffer);
      decipher.setAAD(Buffer.from('fx-executor', 'utf8'));
      decipher.setAuthTag(tagBuffer);
      
      // Decrypt data
      let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return {
        success: true,
        data: decrypted,
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }

  /**
   * Hash data using SHA-256
   */
  static hash(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Verify data integrity using HMAC
   */
  static hmac(data: string, key: string): string {
    return crypto.createHmac('sha256', key).update(data).digest('hex');
  }

  /**
   * Verify HMAC
   */
  static verifyHmac(data: string, key: string, hmac: string): boolean {
    const calculatedHmac = this.hmac(data, key);
    return crypto.timingSafeEqual(Buffer.from(calculatedHmac, 'hex'), Buffer.from(hmac, 'hex'));
  }

  /**
   * Generate secure random token
   */
  static generateToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Generate UUID v4
   */
  static generateUUID(): string {
    return crypto.randomUUID();
  }

  /**
   * Hash password with salt
   */
  static hashPassword(password: string, salt?: string): { hash: string; salt: string } {
    const passwordSalt = salt || this.generateSalt();
    const hash = crypto.pbkdf2Sync(password, passwordSalt, 100000, 64, 'sha512').toString('hex');
    
    return {
      hash,
      salt: passwordSalt,
    };
  }

  /**
   * Verify password against hash
   */
  static verifyPassword(password: string, hash: string, salt: string): boolean {
    const { hash: calculatedHash } = this.hashPassword(password, salt);
    return crypto.timingSafeEqual(Buffer.from(calculatedHash, 'hex'), Buffer.from(hash, 'hex'));
  }

  /**
   * Encrypt JSON object
   */
  static encryptJSON(obj: any, key: string): EncryptionResult {
    try {
      const jsonString = JSON.stringify(obj);
      return this.encrypt(jsonString, key);
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }

  /**
   * Decrypt JSON object
   */
  static decryptJSON<T = any>(encryptedData: string, key: string, iv: string, tag: string): DecryptionResult & { data?: T } {
    const result = this.decrypt(encryptedData, key, iv, tag);
    
    if (result.success && result.data) {
      try {
        const parsedData = JSON.parse(result.data);
        return {
          success: true,
          data: parsedData,
        };
      } catch (error) {
        return {
          success: false,
          error: `Failed to parse decrypted JSON: ${(error as Error).message}`,
        };
      }
    }
    
    return result;
  }

  /**
   * Create digital signature
   */
  static sign(data: string, privateKey: string): string {
    const sign = crypto.createSign('RSA-SHA256');
    sign.update(data);
    return sign.sign(privateKey, 'hex');
  }

  /**
   * Verify digital signature
   */
  static verifySignature(data: string, signature: string, publicKey: string): boolean {
    try {
      const verify = crypto.createVerify('RSA-SHA256');
      verify.update(data);
      return verify.verify(publicKey, signature, 'hex');
    } catch (error) {
      return false;
    }
  }

  /**
   * Generate RSA key pair
   */
  static generateRSAKeyPair(): { publicKey: string; privateKey: string } {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem',
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem',
      },
    });

    return { publicKey, privateKey };
  }

  /**
   * Constant-time comparison to prevent timing attacks
   */
  static constantTimeCompare(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }

    return crypto.timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'));
  }

  /**
   * Scramble data with XOR (simple obfuscation, not encryption)
   */
  static xorScramble(data: string, key: string): string {
    const keyBuffer = Buffer.from(key, 'utf8');
    const dataBuffer = Buffer.from(data, 'utf8');
    const result = Buffer.alloc(dataBuffer.length);
    
    for (let i = 0; i < dataBuffer.length; i++) {
      result[i] = dataBuffer[i] ^ keyBuffer[i % keyBuffer.length];
    }
    
    return result.toString('hex');
  }

  /**
   * Unscramble XOR data
   */
  static xorUnscramble(scrambledData: string, key: string): string {
    const keyBuffer = Buffer.from(key, 'utf8');
    const dataBuffer = Buffer.from(scrambledData, 'hex');
    const result = Buffer.alloc(dataBuffer.length);
    
    for (let i = 0; i < dataBuffer.length; i++) {
      result[i] = dataBuffer[i] ^ keyBuffer[i % keyBuffer.length];
    }
    
    return result.toString('utf8');
  }

  /**
   * Secure random number generator
   */
  static secureRandom(min: number, max: number): number {
    const range = max - min + 1;
    const bytes = crypto.randomBytes(4);
    const randomInt = bytes.readUInt32BE(0);
    return min + (randomInt % range);
  }

  /**
   * Generate cryptographically secure random string
   */
  static secureRandomString(length: number, charset: string = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'): string {
    let result = '';
    const bytes = crypto.randomBytes(length);
    
    for (let i = 0; i < length; i++) {
      result += charset[bytes[i] % charset.length];
    }
    
    return result;
  }
}

/**
 * Secure storage helper for sensitive data
 */
export class SecureStorage {
  private encryptionKey: string;
  private salts: Map<string, string> = new Map();

  constructor(encryptionKey: string) {
    this.encryptionKey = encryptionKey;
  }

  /**
   * Store sensitive data securely
   */
  set(key: string, value: string): boolean {
    try {
      const salt = CryptoUtils.generateSalt();
      const dataKey = CryptoUtils.deriveKey(this.encryptionKey, salt);
      const encrypted = CryptoUtils.encrypt(value, dataKey);
      
      if (encrypted.success && encrypted.data && encrypted.iv && encrypted.tag) {
        // Store salt for decryption
        this.salts.set(key, salt);
        
        // Store encrypted data (in a real implementation, this would be in a secure database)
        const storageData = {
          data: encrypted.data,
          iv: encrypted.iv,
          tag: encrypted.tag,
          salt: salt,
        };
        
        // In a real implementation, store this securely
        localStorage.setItem(`secure_${key}`, JSON.stringify(storageData));
        
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error storing secure data:', error);
      return false;
    }
  }

  /**
   * Retrieve sensitive data securely
   */
  get(key: string): string | null {
    try {
      const storedData = localStorage.getItem(`secure_${key}`);
      if (!storedData) {
        return null;
      }

      const { data, iv, tag, salt } = JSON.parse(storedData);
      const dataKey = CryptoUtils.deriveKey(this.encryptionKey, salt);
      const decrypted = CryptoUtils.decrypt(data, dataKey, iv, tag);
      
      if (decrypted.success && decrypted.data) {
        return decrypted.data;
      }
      
      return null;
    } catch (error) {
      console.error('Error retrieving secure data:', error);
      return null;
    }
  }

  /**
   * Remove sensitive data
   */
  remove(key: string): boolean {
    try {
      localStorage.removeItem(`secure_${key}`);
      this.salts.delete(key);
      return true;
    } catch (error) {
      console.error('Error removing secure data:', error);
      return false;
    }
  }

  /**
   * Check if key exists
   */
  has(key: string): boolean {
    return localStorage.getItem(`secure_${key}`) !== null;
  }
}

export default CryptoUtils;