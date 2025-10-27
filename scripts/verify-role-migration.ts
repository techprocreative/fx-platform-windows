/**
 * Verify role migration was successful
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verifyMigration() {
  try {
    console.log('🔍 Verifying role migration...\n');
    
    // Check if role column exists by querying users
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        role: true,
      },
      take: 5,
    });

    console.log('✅ Role column exists and is queryable!');
    console.log(`📊 Found ${users.length} users\n`);

    if (users.length > 0) {
      console.log('Sample users:');
      users.forEach((user, index) => {
        console.log(`${index + 1}. ${user.email}`);
        console.log(`   Role: ${user.role || 'user (default)'}`);
        console.log(`   ID: ${user.id}\n`);
      });
    }

    // Count users by role
    const userCount = await prisma.user.count({
      where: { role: 'user' }
    });
    
    const adminCount = await prisma.user.count({
      where: { role: 'admin' }
    });

    console.log('📈 User Statistics:');
    console.log(`   Regular users: ${userCount}`);
    console.log(`   Admin users: ${adminCount}`);
    console.log(`   Total users: ${userCount + adminCount}\n`);

    if (adminCount === 0) {
      console.log('⚠️  No admin users found!');
      console.log('💡 To set an admin user, run:');
      console.log('   npx ts-node scripts/set-admin-user.ts user@example.com\n');
    } else {
      const admins = await prisma.user.findMany({
        where: { role: 'admin' },
        select: { email: true }
      });
      console.log('👑 Admin users:');
      admins.forEach(admin => console.log(`   - ${admin.email}`));
    }

    console.log('\n✅ Migration verification complete!');
  } catch (error) {
    console.error('❌ Migration verification failed:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

verifyMigration();
