import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

import { put } from "@vercel/blob";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.error("Error: BLOB_READ_WRITE_TOKEN is not set. Check .env.local.");
    process.exit(1);
  }

  const companies = await prisma.companyProfile.findMany({
    where: { logoData: { not: null } },
    select: { id: true, logoData: true, logoMime: true, logoUrl: true },
  });

  console.log(`Found ${companies.length} companies with logoData to migrate.`);
  if (companies.length === 0) { console.log("Nothing to do."); return; }

  let migrated = 0;
  let skipped = 0;
  let failed = 0;

  for (const company of companies) {
    if (company.logoUrl?.includes("vercel-storage.com")) {
      console.log(`  SKIP  ${company.id} (already migrated)`);
      skipped++;
      continue;
    }
    if (!company.logoData || !company.logoMime) {
      console.log(`  SKIP  ${company.id} (missing data/mime)`);
      skipped++;
      continue;
    }
    try {
      const buffer = Buffer.from(company.logoData);
      const blob = await put(`logos/${company.id}`, buffer, {
        access: "public",
        contentType: company.logoMime,
      });
      await prisma.companyProfile.update({
        where: { id: company.id },
        data: { logoUrl: blob.url, logoData: null, logoMime: null },
      });
      console.log(`  OK    ${company.id} → ${blob.url}`);
      migrated++;
    } catch (err) {
      console.error(`  FAIL  ${company.id}:`, err);
      failed++;
    }
  }

  console.log(`\nDone. migrated=${migrated} skipped=${skipped} failed=${failed}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
