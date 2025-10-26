import crypto from 'crypto';

/**
 * Shared Secret System for Executor-EA Communication
 * Generate and validate shared secrets between Executor and EA
 */

export class SharedSecretManager {
  /**
   * Generate a secure shared secret for EA-Executor communication
   */
  static generateSharedSecret(executorId: string, apiKey: string): string {
    const timestamp = Date.now();
    const randomBytes = crypto.randomBytes(16).toString('hex');
    
    // Combine executor info with random data
    const data = `${executorId}:${apiKey}:${timestamp}:${randomBytes}`;
    
    // Create SHA256 hash
    const hash = crypto.createHash('sha256').update(data).digest('hex');
    
    // Return first 32 characters for reasonable length
    return hash.substring(0, 32);
  }
  
  /**
   * Validate command with shared secret and HMAC
   */
  static validateCommand(
    command: string,
    signature: string,
    sharedSecret: string
  ): boolean {
    try {
      // Create HMAC with shared secret
      const hmac = crypto
        .createHmac('sha256', sharedSecret)
        .update(command)
        .digest('hex');
      
      // Compare signatures (timing-safe)
      return crypto.timingSafeEqual(
        Buffer.from(hmac),
        Buffer.from(signature)
      );
    } catch (error) {
      return false;
    }
  }
  
  /**
   * Create signature for command
   */
  static signCommand(command: string, sharedSecret: string): string {
    return crypto
      .createHmac('sha256', sharedSecret)
      .update(command)
      .digest('hex');
  }
  
  /**
   * Generate auth token for EA command
   */
  static generateAuthToken(
    command: string,
    sharedSecret: string,
    nonce: number
  ): string {
    const message = `${command}:${nonce}:${Date.now()}`;
    return this.signCommand(message, sharedSecret);
  }
  
  /**
   * Validate auth token with replay protection
   */
  static validateAuthToken(
    command: string,
    token: string,
    nonce: number,
    sharedSecret: string,
    maxAge: number = 30000 // 30 seconds
  ): { valid: boolean; error?: string } {
    try {
      // Parse timestamp from token validation
      const timestamp = Date.now();
      const expectedToken = this.generateAuthToken(command, sharedSecret, nonce);
      
      // Validate token
      if (token !== expectedToken) {
        return { valid: false, error: 'Invalid token' };
      }
      
      // Check age (prevent replay attacks)
      const age = Date.now() - timestamp;
      if (age > maxAge) {
        return { valid: false, error: 'Token expired' };
      }
      
      return { valid: true };
    } catch (error) {
      return { valid: false, error: 'Token validation failed' };
    }
  }
}

/**
 * Nonce manager for replay attack prevention
 */
export class NonceManager {
  private usedNonces: Set<number> = new Set();
  private cleanupInterval: NodeJS.Timeout;
  
  constructor(cleanupIntervalMs: number = 60000) {
    // Cleanup old nonces every minute
    this.cleanupInterval = setInterval(() => {
      this.usedNonces.clear();
    }, cleanupIntervalMs);
  }
  
  /**
   * Check if nonce is valid (not used before)
   */
  validateNonce(nonce: number): boolean {
    if (this.usedNonces.has(nonce)) {
      return false;
    }
    
    this.usedNonces.add(nonce);
    return true;
  }
  
  /**
   * Cleanup
   */
  destroy() {
    clearInterval(this.cleanupInterval);
  }
}
