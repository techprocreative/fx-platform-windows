import * as crypto from 'crypto';
export class CryptoUtils {
    /**
     * Generate a secure encryption key
     */
    static generateKey() {
        return crypto.randomBytes(this.KEY_LENGTH).toString('hex');
    }
    /**
     * Derive key from password using PBKDF2
     */
    static deriveKey(password, salt) {
        return crypto.pbkdf2Sync(password, salt, 100000, this.KEY_LENGTH, 'sha256').toString('hex');
    }
    /**
     * Generate a random salt
     */
    static generateSalt() {
        return crypto.randomBytes(16).toString('hex');
    }
    /**
     * Encrypt data using AES-256-GCM
     */
    static encrypt(data, key) {
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
        }
        catch (error) {
            return {
                success: false,
                error: error.message,
            };
        }
    }
    /**
     * Decrypt data using AES-256-GCM
     */
    static decrypt(encryptedData, key, iv, tag) {
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
        }
        catch (error) {
            return {
                success: false,
                error: error.message,
            };
        }
    }
    /**
     * Hash data using SHA-256
     */
    static hash(data) {
        return crypto.createHash('sha256').update(data).digest('hex');
    }
    /**
     * Verify data integrity using HMAC
     */
    static hmac(data, key) {
        return crypto.createHmac('sha256', key).update(data).digest('hex');
    }
    /**
     * Verify HMAC
     */
    static verifyHmac(data, key, hmac) {
        const calculatedHmac = this.hmac(data, key);
        return crypto.timingSafeEqual(Buffer.from(calculatedHmac, 'hex'), Buffer.from(hmac, 'hex'));
    }
    /**
     * Generate secure random token
     */
    static generateToken(length = 32) {
        return crypto.randomBytes(length).toString('hex');
    }
    /**
     * Generate UUID v4
     */
    static generateUUID() {
        return crypto.randomUUID();
    }
    /**
     * Hash password with salt
     */
    static hashPassword(password, salt) {
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
    static verifyPassword(password, hash, salt) {
        const { hash: calculatedHash } = this.hashPassword(password, salt);
        return crypto.timingSafeEqual(Buffer.from(calculatedHash, 'hex'), Buffer.from(hash, 'hex'));
    }
    /**
     * Encrypt JSON object
     */
    static encryptJSON(obj, key) {
        try {
            const jsonString = JSON.stringify(obj);
            return this.encrypt(jsonString, key);
        }
        catch (error) {
            return {
                success: false,
                error: error.message,
            };
        }
    }
    /**
     * Decrypt JSON object
     */
    static decryptJSON(encryptedData, key, iv, tag) {
        const result = this.decrypt(encryptedData, key, iv, tag);
        if (result.success && result.data) {
            try {
                const parsedData = JSON.parse(result.data);
                return {
                    success: true,
                    data: parsedData,
                };
            }
            catch (error) {
                return {
                    success: false,
                    error: `Failed to parse decrypted JSON: ${error.message}`,
                };
            }
        }
        return {
            success: result.success,
            error: result.error
        };
    }
    /**
     * Create digital signature
     */
    static sign(data, privateKey) {
        const sign = crypto.createSign('RSA-SHA256');
        sign.update(data);
        return sign.sign(privateKey, 'hex');
    }
    /**
     * Verify digital signature
     */
    static verifySignature(data, signature, publicKey) {
        try {
            const verify = crypto.createVerify('RSA-SHA256');
            verify.update(data);
            return verify.verify(publicKey, signature, 'hex');
        }
        catch (error) {
            return false;
        }
    }
    /**
     * Generate RSA key pair
     */
    static generateRSAKeyPair() {
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
    static constantTimeCompare(a, b) {
        if (a.length !== b.length) {
            return false;
        }
        return crypto.timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'));
    }
    /**
     * Scramble data with XOR (simple obfuscation, not encryption)
     */
    static xorScramble(data, key) {
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
    static xorUnscramble(scrambledData, key) {
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
    static secureRandom(min, max) {
        const range = max - min + 1;
        const bytes = crypto.randomBytes(4);
        const randomInt = bytes.readUInt32BE(0);
        return min + (randomInt % range);
    }
    /**
     * Generate cryptographically secure random string
     */
    static secureRandomString(length, charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789') {
        let result = '';
        const bytes = crypto.randomBytes(length);
        for (let i = 0; i < length; i++) {
            result += charset[bytes[i] % charset.length];
        }
        return result;
    }
}
Object.defineProperty(CryptoUtils, "ALGORITHM", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: 'aes-256-gcm'
});
Object.defineProperty(CryptoUtils, "KEY_LENGTH", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: 32
}); // 256 bits
Object.defineProperty(CryptoUtils, "IV_LENGTH", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: 16
}); // 128 bits
Object.defineProperty(CryptoUtils, "TAG_LENGTH", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: 16
}); // 128 bits
/**
 * Secure storage helper for sensitive data
 */
export class SecureStorage {
    constructor(encryptionKey) {
        Object.defineProperty(this, "encryptionKey", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "salts", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        });
        this.encryptionKey = encryptionKey;
    }
    /**
     * Store sensitive data securely
     */
    set(key, value) {
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
                if (typeof window !== 'undefined' && window.localStorage) {
                    window.localStorage.setItem(`secure_${key}`, JSON.stringify(storageData));
                }
                return true;
            }
            return false;
        }
        catch (error) {
            console.error('Error storing secure data:', error);
            return false;
        }
    }
    /**
     * Retrieve sensitive data securely
     */
    get(key) {
        try {
            if (typeof window === 'undefined' || !window.localStorage)
                return null;
            const storedData = window.localStorage.getItem(`secure_${key}`);
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
        }
        catch (error) {
            console.error('Error retrieving secure data:', error);
            return null;
        }
    }
    /**
     * Remove sensitive data
     */
    remove(key) {
        try {
            if (typeof window !== 'undefined' && window.localStorage) {
                window.localStorage.removeItem(`secure_${key}`);
            }
            this.salts.delete(key);
            return true;
        }
        catch (error) {
            console.error('Error removing secure data:', error);
            return false;
        }
    }
    /**
     * Check if key exists
     */
    has(key) {
        if (typeof window === 'undefined' || !window.localStorage)
            return false;
        return window.localStorage.getItem(`secure_${key}`) !== null;
    }
}
export default CryptoUtils;
