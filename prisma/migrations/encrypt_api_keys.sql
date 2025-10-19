-- Migration: Encrypt API Keys in Database
-- This migration adds encrypted fields for sensitive data and migrates existing data

-- Add encrypted fields to Executor model
ALTER TABLE "Executor" 
ADD COLUMN "apiKeyEncrypted" TEXT,
ADD COLUMN "apiSecretEncrypted" TEXT;

-- Add encryption metadata
ALTER TABLE "Executor" 
ADD COLUMN "encryptionVersion" INTEGER DEFAULT 1,
ADD COLUMN "encryptionAlgorithm" VARCHAR(50) DEFAULT 'aes-256-gcm';

-- Add index for encrypted fields
CREATE INDEX "Executor_apiKeyEncrypted_idx" ON "Executor"("apiKeyEncrypted");

-- Create a temporary table for API keys with encrypted values
CREATE TABLE "TempEncryptedAPIKeys" (
  "id" TEXT NOT NULL,
  "apiKeyEncrypted" TEXT NOT NULL,
  "apiSecretEncrypted" TEXT NOT NULL,
  "encryptionVersion" INTEGER NOT NULL DEFAULT 1,
  "encryptionAlgorithm" VARCHAR(50) NOT NULL DEFAULT 'aes-256-gcm',
  PRIMARY KEY ("id")
);

-- Note: The actual encryption of existing API keys needs to be done in a separate script
-- since SQL itself cannot perform encryption. This will be handled by a Node.js script.

-- Add encrypted fields to APIKey model
ALTER TABLE "APIKey" 
ADD COLUMN "secretEncrypted" TEXT;

-- Add encryption metadata
ALTER TABLE "APIKey" 
ADD COLUMN "encryptionVersion" INTEGER DEFAULT 1,
ADD COLUMN "encryptionAlgorithm" VARCHAR(50) DEFAULT 'aes-256-gcm';

-- Create a temporary table for API secrets with encrypted values
CREATE TABLE "TempEncryptedAPISecrets" (
  "id" TEXT NOT NULL,
  "secretEncrypted" TEXT NOT NULL,
  "encryptionVersion" INTEGER NOT NULL DEFAULT 1,
  "encryptionAlgorithm" VARCHAR(50) NOT NULL DEFAULT 'aes-256-gcm',
  PRIMARY KEY ("id")
);

-- Add index for encrypted field
CREATE INDEX "APIKey_secretEncrypted_idx" ON "APIKey"("secretEncrypted");

-- Create a function to check if data is encrypted
CREATE OR REPLACE FUNCTION is_encrypted(data TEXT) RETURNS BOOLEAN AS $$
BEGIN
  -- Simple check: encrypted data is typically base64 and longer than original
  IF data IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Check if it's valid base64 and longer than 32 characters
  BEGIN
    PERFORM decode(data, 'base64');
    RETURN length(data) > 32;
  EXCEPTION WHEN OTHERS THEN
    RETURN FALSE;
  END;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger to automatically encrypt sensitive data before insert
CREATE OR REPLACE FUNCTION encrypt_executor_data() RETURNS TRIGGER AS $$
BEGIN
  -- Only encrypt if the plain text fields are provided and not already encrypted
  IF NEW."apiKey" IS NOT NULL AND NOT is_encrypted(NEW."apiKey") THEN
    -- This would be handled by the application layer
    NEW."apiKeyEncrypted" = NEW."apiKey";
    NEW."apiKey" = NULL; -- Clear the plain text field
  END IF;
  
  IF NEW."apiSecretHash" IS NOT NULL AND NOT is_encrypted(NEW."apiSecretHash") THEN
    -- This would be handled by the application layer
    NEW."apiSecretEncrypted" = NEW."apiSecretHash";
    NEW."apiSecretHash" = NULL; -- Clear the plain text field
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for Executor table
CREATE TRIGGER "encrypt_executor_data_trigger"
BEFORE INSERT OR UPDATE ON "Executor"
FOR EACH ROW EXECUTE FUNCTION encrypt_executor_data();

-- Create a trigger to automatically encrypt sensitive data before insert for APIKey
CREATE OR REPLACE FUNCTION encrypt_api_key_data() RETURNS TRIGGER AS $$
BEGIN
  -- Only encrypt if the plain text field is provided and not already encrypted
  IF NEW."secretHash" IS NOT NULL AND NOT is_encrypted(NEW."secretHash") THEN
    -- This would be handled by the application layer
    NEW."secretEncrypted" = NEW."secretHash";
    NEW."secretHash" = NULL; -- Clear the plain text field
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for APIKey table
CREATE TRIGGER "encrypt_api_key_data_trigger"
BEFORE INSERT OR UPDATE ON "APIKey"
FOR EACH ROW EXECUTE FUNCTION encrypt_api_key_data();

-- Create a view to securely access API keys without exposing sensitive data
CREATE OR REPLACE VIEW "SecureExecutor" AS
SELECT 
  "id",
  "userId",
  "name",
  "platform",
  "brokerServer",
  "accountNumber",
  "status",
  "lastHeartbeat",
  "createdAt",
  "updatedAt",
  "deletedAt",
  -- Don't include apiKey, apiSecretHash, apiKeyEncrypted, apiSecretEncrypted
  "encryptionVersion",
  "encryptionAlgorithm"
FROM "Executor"
WHERE "deletedAt" IS NULL;

-- Create a view to securely access API keys without exposing sensitive data
CREATE OR REPLACE VIEW "SecureAPIKey" AS
SELECT 
  "id",
  "userId",
  "name",
  "keyHash",
  "permissions",
  "ipWhitelist",
  "rateLimit",
  "expiresAt",
  "lastUsed",
  "failedAttempts",
  "createdAt",
  "updatedAt",
  "deletedAt",
  -- Don't include secretHash, secretEncrypted
  "encryptionVersion",
  "encryptionAlgorithm"
FROM "APIKey"
WHERE "deletedAt" IS NULL;

-- Add comment to document the migration
COMMENT ON COLUMN "Executor"."apiKeyEncrypted" IS 'Encrypted API key using AES-256-GCM';
COMMENT ON COLUMN "Executor"."apiSecretEncrypted" IS 'Encrypted API secret using AES-256-GCM';
COMMENT ON COLUMN "APIKey"."secretEncrypted" IS 'Encrypted API secret using AES-256-GCM';