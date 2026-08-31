import { fakerVI as faker } from "@faker-js/faker";
import prisma from "../lib/db/prisma";
import { hashPassword } from "../lib/auth/password";
import { JOB_CATEGORIES } from "../lib/jobs/job-categories";
import { EMPLOYMENT_TYPES, EXPERIENCE_LEVELS } from "../lib/jobs/job-fields";

const SEED_DOMAIN = "seed.example"; // marker idempotent
const LOCATIONS = ["Hà Nội", "TP. Hồ Chí Minh", "Đà Nẵng", "Hải Phòng", "Cần Thơ", "Bình Dương", "Remote"];

const SKILLS_BY_CAT: Record<string, string[]> = {
  it: ["React", "Node.js", "TypeScript", "Python", "Java", "Docker", "AWS", "SQL", "Go", "Kubernetes"],
  "marketing-sales": ["SEO", "Google Ads", "Facebook Ads", "Content Marketing", "CRM", "B2B Sales", "Copywriting"],
  finance: ["Excel", "SAP", "IFRS", "Kiểm toán", "Thuế TNDN", "Phân tích tài chính"],
  design: ["Figma", "Photoshop", "Illustrator", "UI/UX", "Motion Design", "Branding"],
  hr: ["Tuyển dụng", "C&B", "Đào tạo & Phát triển", "HRIS", "Quan hệ lao động"],
  operations: ["Logistics", "Supply Chain", "Quản lý vận hành", "Quản lý kho", "Lean/6-Sigma"],
  other: ["Giao tiếp", "Quản lý dự án", "Tiếng Anh", "Chăm sóc khách hàng"],
};

const TITLE_BY_CAT: Record<string, string[]> = {
  it: ["Lập trình viên {s}", "Kỹ sư phần mềm {s}", "Senior Developer {s}", "Fullstack Developer", "DevOps Engineer", "Backend Engineer {s}", "Frontend Developer {s}"],
  "marketing-sales": ["Chuyên viên Marketing", "Nhân viên Kinh doanh", "Digital Marketing Executive", "Sales Executive", "Growth Marketing Manager", "Content Creator"],
  finance: ["Kế toán tổng hợp", "Chuyên viên Tài chính", "Kiểm toán viên nội bộ", "Kế toán thuế", "Trưởng phòng Tài chính"],
  design: ["UI/UX Designer", "Graphic Designer", "Product Designer", "Motion Designer", "Creative Director"],
  hr: ["Chuyên viên Tuyển dụng", "HR Generalist", "Chuyên viên C&B", "HR Business Partner", "Trưởng phòng Nhân sự"],
  operations: ["Nhân viên Vận hành", "Quản lý Kho", "Chuyên viên Logistics", "Operations Manager", "Supply Chain Analyst"],
  other: ["Chuyên viên Chăm sóc khách hàng", "Trợ lý dự án", "Nhân viên văn phòng", "Thư ký điều hành"],
};

const COMPANY_PREFIXES = [
  "Công ty TNHH", "Công ty Cổ phần", "Công ty CP", "Tập đoàn", "Công ty TNHH MTV",
];
const COMPANY_NAMES = [
  "Công nghệ Việt Nam", "Giải pháp số FPT", "Phát triển Phần mềm Tiến Thịnh", "Thương mại Hoàng Gia",
  "Công nghệ Mekong", "Tư vấn Đầu tư Nam Á", "Dịch vụ Tài chính Vietel", "Truyền thông Sáng tạo VTC",
  "Thương mại Điện tử Shopee Việt Nam", "Logistics Giao Hàng Nhanh", "Tài chính MoMo", "Bán lẻ VinCommerce",
  "Giáo dục Topica", "Y tế Vinmec", "Xây dựng Hòa Bình", "Bất động sản Novaland",
  "Thực phẩm Masan", "Năng lượng PetroVietnam", "Viễn thông Viettel", "Ngân hàng TMCP Techcombank",
  "Bảo hiểm Bảo Việt", "Du lịch Vietravel", "Hàng không VietJet", "Dệt may Việt Tiến",
  "Dược phẩm DHG Pharma", "Thủy sản Minh Phú", "Nông nghiệp TH True Milk", "Ô tô Trường Hải THACO",
];

const COMPANY_DESCRIPTIONS: Record<string, string[]> = {
  it: [
    "Chúng tôi là công ty công nghệ hàng đầu Việt Nam, chuyên cung cấp giải pháp phần mềm và chuyển đổi số cho doanh nghiệp.",
    "Công ty phát triển sản phẩm SaaS phục vụ thị trường Đông Nam Á, với hơn 500 khách hàng doanh nghiệp.",
    "Startup công nghệ được đầu tư Series B, xây dựng nền tảng fintech phục vụ hàng triệu người dùng.",
    "Chúng tôi cung cấp dịch vụ điện toán đám mây và tư vấn chuyển đổi số cho các tập đoàn lớn tại Việt Nam.",
  ],
  "marketing-sales": [
    "Công ty thương mại điện tử tăng trưởng nhanh, tập trung vào thị trường B2C và B2B tại Việt Nam.",
    "Agency marketing kỹ thuật số với hơn 200 nhãn hàng lớn trong danh mục khách hàng.",
    "Tập đoàn bán lẻ đa kênh, vận hành hơn 300 cửa hàng trên toàn quốc và nền tảng online.",
  ],
  finance: [
    "Công ty tư vấn tài chính và kiểm toán độc lập, đối tác của các tổ chức quốc tế Big4.",
    "Ngân hàng thương mại cổ phần hàng đầu, cung cấp đa dạng sản phẩm tài chính cho doanh nghiệp và cá nhân.",
    "Công ty fintech đang cách mạng hóa dịch vụ thanh toán và cho vay tại Việt Nam.",
  ],
  design: [
    "Studio thiết kế sáng tạo, hợp tác với các thương hiệu lớn trong và ngoài nước.",
    "Công ty sản phẩm công nghệ, đặt trải nghiệm người dùng làm trọng tâm phát triển.",
    "Agency branding và truyền thông tích hợp với 10 năm kinh nghiệm trên thị trường.",
  ],
  hr: [
    "Công ty nhân sự và headhunting hàng đầu, kết nối ứng viên tài năng với doanh nghiệp hàng đầu.",
    "Tập đoàn đa ngành với hơn 5.000 nhân viên, đầu tư mạnh vào phát triển con người.",
    "Công ty dịch vụ outsourcing nhân sự, phục vụ hơn 100 doanh nghiệp trên toàn quốc.",
  ],
  operations: [
    "Công ty logistics hàng đầu Việt Nam, vận hành mạng lưới kho bãi và giao nhận toàn quốc.",
    "Tập đoàn sản xuất và phân phối, đang mở rộng chuỗi cung ứng ra khu vực ASEAN.",
    "Công ty thương mại quốc tế, chuyên xuất nhập khẩu hàng hóa và quản lý chuỗi cung ứng.",
  ],
  other: [
    "Công ty dịch vụ khách hàng đa kênh, cung cấp giải pháp BPO cho các doanh nghiệp lớn.",
    "Tập đoàn đa ngành với văn hóa làm việc chuyên nghiệp và môi trường phát triển tốt.",
    "Công ty khởi nghiệp giai đoạn tăng trưởng, tìm kiếm nhân tài để cùng phát triển.",
  ],
};

const DESC_TEMPLATES: Record<string, string[]> = {
  it: [
    `Chúng tôi đang tìm kiếm {title} tài năng để gia nhập đội ngũ kỹ thuật năng động.

**Mô tả công việc:**
- Tham gia phát triển và duy trì các tính năng mới cho hệ thống của công ty
- Phối hợp với team Product và Designer để hiện thực hóa yêu cầu nghiệp vụ
- Viết code sạch, có unit test và tài liệu kỹ thuật đầy đủ
- Tham gia code review, đóng góp cải thiện quy trình phát triển phần mềm
- Nghiên cứu và đề xuất các công nghệ mới phù hợp với dự án

**Yêu cầu:**
- Tối thiểu {exp} kinh nghiệm làm việc với {skills}
- Hiểu biết vững về cấu trúc dữ liệu, giải thuật và thiết kế hệ thống
- Có khả năng làm việc độc lập và trong môi trường Agile/Scrum
- Tiếng Anh đọc hiểu tài liệu kỹ thuật

**Quyền lợi:**
- Lương cạnh tranh, review 2 lần/năm
- Thưởng hiệu suất hàng quý, thưởng Tết
- Bảo hiểm sức khỏe cao cấp
- Laptop MacBook/ThinkPad do công ty cấp
- Môi trường làm việc linh hoạt, remote-friendly`,

    `{title} sẽ chịu trách nhiệm xây dựng và vận hành các hệ thống quy mô lớn phục vụ hàng triệu người dùng.

**Trách nhiệm chính:**
- Thiết kế và triển khai kiến trúc hệ thống có khả năng mở rộng cao
- Tối ưu hóa hiệu suất ứng dụng và cơ sở dữ liệu
- Đảm bảo tính bảo mật và ổn định của hệ thống
- Mentor các thành viên junior trong team
- Tham gia lên kế hoạch sprint và ước lượng effort

**Yêu cầu:**
- Thành thạo {skills}
- {exp} kinh nghiệm phát triển phần mềm thực tế
- Kinh nghiệm với hệ thống microservices và cloud (AWS/GCP/Azure)
- Kỹ năng phân tích và giải quyết vấn đề tốt

**Ưu tiên:**
- Đã có kinh nghiệm tại các công ty product hoặc startup công nghệ
- Có đóng góp vào dự án open source
- Chứng chỉ kỹ thuật liên quan`,
  ],
  "marketing-sales": [
    `Chúng tôi tìm kiếm {title} để thúc đẩy tăng trưởng doanh thu và xây dựng thương hiệu.

**Mô tả công việc:**
- Lên kế hoạch và triển khai chiến dịch marketing đa kênh (online và offline)
- Phân tích dữ liệu thị trường, đề xuất chiến lược phù hợp
- Quản lý ngân sách marketing và tối ưu chi phí thu hút khách hàng
- Phối hợp với team Sales để đảm bảo chất lượng lead
- Theo dõi và báo cáo KPI hàng tuần/tháng

**Yêu cầu:**
- Thành thạo {skills}
- {exp} kinh nghiệm trong lĩnh vực marketing/kinh doanh
- Kỹ năng phân tích số liệu, sử dụng thành thạo Google Analytics, Facebook Business
- Tư duy sáng tạo, chủ động trong công việc

**Quyền lợi:**
- Thu nhập = Lương cứng + Hoa hồng + Thưởng KPI
- Đào tạo kỹ năng chuyên môn liên tục
- Môi trường trẻ, năng động, cơ hội thăng tiến nhanh`,
  ],
  finance: [
    `{title} chịu trách nhiệm quản lý và báo cáo tình hình tài chính của công ty.

**Mô tả công việc:**
- Hạch toán, kiểm soát và đối chiếu các nghiệp vụ kế toán hàng ngày
- Lập báo cáo tài chính định kỳ (tháng/quý/năm) theo chuẩn mực kế toán Việt Nam
- Phối hợp với cơ quan thuế, kiểm toán độc lập
- Kiểm soát công nợ phải thu/phải trả, dòng tiền
- Tham gia xây dựng ngân sách và phân tích biến động chi phí

**Yêu cầu:**
- Tốt nghiệp Đại học chuyên ngành Kế toán, Tài chính hoặc liên quan
- {exp} kinh nghiệm làm việc trong lĩnh vực tài chính - kế toán
- Thành thạo {skills} và phần mềm kế toán (MISA, Fast, SAP)
- Có chứng chỉ CPA/ACCA là lợi thế

**Quyền lợi:**
- Mức lương hấp dẫn, thưởng theo hiệu quả công việc
- Bảo hiểm đầy đủ theo quy định
- Cơ hội thi lấy chứng chỉ nghề nghiệp được công ty hỗ trợ`,
  ],
  design: [
    `Chúng tôi tìm kiếm {title} sáng tạo để thiết kế trải nghiệm người dùng xuất sắc.

**Mô tả công việc:**
- Thiết kế UI/UX cho các sản phẩm web và mobile
- Xây dựng và duy trì design system nhất quán
- Nghiên cứu người dùng (user research), tạo wireframe và prototype
- Phối hợp chặt chẽ với Product Manager và Developer
- Thực hiện A/B testing, cải tiến liên tục dựa trên dữ liệu

**Yêu cầu:**
- Thành thạo {skills} và các công cụ thiết kế hiện đại
- {exp} kinh nghiệm thiết kế sản phẩm kỹ thuật số
- Portfolio thể hiện tư duy thiết kế rõ ràng và sáng tạo
- Hiểu biết về nguyên tắc UX và accessibility

**Quyền lợi:**
- Môi trường sáng tạo, được đầu tư công cụ thiết kế tốt nhất
- Thời gian làm việc linh hoạt
- Ngân sách học tập hàng năm`,
  ],
  hr: [
    `{title} sẽ đóng vai trò quan trọng trong việc xây dựng đội ngũ nhân sự chất lượng cao.

**Mô tả công việc:**
- Triển khai toàn bộ quy trình tuyển dụng: đăng tin, sàng lọc, phỏng vấn, offer
- Xây dựng mối quan hệ với các trường đại học và cộng đồng nhân sự
- Quản lý hồ sơ ứng viên và dữ liệu tuyển dụng
- Phối hợp với các trưởng bộ phận để hiểu nhu cầu nhân sự
- Tham gia xây dựng thương hiệu nhà tuyển dụng (employer branding)

**Yêu cầu:**
- {exp} kinh nghiệm trong lĩnh vực nhân sự
- Thành thạo {skills} và các công cụ quản lý tuyển dụng
- Kỹ năng giao tiếp và đàm phán xuất sắc
- Hiểu biết về Luật Lao động Việt Nam

**Quyền lợi:**
- Mức lương cạnh tranh, thưởng theo kết quả tuyển dụng
- Cơ hội phát triển chuyên môn trong môi trường đa quốc gia`,
  ],
  operations: [
    `{title} chịu trách nhiệm đảm bảo hoạt động vận hành trơn tru và hiệu quả.

**Mô tả công việc:**
- Quản lý và tối ưu hóa quy trình vận hành kho hàng/chuỗi cung ứng
- Theo dõi KPI vận hành và đề xuất biện pháp cải thiện
- Phối hợp với nhà cung cấp, đối tác vận chuyển để đảm bảo tiến độ
- Quản lý đội ngũ nhân viên vận hành (nếu có)
- Ứng dụng {skills} để tối ưu chi phí và nâng cao năng suất

**Yêu cầu:**
- {exp} kinh nghiệm trong lĩnh vực vận hành/logistics
- Thành thạo {skills} và các phần mềm quản lý kho (WMS)
- Kỹ năng phân tích dữ liệu, sử dụng Excel nâng cao
- Chịu được áp lực công việc cao, làm việc theo ca nếu cần

**Quyền lợi:**
- Chế độ lương thưởng hấp dẫn, phụ cấp đầy đủ
- Đào tạo chuyên môn và chứng chỉ quốc tế
- Môi trường làm việc chuyên nghiệp, quy mô lớn`,
  ],
  other: [
    `Chúng tôi tìm kiếm {title} nhiệt tình để bổ sung vào đội ngũ đang phát triển.

**Mô tả công việc:**
- Hỗ trợ các hoạt động hành chính và vận hành văn phòng hàng ngày
- Phối hợp với các phòng ban để đảm bảo luồng công việc thông suốt
- Xử lý các yêu cầu từ khách hàng/đối tác một cách chuyên nghiệp
- Soạn thảo văn bản, báo cáo theo yêu cầu
- Thực hiện các nhiệm vụ khác được giao bởi quản lý

**Yêu cầu:**
- Tốt nghiệp Đại học hoặc Cao đẳng, chuyên ngành phù hợp
- {exp} kinh nghiệm ở vị trí tương đương
- Thành thạo {skills} và tin học văn phòng (Word, Excel, PowerPoint)
- Giao tiếp tốt, cẩn thận, có trách nhiệm

**Quyền lợi:**
- Môi trường làm việc thân thiện, chuyên nghiệp
- Được đào tạo và định hướng nghề nghiệp rõ ràng
- Phúc lợi đầy đủ theo quy định Nhà nước`,
  ],
};

const EXP_LABELS: Record<string, string> = {
  INTERN: "dưới 1 năm",
  JUNIOR: "1–2 năm",
  MID: "2–4 năm",
  SENIOR: "4–7 năm",
  LEAD: "5+ năm",
  MANAGER: "5+ năm quản lý",
};

function pick<T>(arr: readonly T[]): T {
  return arr[faker.number.int({ min: 0, max: arr.length - 1 })];
}

function buildDescription(cat: string, title: string, skills: string[], expLevel: string): string {
  const templates = DESC_TEMPLATES[cat] ?? DESC_TEMPLATES["other"];
  const template = pick(templates);
  return template
    .replace(/{title}/g, title)
    .replace(/{skills}/g, skills.slice(0, 3).join(", "))
    .replace(/{exp}/g, EXP_LABELS[expLevel] ?? "1–2 năm");
}

function buildCompanyName(): string {
  const prefix = pick(COMPANY_PREFIXES);
  const name = pick(COMPANY_NAMES);
  return `${prefix} ${name}`;
}

function buildCompanyDesc(catSlug: string): string {
  const descs = COMPANY_DESCRIPTIONS[catSlug] ?? COMPANY_DESCRIPTIONS["other"];
  return pick(descs);
}

async function main() {
  const del = await prisma.user.deleteMany({ where: { email: { endsWith: `@${SEED_DOMAIN}` } } });
  console.log(`Đã xoá ${del.count} user seed cũ.`);

  const passwordHash = await hashPassword("seedpass1");

  // Recruiter + công ty — gắn slug ngành để dùng khi sinh mô tả
  const recruiters: { id: string; catSlug: string }[] = [];
  for (let i = 0; i < 60; i++) {
    const cat = pick(JOB_CATEGORIES);
    const companyName = buildCompanyName();
    const user = await prisma.user.create({
      data: {
        email: `recruiter${i}@${SEED_DOMAIN}`,
        name: faker.person.fullName(),
        passwordHash,
        role: "RECRUITER",
        companyProfile: {
          create: {
            name: companyName,
            description: buildCompanyDesc(cat.slug),
            website: `https://www.${companyName.toLowerCase().replace(/[^a-z0-9]/g, "")}.com.vn`,
            location: pick(LOCATIONS),
          },
        },
      },
      select: { id: true },
    });
    recruiters.push({ id: user.id, catSlug: cat.slug });
  }
  console.log(`Đã tạo ${recruiters.length} recruiter + công ty.`);

  const MILLION = 1_000_000;
  let jobCount = 0;
  for (let i = 0; i < 1000; i++) {
    const cat = pick(JOB_CATEGORIES);
    const skills = faker.helpers.arrayElements(SKILLS_BY_CAT[cat.slug] ?? SKILLS_BY_CAT["other"], { min: 3, max: 6 });
    const title = pick(TITLE_BY_CAT[cat.slug] ?? TITLE_BY_CAT["other"]).replace("{s}", skills[0]);
    const owner = pick(recruiters);
    const expLevel = pick(EXPERIENCE_LEVELS as unknown as string[]);
    const min = faker.number.int({ min: 8, max: 40 }) * MILLION;
    const max = min + faker.number.int({ min: 3, max: 20 }) * MILLION;

    await prisma.jobDescription.create({
      data: {
        userId: owner.id,
        title,
        company: buildCompanyName(),
        rawText: buildDescription(cat.slug, title, skills, expLevel),
        location: pick(LOCATIONS),
        employmentType: pick(EMPLOYMENT_TYPES),
        experienceLevel: expLevel,
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
