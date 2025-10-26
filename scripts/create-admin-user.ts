import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function createAdminUser() {
  try {
    console.log('🔐 Creating admin user...\n');

    // Check if admin exists
    const existing = await prisma.user.findFirst({
      where: {
        email: 'admin@nusanexus.com',
      },
    });

    if (existing) {
      console.log('✅ Admin user already exists');
      console.log(`   Email: ${existing.email}`);
      console.log(`   ID: ${existing.id}`);
      return existing;
    }

    // Hash password
    const passwordHash = await bcrypt.hash('admin123', 10);

    // Create admin user
    const admin = await prisma.user.create({
      data: {
        email: 'admin@nusanexus.com',
        passwordHash,
        firstName: 'Admin',
        lastName: 'NusaNexus',
        emailVerified: new Date(),
      },
    });

    console.log('✅ Admin user created successfully!');
    console.log(`   Email: ${admin.email}`);
    console.log(`   Password: admin123`);
    console.log(`   ID: ${admin.id}`);
    console.log('\n⚠️  Please change the password after first login!');

    return admin;
  } catch (error) {
    console.error('❌ Error creating admin user:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

createAdminUser()
  .then(() => {
    console.log('\n🎉 Success!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Failed:', error);
    process.exit(1);
  });
