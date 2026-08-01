import { PrismaClient } from "@prisma/client";
import { promoteToAdmin } from "../lib/admin/promote.ts";

const email = process.argv[2];
if (!email) {
  console.error("Cách dùng: npm run make-admin -- <email>");
  process.exit(1);
}

const prisma = new PrismaClient();

promoteToAdmin(email, {
  findByEmail: (e) => prisma.user.findUnique({ where: { email: e }, select: { id: true, role: true } }),
  setRole: async (id) => {
    await prisma.user.update({ where: { id }, data: { role: "ADMIN" } });
  },
})
  .then((r) => {
    if (!r.ok) {
      console.error("Lỗi:", r.error);
      process.exitCode = 1;
    } else {
      console.log(r.alreadyAdmin ? `${email} đã là ADMIN.` : `Đã cấp quyền ADMIN cho ${email}.`);
    }
  })
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
