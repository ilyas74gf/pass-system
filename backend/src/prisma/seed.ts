import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function main() {
  const adminEmail = 'admin@test.com';
  const hashedPassword = await bcrypt.hash('123456', 10);

  // upsert: Kullanıcı varsa rolünü ve şifresini Admin yapar, yoksa sıfırdan oluşturur
  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      role: 'ADMIN',
      password: hashedPassword,
      isActive: true,
      isBlocked: false,
    },
    create: {
      name: 'Sistem Yöneticisi',
      email: adminEmail,
      password: hashedPassword,
      role: 'ADMIN',
      isActive: true,
      isBlocked: false,
    },
  });

  console.log('✅ Admin Kullanıcısı Başarıyla Güncellendi/Oluşturuldu:');
  console.log('   E-Posta:', admin.email);
  console.log('   Şifre: 1234567');
  console.log('   Rol:', admin.role);
}

main()
  .catch((e) => {
    console.error('❌ Seed Hatası:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });