/**
 * Seeder SUPERADMIN.
 * - Idempoten: kalau email sudah ada, TIDAK mengubah password/role.
 * - SEED_SUPERADMIN_PASSWORD kosong → generate acak dan cetak SEKALI.
 */
import { config } from "../src/lib/config.js";
import { prisma } from "../src/lib/prisma.js";
import { generateTempPassword, hashPassword } from "../src/services/authService.js";

const email = config.SEED_SUPERADMIN_EMAIL?.trim().toLowerCase();

if (!email) {
  console.log("[seed] SEED_SUPERADMIN_EMAIL kosong — dilewati.");
} else {
  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true, role: true },
  });

  if (existing) {
    console.log(`[seed] ${email} sudah ada (role ${existing.role}) — tidak diubah.`);
  } else {
    const configured = config.SEED_SUPERADMIN_PASSWORD?.trim();
    const password = configured || generateTempPassword();
    const passwordHash = await hashPassword(password);

    const user = await prisma.user.create({
      data: { nama: "Superadmin", email, passwordHash, role: "SUPERADMIN" },
      select: { id: true, email: true },
    });

    console.log(`[seed] SUPERADMIN dibuat: ${user.email}`);
    if (!configured) {
      console.log(`[seed] Password generated (catat SEKALI, tidak akan ditampilkan lagi): ${password}`);
    }
  }
}

await prisma.$disconnect();
