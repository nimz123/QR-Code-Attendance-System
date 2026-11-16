import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: "postgresql://attendance_db_qrsystem_user:FDIfou3fFAiLpUhrYrjI90g8vkGmyqaw@dpg-dbas7mss728c739frua0-a.oregon-postgres.render.com/attendance_db_qrsystem?sslmode=require",
    },
  },
});

async function run() {
  const hashedPassword = await bcrypt.hash('changeme123', 10);
  
  // Gigamit namo ang 'Teacher' model kay mao nay naa sa imong schema.prisma para sa admin/teachers
  const admin = await prisma.teacher.upsert({
    where: { username: 'admin' },
    update: { passwordHash: hashedPassword },
    create: {
      name: 'System Administrator',
      username: 'admin',
      passwordHash: hashedPassword,
      subject: 'Administration',
    },
  });
  
  console.log('✅ Admin (Teacher model) account ready:', admin.username);
}

run()
  .catch((e) => console.error('❌ Error:', e))
  .finally(async () => await prisma.$disconnect());