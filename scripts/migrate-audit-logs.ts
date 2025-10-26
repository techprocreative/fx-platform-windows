import { config } from 'dotenv';
import { PrismaClient } from '@prisma/client';

// Load environment variables
config();

const prisma = new PrismaClient();

async function migrateAuditLogs() {
  console.log('🔄 Migrating existing AuditLog records...');
  
  try {
    // Update existing records with NULL action to use eventType as fallback
    const result = await prisma.$executeRaw`
      UPDATE "AuditLog" 
      SET "action" = COALESCE("eventType", 'LEGACY_EVENT')
      WHERE "action" IS NULL;
    `;
    
    console.log(`✅ Updated ${result} audit log records`);
    
    // Verify no NULL actions remain
    const nullCount = await prisma.auditLog.count({
      where: {
        action: null,
      },
    });
    
    if (nullCount > 0) {
      console.error(`❌ Still have ${nullCount} records with NULL action`);
      process.exit(1);
    }
    
    console.log('✅ All audit logs migrated successfully');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

migrateAuditLogs();
