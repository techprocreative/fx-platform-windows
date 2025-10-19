import { PrismaClient } from '@prisma/client';
import { getEnvVar } from './env-validator';

const prisma = new PrismaClient();

// IP address validation regex patterns
const IPV4_REGEX = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
const IPV6_REGEX = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
const CIDR_REGEX = /^([0-9]{1,3}\.){3}[0-9]{1,3}\/([0-9]|[1-2][0-9]|3[0-2])$/;

/**
 * Validate an IP address format
 * @param ip - IP address to validate
 * @returns Whether the IP address is valid
 */
export function isValidIPAddress(ip: string): boolean {
  return IPV4_REGEX.test(ip) || IPV6_REGEX.test(ip) || CIDR_REGEX.test(ip);
}

/**
 * Check if an IP address is in a CIDR range
 * @param ip - IP address to check
 * @param cidr - CIDR range
 * @returns Whether the IP is in the range
 */
export function isIPInCIDR(ip: string, cidr: string): boolean {
  try {
    const [network, prefixLength] = cidr.split('/');
    const prefix = parseInt(prefixLength, 10);
    
    // Convert IP addresses to 32-bit integers
    const ipInt = ipToInt(ip);
    const networkInt = ipToInt(network);
    
    // Create subnet mask
    const mask = (0xffffffff << (32 - prefix)) >>> 0;
    
    // Apply mask and check if they match
    return (ipInt & mask) === (networkInt & mask);
  } catch (error) {
    console.error('Error checking CIDR range:', error);
    return false;
  }
}

/**
 * Convert IPv4 address to 32-bit integer
 * @param ip - IPv4 address
 * @returns 32-bit integer representation
 */
function ipToInt(ip: string): number {
  const parts = ip.split('.');
  return parts.reduce((acc, part, index) => {
    return acc + (parseInt(part, 10) << (8 * (3 - index)));
  }, 0);
}

/**
 * Get all whitelisted IPs for a user
 * @param userId - User ID
 * @returns Array of whitelisted IPs
 */
export async function getWhitelistedIPs(userId: string): Promise<string[]> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { apiKeys: true },
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Collect all whitelisted IPs from user and API keys
    const whitelistedIPs = new Set<string>();
    
    // Add user-level IP whitelist
    const globalWhitelist = process.env.IP_WHITELIST;
    if (globalWhitelist && typeof globalWhitelist === 'string') {
      globalWhitelist.split(',').forEach((ip: string) => whitelistedIPs.add(ip.trim()));
    }
    
    // Add API key specific IP whitelists
    user.apiKeys.forEach(apiKey => {
      apiKey.ipWhitelist.forEach(ip => whitelistedIPs.add(ip));
    });

    return Array.from(whitelistedIPs).filter(ip => isValidIPAddress(ip));
  } catch (error) {
    console.error('Error getting whitelisted IPs:', error);
    return [];
  }
}

/**
 * Add an IP to a user's whitelist
 * @param userId - User ID
 * @param ip - IP address or CIDR range to add
 * @returns Whether the operation was successful
 */
export async function addIPToWhitelist(userId: string, ip: string): Promise<boolean> {
  try {
    if (!isValidIPAddress(ip)) {
      throw new Error('Invalid IP address format');
    }

    // Add to a dedicated IP whitelist table
    await prisma.$executeRaw`
      INSERT INTO "IPWhitelist" ("userId", "ipAddress", "createdAt")
      VALUES (${userId}, ${ip}, NOW())
      ON CONFLICT ("userId", "ipAddress") DO NOTHING
    `;

    return true;
  } catch (error) {
    console.error('Error adding IP to whitelist:', error);
    return false;
  }
}

/**
 * Remove an IP from a user's whitelist
 * @param userId - User ID
 * @param ip - IP address or CIDR range to remove
 * @returns Whether the operation was successful
 */
export async function removeIPFromWhitelist(userId: string, ip: string): Promise<boolean> {
  try {
    await prisma.$executeRaw`
      DELETE FROM "IPWhitelist" 
      WHERE "userId" = ${userId} AND "ipAddress" = ${ip}
    `;

    return true;
  } catch (error) {
    console.error('Error removing IP from whitelist:', error);
    return false;
  }
}

/**
 * Check if an IP address is whitelisted for a user
 * @param userId - User ID
 * @param ip - IP address to check
 * @returns Whether the IP is whitelisted
 */
export async function isIPWhitelisted(userId: string, ip: string): Promise<boolean> {
  try {
    const whitelistedIPs = await getWhitelistedIPs(userId);
    
    // If no whitelist is configured, allow all IPs
    if (whitelistedIPs.length === 0) {
      return true;
    }

    // Check if the IP matches any whitelisted IP or CIDR range
    return whitelistedIPs.some(whitelistedIP => {
      if (whitelistedIP.includes('/')) {
        // CIDR range
        return isIPInCIDR(ip, whitelistedIP);
      } else {
        // Exact match
        return ip === whitelistedIP;
      }
    });
  } catch (error) {
    console.error('Error checking IP whitelist:', error);
    // Fail secure - deny if we can't check
    return false;
  }
}

/**
 * Get the client's IP address from a request
 * @param req - HTTP request object
 * @returns Client IP address
 */
export function getClientIP(req: any): string {
  try {
    // Check various headers for the real IP address
    const forwarded = req.headers['x-forwarded-for'];
    const realIP = req.headers['x-real-ip'];
    const clientIP = req.connection?.remoteAddress || req.socket?.remoteAddress;
    
    if (forwarded) {
      // X-Forwarded-For can contain multiple IPs, take the first one
      return forwarded.split(',')[0].trim();
    } else if (realIP) {
      return realIP;
    } else if (clientIP) {
      // Remove IPv6 prefix if present
      return clientIP.replace(/^::ffff:/, '');
    } else {
      return 'unknown';
    }
  } catch (error) {
    console.error('Error getting client IP:', error);
    return 'unknown';
  }
}

/**
 * Check if a request is from a whitelisted IP
 * @param req - HTTP request object
 * @param userId - User ID
 * @returns Whether the request is from a whitelisted IP
 */
export async function isRequestFromWhitelistedIP(req: any, userId: string): Promise<boolean> {
  const clientIP = getClientIP(req);
  
  if (clientIP === 'unknown') {
    // Fail secure - deny if we can't determine the IP
    return false;
  }
  
  return isIPWhitelisted(userId, clientIP);
}

/**
 * Log IP whitelist violations
 * @param userId - User ID
 * @param ip - IP address that was blocked
 * @param userAgent - User agent of the request
 * @param endpoint - API endpoint that was accessed
 */
export async function logIPWhitelistViolation(
  userId: string,
  ip: string,
  userAgent?: string,
  endpoint?: string
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        eventType: 'SECURITY_VIOLATION',
        resource: 'IP_WHITELIST',
        action: 'ACCESS_DENIED',
        result: 'BLOCKED',
        metadata: {
          ip,
          userAgent,
          endpoint,
          violationType: 'IP_NOT_WHITELISTED',
        },
        ipAddress: ip,
        userAgent,
      },
    });
  } catch (error) {
    console.error('Error logging IP whitelist violation:', error);
  }
}

/**
 * Create an IP whitelist entry in the database
 * @param userId - User ID
 * @param ip - IP address or CIDR range
 * @param description - Optional description
 * @returns Created IP whitelist entry
 */
export async function createIPWhitelistEntry(
  userId: string,
  ip: string,
  description?: string
): Promise<any> {
  try {
    if (!isValidIPAddress(ip)) {
      throw new Error('Invalid IP address format');
    }

    // Since IPWhitelist model doesn't exist in the schema yet, we'll use APIKey model
    // This is a temporary solution until we update the schema
    const existingAPIKey = await prisma.aPIKey.findFirst({
      where: { userId },
    });

    if (existingAPIKey) {
      const updatedIPWhitelist = [...existingAPIKey.ipWhitelist, ip];
      await prisma.aPIKey.update({
        where: { id: existingAPIKey.id },
        data: { ipWhitelist: updatedIPWhitelist },
      });
    }

    return { id: ip, userId, ipAddress: ip, description };
  } catch (error) {
    console.error('Error creating IP whitelist entry:', error);
    throw error;
  }
}

/**
 * Get all IP whitelist entries for a user
 * @param userId - User ID
 * @returns Array of IP whitelist entries
 */
export async function getIPWhitelistEntries(userId: string): Promise<any[]> {
  try {
    // Since IPWhitelist model doesn't exist in the schema yet, we'll use APIKey model
    // This is a temporary solution until we update the schema
    const apiKeys = await prisma.aPIKey.findMany({
      where: { userId },
    });

    const entries: any[] = [];
    apiKeys.forEach(apiKey => {
      apiKey.ipWhitelist.forEach(ip => {
        entries.push({
          id: ip,
          userId,
          ipAddress: ip,
          description: `From API Key: ${apiKey.name}`,
          createdAt: apiKey.createdAt,
        });
      });
    });

    return entries;
  } catch (error) {
    console.error('Error getting IP whitelist entries:', error);
    return [];
  }
}

/**
 * Delete an IP whitelist entry
 * @param userId - User ID
 * @param ip - IP address or CIDR range to remove
 * @returns Whether the operation was successful
 */
export async function deleteIPWhitelistEntry(userId: string, ip: string): Promise<boolean> {
  try {
    // Since IPWhitelist model doesn't exist in the schema yet, we'll use APIKey model
    // This is a temporary solution until we update the schema
    const apiKeys = await prisma.aPIKey.findMany({
      where: { userId },
    });

    for (const apiKey of apiKeys) {
      if (apiKey.ipWhitelist.includes(ip)) {
        const updatedIPWhitelist = apiKey.ipWhitelist.filter(whitelistedIP => whitelistedIP !== ip);
        await prisma.aPIKey.update({
          where: { id: apiKey.id },
          data: { ipWhitelist: updatedIPWhitelist },
        });
      }
    }

    return true;
  } catch (error) {
    console.error('Error deleting IP whitelist entry:', error);
    return false;
  }
}

export default {
  isValidIPAddress,
  isIPInCIDR,
  getWhitelistedIPs,
  addIPToWhitelist,
  removeIPFromWhitelist,
  isIPWhitelisted,
  getClientIP,
  isRequestFromWhitelistedIP,
  logIPWhitelistViolation,
  createIPWhitelistEntry,
  getIPWhitelistEntries,
  deleteIPWhitelistEntry,
};