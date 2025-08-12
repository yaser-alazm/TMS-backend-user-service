import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  // Create roles
  await prisma.role.createMany({
    data: [
      { name: 'admin', description: 'Administrator role' },
      { name: 'moderator', description: 'Moderator role' },
      { name: 'user', description: 'Regular user role' },
    ],
    skipDuplicates: true,
  });

  // Create test users
  const hashedPassword = await bcrypt.hash('Password123!', 10);

  await prisma.user.create({
    data: {
      username: 'admin',
      email: 'admin@tms.dev',
      password: hashedPassword,
      firstName: 'Admin',
      lastName: 'User',
      roles: {
        connect: [{ name: 'admin' }],
      },
    },
  });

  await prisma.user.create({
    data: {
      username: 'testuser',
      email: 'test@tms.dev',
      password: hashedPassword,
      firstName: 'Test',
      lastName: 'User',
      roles: {
        connect: [{ name: 'user' }],
      },
    },
  });

  await prisma.user.create({
    data: {
      username: 'yaser-az',
      email: 'yaser@tms.dev',
      password: hashedPassword,
      firstName: 'Yaser',
      lastName: 'Alazm',
      roles: {
        connect: [{ name: 'admin' }],
      },
    },
  });

  console.log('Database seeded successfully');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => {
    prisma
      .$disconnect()
      .then(() => {
        console.log('Prisma client disconnected');
      })
      .catch((e) => {
        console.error('Error disconnecting Prisma client:', e);
      });
  });
