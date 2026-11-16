/**
 * Seeder SUPERADMIN.
 * - Idempoten: kalau username sudah ada, TIDAK mengubah password/role.
 * - SEED_SUPERADMIN_PASSWORD kosong → generate acak dan cetak SEKALI.
 */
import { config } from "../src/lib/config.js";
import { prisma } from "../src/lib/prisma.js";
import { generateTempPassword, hashPassword } from "../src/services/authService.js";

const configuredUsername =
  config.SEED_SUPERADMIN_USERNAME ?? config.SEED_SUPERADMIN_EMAIL?.split("@")[0];
const username = configuredUsername?.trim().toLowerCase();

if (!username) {
  console.log("[seed] SEED_SUPERADMIN_USERNAME kosong — dilewati.");
} else {
  const existing = await prisma.user.findUnique({
    where: { username },
    select: { id: true, role: true },
  });

  if (existing) {
    console.log(`[seed] ${username} sudah ada (role ${existing.role}) — tidak diubah.`);
  } else {
    const configured = config.SEED_SUPERADMIN_PASSWORD?.trim();
    const password = configured || generateTempPassword();
    const passwordHash = await hashPassword(password);

    const user = await prisma.user.create({
      data: { nama: "Superadmin", username, passwordHash, role: "SUPERADMIN" },
      select: { id: true, username: true },
    });

    console.log(`[seed] SUPERADMIN dibuat: ${user.username}`);
    if (!configured) {
      console.log(`[seed] Password generated (catat SEKALI, tidak akan ditampilkan lagi): ${password}`);
    }
  }
}

await prisma.$disconnect();
