import { fakerVI as faker } from "@faker-js/faker";
import prisma from "../lib/db/prisma";
import { hashPassword } from "../lib/auth/password";
import { JOB_CATEGORIES } from "../lib/jobs/job-categories";
import { EMPLOYMENT_TYPES, EXPERIENCE_LEVELS } from "../lib/jobs/job-fields";

const SEED_DOMAIN = "seed.example"; // marker idempotent
const LOCATIONS = ["Hà Nội", "TP. Hồ Chí Minh", "Đà Nẵng", "Hải Phòng", "Cần Thơ", "Bình Dương", "Remote"];
const SKILLS_BY_CAT: Record<string, string[]> = {
  it: ["React", "Node.js", "TypeScript", "Python", "Java", "Docker", "AWS", "SQL", "Go", "Kubernetes"],
  "marketing-sales": ["SEO", "Google Ads", "Facebook Ads", "Content", "CRM", "B2B Sales", "Copywriting"],
  finance: ["Excel", "SAP", "IFRS", "Kiểm toán", "Thuế", "Phân tích tài chính"],
  design: ["Figma", "Photoshop", "Illustrator", "UI/UX", "Motion", "Branding"],
  hr: ["Tuyển dụng", "C&B", "Đào tạo", "HRIS", "Quan hệ lao động"],
  operations: ["Logistics", "Supply Chain", "Vận hành", "Quản lý kho", "Lean"],
  other: ["Giao tiếp", "Quản lý dự án", "Tiếng Anh", "Chăm sóc khách hàng"],
};
const TITLE_BY_CAT: Record<string, string[]> = {
  it: ["Lập trình viên {s}", "Kỹ sư {s}", "Chuyên viên {s}", "Fullstack Developer", "DevOps Engineer"],
  "marketing-sales": ["Chuyên viên Marketing", "Nhân viên Kinh doanh", "Digital Marketing", "Sales Executive"],
  finance: ["Kế toán tổng hợp", "Chuyên viên Tài chính", "Kiểm toán viên", "Kế toán thuế"],
  design: ["UI/UX Designer", "Graphic Designer", "Product Designer", "Motion Designer"],
  hr: ["Chuyên viên Tuyển dụng", "HR Generalist", "Chuyên viên C&B", "HR Manager"],
  operations: ["Nhân viên Vận hành", "Quản lý Kho", "Chuyên viên Logistics", "Operations Manager"],
  other: ["Chăm sóc khách hàng", "Trợ lý dự án", "Nhân viên văn phòng"],
};

function pick<T>(arr: readonly T[]): T { return arr[faker.number.int({ min: 0, max: arr.length - 1 })]; }

async function main() {
  // 1) Xoá dữ liệu seed cũ theo marker (cascade sẽ dọn job/company/cv liên quan).
  const del = await prisma.user.deleteMany({ where: { email: { endsWith: `@${SEED_DOMAIN}` } } });
  console.log(`Đã xoá ${del.count} user seed cũ.`);

  const passwordHash = await hashPassword("seedpass1");

  // 2) Recruiter + công ty
  const recruiters: { id: string }[] = [];
  for (let i = 0; i < 60; i++) {
    const companyName = faker.company.name();
    const user = await prisma.user.create({
      data: {
        email: `recruiter${i}@${SEED_DOMAIN}`,
        name: faker.person.fullName(),
        passwordHash,
        role: "RECRUITER",
        companyProfile: {
          create: {
            name: companyName,
            description: faker.company.catchPhrase(),
            website: faker.internet.url(),
            location: pick(LOCATIONS),
          },
        },
      },
      select: { id: true },
    });
    recruiters.push(user);
  }
  console.log(`Đã tạo ${recruiters.length} recruiter + công ty.`);

  // 3) ~1000 job
  const MILLION = 1_000_000;
  let jobCount = 0;
  for (let i = 0; i < 1000; i++) {
    const cat = pick(JOB_CATEGORIES);
    const skills = faker.helpers.arrayElements(SKILLS_BY_CAT[cat.slug], { min: 3, max: 6 });
    const title = pick(TITLE_BY_CAT[cat.slug]).replace("{s}", skills[0]);
    const owner = pick(recruiters);
    const min = faker.number.int({ min: 8, max: 40 }) * MILLION;
    const max = min + faker.number.int({ min: 3, max: 20 }) * MILLION;
    await prisma.jobDescription.create({
      data: {
        userId: owner.id,
        title,
        company: faker.company.name(),
        rawText: `${title}. ${faker.lorem.paragraphs(2)} Yêu cầu: ${skills.join(", ")}.`,
        location: pick(LOCATIONS),
        employmentType: pick(EMPLOYMENT_TYPES),
        experienceLevel: pick(EXPERIENCE_LEVELS),
        skills: skills.join(", "),
        category: cat.slug,
        salaryMin: min,
        salaryMax: max,
        salaryNegotiable: faker.datatype.boolean(),
        isPublic: true,
      },
    });
    jobCount++;
  }
  console.log(`Đã tạo ${jobCount} tin tuyển dụng.`);

  // 4) ~30 candidate
  for (let i = 0; i < 30; i++) {
    await prisma.user.create({
      data: {
        email: `candidate${i}@${SEED_DOMAIN}`,
        name: faker.person.fullName(),
        passwordHash,
        role: "CANDIDATE",
      },
    });
  }
  console.log("Đã tạo 30 candidate.");
}

main()
  .then(() => { console.log("Seed xong."); return prisma.$disconnect(); })
  .catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
