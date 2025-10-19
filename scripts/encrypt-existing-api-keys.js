/**
 * Script to encrypt existing API keys in the database
 * Run this script after applying the encrypt_api_keys.sql migration
 */

const { PrismaClient } = require('@prisma/client');
const { encryptApiKey, decryptApiKey } = require('../src/lib/security/encryption');
const { validateEnv } = require('../src/lib/security/env-validator');

// Validate environment variables
validateEnv();

const prisma = new PrismaClient();

async function encryptExistingApiKeys() {
  console.log('🔐 Starting encryption of existing API keys...');
  
  try {
    // Encrypt Executor API keys
    console.log('📋 Encrypting Executor API keys...');
    const executors = await prisma.executor.findMany({
      where: {
        OR: [
          { apiKey: { not: null } },
          { apiSecretHash: { not: null } },
          { apiKeyEncrypted: null },
          { apiSecretEncrypted: null },
        ],
      },
    });

    console.log(`Found ${executors.length} executors to encrypt`);

    for (const executor of executors) {
      try {
        const updateData = {
          encryptionVersion: 1,
          encryptionAlgorithm: 'aes-256-gcm',
        };

        // Encrypt API key if it exists and is not already encrypted
        if (executor.apiKey && !executor.apiKeyEncrypted) {
          console.log(`Encrypting API key for executor: ${executor.name}`);
          updateData.apiKeyEncrypted = encryptApiKey(executor.apiKey);
          updateData.apiKey = null; // Clear plain text
        }

        // Encrypt API secret if it exists and is not already encrypted
        if (executor.apiSecretHash && !executor.apiSecretEncrypted) {
          console.log(`Encrypting API secret for executor: ${executor.name}`);
          updateData.apiSecretEncrypted = encryptApiKey(executor.apiSecretHash);
          updateData.apiSecretHash = null; // Clear plain text
        }

        // Update the executor with encrypted data
        await prisma.executor.update({
          where: { id: executor.id },
          data: updateData,
        });

        console.log(`✅ Successfully encrypted data for executor: ${executor.name}`);
      } catch (error) {
        console.error(`❌ Failed to encrypt data for executor: ${executor.name}`, error);
      }
    }

    // Encrypt APIKey secrets
    console.log('🔑 Encrypting APIKey secrets...');
    const apiKeys = await prisma.aPIKey.findMany({
      where: {
        OR: [
          { secretHash: { not: null } },
          { secretEncrypted: null },
        ],
      },
    });

    console.log(`Found ${apiKeys.length} API keys to encrypt`);

    for (const apiKey of apiKeys) {
      try {
        const updateData = {
          encryptionVersion: 1,
          encryptionAlgorithm: 'aes-256-gcm',
        };

        // Encrypt API secret if it exists and is not already encrypted
        if (apiKey.secretHash && !apiKey.secretEncrypted) {
          console.log(`Encrypting API secret for key: ${apiKey.name}`);
          updateData.secretEncrypted = encryptApiKey(apiKey.secretHash);
          updateData.secretHash = null; // Clear plain text
        }

        // Update the API key with encrypted data
        await prisma.aPIKey.update({
          where: { id: apiKey.id },
          data: updateData,
        });

        console.log(`✅ Successfully encrypted data for API key: ${apiKey.name}`);
      } catch (error) {
        console.error(`❌ Failed to encrypt data for API key: ${apiKey.name}`, error);
      }
    }

    console.log('🎉 Encryption process completed successfully!');
  } catch (error) {
    console.error('❌ Encryption process failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

async function verifyEncryption() {
  console.log('🔍 Verifying encryption of API keys...');
  
  try {
    // Verify Executor API keys
    const executors = await prisma.executor.findMany({
      where: {
        OR: [
          { apiKeyEncrypted: { not: null } },
          { apiSecretEncrypted: { not: null } },
        ],
      },
    });

    console.log(`Found ${executors.length} executors with encrypted data`);

    for (const executor of executors) {
      try {
        if (executor.apiKeyEncrypted) {
          const decrypted = decryptApiKey(executor.apiKeyEncrypted);
          console.log(`✅ Successfully decrypted API key for executor: ${executor.name}`);
        }

        if (executor.apiSecretEncrypted) {
          const decrypted = decryptApiKey(executor.apiSecretEncrypted);
          console.log(`✅ Successfully decrypted API secret for executor: ${executor.name}`);
        }
      } catch (error) {
        console.error(`❌ Failed to decrypt data for executor: ${executor.name}`, error);
      }
    }

    // Verify APIKey secrets
    const apiKeys = await prisma.aPIKey.findMany({
      where: {
        secretEncrypted: { not: null },
      },
    });

    console.log(`Found ${apiKeys.length} API keys with encrypted data`);

    for (const apiKey of apiKeys) {
      try {
        if (apiKey.secretEncrypted) {
          const decrypted = decryptApiKey(apiKey.secretEncrypted);
          console.log(`✅ Successfully decrypted API secret for key: ${apiKey.name}`);
        }
      } catch (error) {
        console.error(`❌ Failed to decrypt data for API key: ${apiKey.name}`, error);
      }
    }

    console.log('🎉 Verification process completed successfully!');
  } catch (error) {
    console.error('❌ Verification process failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Main execution
async function main() {
  const command = process.argv[2];
  
  switch (command) {
    case 'encrypt':
      await encryptExistingApiKeys();
      break;
    case 'verify':
      await verifyEncryption();
      break;
    default:
      console.log('Usage: node encrypt-existing-api-keys.js [encrypt|verify]');
      console.log('  encrypt - Encrypt existing API keys in the database');
      console.log('  verify  - Verify that encrypted API keys can be decrypted');
      process.exit(1);
  }
}

// Run the script
main().catch((error) => {
  console.error('Script execution failed:', error);
  process.exit(1);
});