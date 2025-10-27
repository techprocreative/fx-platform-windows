/**
 * Script to set a user as admin
 * Usage: npm run set-admin -- user@example.com
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function setAdminUser(email: string) {
  try {
    console.log(`Looking for user with email: ${email}`);
    
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      console.error(`❌ User not found: ${email}`);
      process.exit(1);
    }

    console.log(`Found user: ${user.email} (ID: ${user.id})`);
    console.log(`Current role: ${user.role || 'user'}`);

    if (user.role === 'admin') {
      console.log(`✅ User is already an admin`);
      process.exit(0);
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { role: 'admin' },
    });

    console.log(`✅ Successfully set ${updated.email} as admin`);
    console.log(`New role: ${updated.role}`);
  } catch (error) {
    console.error('Error setting admin user:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Get email from command line arguments
const email = process.argv[2];

if (!email) {
  console.error('Usage: npm run set-admin -- user@example.com');
  process.exit(1);
}

setAdminUser(email);
