import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  await prisma.role.createMany({
    data: [
      { name: 'admin', description: 'Administrator role' },
      { name: 'moderator', description: 'Moderator role' },
      { name: 'user', description: 'Regular user role' },
    ],
    skipDuplicates: true,
  });

  const hashedPassword = await bcrypt.hash('Password123!', 10);

  const users = [
    {
      username: 'admin',
      email: 'admin@tms.dev',
      password: hashedPassword,
      firstName: 'Admin',
      lastName: 'User',
      role: 'admin',
    },
    {
      username: 'testuser',
      email: 'test@tms.dev',
      password: hashedPassword,
      firstName: 'Test',
      lastName: 'User',
      role: 'user',
    },
    {
      username: 'yaser-az',
      email: 'yaser@tms.dev',
      password: hashedPassword,
      firstName: 'Yaser',
      lastName: 'Alazm',
      role: 'admin',
    },
  ];

  for (const userData of users) {
    await prisma.user.upsert({
      where: { username: userData.username },
      update: {
        email: userData.email,
        firstName: userData.firstName,
        lastName: userData.lastName,
      },
      create: {
        username: userData.username,
        email: userData.email,
        password: userData.password,
        firstName: userData.firstName,
        lastName: userData.lastName,
        roles: {
          connect: [{ name: userData.role }],
        },
      },
    });
  }

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
