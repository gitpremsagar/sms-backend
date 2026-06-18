import "dotenv/config";
import bcrypt from "bcrypt";
import { PrismaClient, Role } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL ?? "admin@sagarmiddleschool.edu.in";
  const password = process.env.ADMIN_PASSWORD ?? "Admin@123";
  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      name: "System Administrator",
      password: hashedPassword,
      role: Role.ADMIN,
    },
    create: {
      name: "System Administrator",
      email,
      password: hashedPassword,
      role: Role.ADMIN,
      adminDetail: {
        create: {
          designation: "Principal",
        },
      },
    },
    include: { adminDetail: true },
  });

  if (!user.adminDetail) {
    await prisma.adminDetail.upsert({
      where: { userId: user.id },
      update: { designation: "Principal" },
      create: {
        userId: user.id,
        designation: "Principal",
      },
    });
  }

  console.log(`Seeded admin user: ${email}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
