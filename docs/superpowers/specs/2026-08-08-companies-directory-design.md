# Danh bạ công ty `/companies` — Thiết kế

**Ngày:** 2026-08-08
**Trạng thái:** Đã duyệt (brainstorming)

## Mục tiêu

Thêm trang danh bạ công ty `/companies` liệt kê các công ty đang tuyển dụng, mỗi mục dẫn tới trang chi tiết `/companies/[id]` đã có sẵn. Bổ sung điều hướng "Công ty" trên Navbar.

## Phạm vi (quyết định khi brainstorm)

- **Công ty hiển thị:** chỉ công ty có hồ sơ `CompanyProfile` **VÀ** có ≥1 tin tuyển dụng công khai (`isPublic: true`). Ẩn công ty rỗng và công ty chưa tạo hồ sơ.
- **Tìm kiếm:** ô tìm theo **tên công ty** qua `?q` (contains, insensitive), giống pattern `/jobs`.
- **Sắp xếp:** số tin đang tuyển **giảm dần**; hòa thì theo **tên tăng dần** (locale `vi`).
- **Truy cập:** yêu cầu đăng nhập (redirect `/login`), nhất quán với `/jobs` và `/companies/[id]`.
- **KHÔNG** làm trong vòng này: lọc theo địa điểm (để backlog); đổi schema; đụng AI/auth/realtime.

## Kiến trúc & luồng dữ liệu

Trang server component `app/companies/page.tsx` (`export const dynamic = "force-dynamic"`), nhận `searchParams: { q?: string }`.

Hai truy vấn Prisma (không N+1, không raw SQL):

1. **Đếm tin/công ty:**
   ```ts
   prisma.jobDescription.groupBy({
     by: ["userId"],
     where: { isPublic: true },
     _count: { _all: true },
   })
   ```
   → dựng `countByUserId: Record<string, number>`.

2. **Lấy hồ sơ công ty có tin, lọc tên:**
   ```ts
   prisma.companyProfile.findMany({
     where: {
       userId: { in: [...userId có tin] },
       ...(term ? { name: { contains: term, mode: "insensitive" } } : {}),
     },
     select: { id: true, userId: true, name: true, description: true, location: true, logoUrl: true },
   })
   ```

Gộp count + sắp xếp bằng **hàm thuần** `rankCompanies` (tầng query lo lọc `q` và điều kiện "có tin").

Ghi chú thứ tự an toàn: nếu danh sách `userId có tin` rỗng, bỏ qua query 2 (hoặc `in: []` trả rỗng) → empty state.

## Hàm thuần — `lib/company/directory.ts`

```ts
export type CompanyDirInput = {
  id: string;
  userId: string;
  name: string;
  description: string;
  location: string;
  logoUrl: string;
};

export type CompanyDirItem = CompanyDirInput & { jobCount: number };

export function rankCompanies(
  companies: CompanyDirInput[],
  countByUserId: Record<string, number>,
): CompanyDirItem[];
```

Hành vi:
- Gắn `jobCount = countByUserId[userId] ?? 0` cho mỗi công ty (mặc định 0 phòng thủ nếu thiếu key).
- Sắp xếp: `jobCount` giảm dần; hòa → `name.localeCompare(other.name, "vi")` tăng dần.
- Không đột biến mảng đầu vào (trả mảng mới).

Test `lib/company/__tests__/directory.test.ts`:
- Sắp đúng theo `jobCount` giảm dần.
- Tie-break theo tên (locale vi) khi count bằng nhau.
- Công ty thiếu trong `countByUserId` → `jobCount = 0`.
- Mảng rỗng → mảng rỗng.

## Component — `components/companies/CompanyCard.tsx`

Thẻ dùng chung nhận `{ company: CompanyDirItem }`:
- Logo: `<img src={logoUrl}>` nếu có `logoUrl`, ngược lại `CompanyAvatar name={name}` (tái dùng đúng pattern `/companies/[id]`; giữ `eslint-disable no-img-element` như trang chi tiết).
- Tên công ty; `📍 {location}` nếu có.
- Badge "**{jobCount} tin đang tuyển**" (dùng `Badge` hoặc pill token `bg-primary/10 text-primary`).
- Mô tả rút gọn `line-clamp-2` nếu có `description`.
- Bọc trong `Card`; toàn thẻ là `<Link href={/companies/${id}}>`.
- Dùng design token (`primary`, `muted-foreground`, `border`); `className` nháy thẳng ASCII.

## Trang `/companies`

- `Navbar` ở đầu; nền `bg-muted/20`; container `max-w-6xl`.
- Tiêu đề "Danh bạ công ty" + phụ đề ngắn.
- Ô tìm kiếm: `<form>` method GET, `<input name="q">` giữ giá trị hiện tại, nút "Tìm" — giống thanh tìm `/jobs`.
- Lưới thẻ: `grid gap-4 sm:grid-cols-2 lg:grid-cols-3`.
- **Empty state** (thẻ nét đứt):
  - Không có công ty nào đang tuyển → "Chưa có công ty nào đang tuyển."
  - Có `q` nhưng không khớp → "Không tìm thấy công ty khớp \"{q}\"."

## Điều hướng — `components/Navbar.tsx`

Thêm link **"Công ty"** (`/companies`) cạnh "Việc làm":
- Cụm mobile (`sm:hidden`): thêm sau link "Việc làm".
- Cụm desktop (`hidden sm:flex`): thêm sau link "Việc làm".
- Cùng class `text-sm font-medium text-muted-foreground hover:text-foreground`.

## Ràng buộc chung (giữ như các vòng trước)

- Không đổi `prisma/schema.prisma`.
- Test: **chỉ** unit-test hàm thuần `rankCompanies`; component/route/page không unit-test.
- Design token, không hardcode màu; `className` nháy thẳng ASCII; nội dung tiếng Việt; thương hiệu **SmartHire**.
- Windows: `npm test`, `npm run lint`, `npm run build`.

## Files

**Tạo mới:**
- `lib/company/directory.ts`
- `lib/company/__tests__/directory.test.ts`
- `components/companies/CompanyCard.tsx`
- `app/companies/page.tsx`

**Sửa:**
- `components/Navbar.tsx` (thêm 2 link "Công ty")
