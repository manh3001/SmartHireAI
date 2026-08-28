# Gói B — Tìm kiếm & Dữ liệu (Search & Data)

- **Ngày**: 2026-08-28
- **Trạng thái**: Đã duyệt thiết kế, chờ viết plan
- **Bối cảnh**: Vòng 2 của lộ trình "nâng cấp bám sát web tuyển dụng thật" ([[security-upgrade-roadmap]]). Gói A (bảo mật) đã merge. Gói B nâng tìm kiếm/dữ liệu lên mức ITviec/Glints. Các gói C–F sau.

## 1. Mục tiêu & vấn đề hiện tại

**Mục tiêu**: tìm kiếm việc làm chất lượng cho dữ liệu tiếng Việt (relevance ranking, chịu lỗi chính tả, không dấu), phân trang hiệu năng tốt, facet counts động, và dữ liệu mẫu đủ lớn để mọi thứ trông "sống".

**Hiện trạng (đã khảo sát)**:
- Tìm kiếm = `contains` ILIKE `%term%` OR trên 5 trường (`lib/jobs/job-query.ts` `buildJobsWhere`): không index, không xếp hạng, không fuzzy, không bỏ dấu.
- `/jobs` (`app/jobs/page.tsx`) `findMany` **tải toàn bộ** kết quả, không phân trang.
- Filter: employmentType/experienceLevel/category/salary — không có số đếm.
- Chưa có seed data → UI trông trống.
- DB dùng `prisma db push` (không có migrations). Neon Postgres (hỗ trợ pg_trgm, unaccent).

## 2. Quyết định nền tảng (đã chốt)

- **Search engine**: `pg_trgm` (trigram) — GIN index tăng tốc ILIKE + `similarity()` ranking + fuzzy; ngôn ngữ-agnostic, hợp tiếng Việt. Kèm `unaccent` (bỏ dấu).
- **Index delivery**: SQL script idempotent chạy qua `prisma db execute` (`npm run db:search`) — giữ nguyên `db push`.
- **Pagination**: "Xem thêm" (load more) dùng cursor opaque.
- **Seed**: ~1000 job + ~60 công ty + ~30 candidate, `@faker-js/faker` locale vi, idempotent (`npm run db:seed`).
- **Facet counts**: có, động theo filter hiện tại (đếm mỗi chiều loại trừ chính chiều đó).

## 3. Kiến trúc

Đường tìm kiếm chuyển sang `prisma.$queryRawUnsafe` **tham số hoá** (Prisma không biểu diễn `similarity()`/trigram). Phần dựng SQL + params tách thành hàm **thuần** để unit-test không cần DB.

```
/jobs page → searchJobs({ term, filters, cursor, limit })
  → buildSearchSql(...) [thuần] → { sql, params }
  → prisma.$queryRawUnsafe(sql, ...params) → { items, nextCursor }
  (song song) → buildFacetSql(dim,...) [thuần] × 3 → facet counts
```

## 4. Lớp SQL — `prisma/search-setup.sql` (chạy `npm run db:search`)

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE OR REPLACE FUNCTION immutable_unaccent(text) RETURNS text
  LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE AS $$ SELECT unaccent('unaccent', $1) $$;
CREATE INDEX IF NOT EXISTS job_search_trgm ON "JobDescription"
  USING gin (immutable_unaccent(lower(title||' '||company||' '||coalesce(location,'')||' '||skills||' '||rawText)) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS job_public_created ON "JobDescription" ("isPublic", "createdAt" DESC, id);
```

Idempotent (`IF NOT EXISTS` / `OR REPLACE`). Chạy qua `prisma db execute --file prisma/search-setup.sql --schema prisma/schema.prisma` với `NODE_OPTIONS=--dns-result-order=ipv4first`.

## 5. Truy vấn & xếp hạng — `lib/jobs/search-query.ts` (thuần)

`buildSearchSql(input): { sql: string; params: unknown[] }` với input `{ term?, employmentType?, experienceLevel?, category?, salaryMillions?, cursor?, limit }`.

- Vùng search: `SEARCH := immutable_unaccent(lower(title||' '||company||' '||coalesce(location,'')||' '||skills||' '||rawText))`.
- Term chuẩn hoá: tham số `NQ := immutable_unaccent(lower($term))`.
- **Có term**: `WHERE "isPublic" AND (SEARCH ILIKE '%'||NQ||'%' OR NQ <% SEARCH)` + filters. Dùng toán tử `<%` (word_similarity: term ngắn khớp gần đúng một "từ" trong văn bản dài) cho fuzzy — KHÔNG dùng `%` (similarity toàn chuỗi, sai khi SEARCH dài). `ORDER BY word_similarity(NQ, SEARCH) DESC, "createdAt" DESC, id DESC`. Phân trang **offset** (mã hoá trong cursor) do thứ tự theo điểm.
- **Không term**: `WHERE "isPublic" ...filters`. `ORDER BY "createdAt" DESC, id DESC`. Phân trang **keyset** `("createdAt", id) < ($cursorCreatedAt, $cursorId)`.
- `limit` mặc định (vd 20); lấy `limit+1` để biết còn trang sau → tính `nextCursor`.
- Term và mọi giá trị filter **luôn qua param** (chống injection). Tên cột/hằng do code kiểm soát, không nội suy giá trị người dùng.
- Trả `{ items, nextCursor }`; `nextCursor` null khi hết.

## 6. Cursor — `lib/jobs/cursor.ts` (thuần)

`encodeCursor(v)` / `decodeCursor(s)` cho 2 dạng: keyset `{ k: createdAtISO, i: id }` và offset `{ o: number }`. Base64 opaque. Input hỏng/thiếu → `decodeCursor` trả `null` (an toàn: quay về trang đầu).

## 7. Facet counts — `lib/jobs/facets.ts` (thuần dựng SQL)

`buildFacetSql(dimension, filters, term): { sql, params }` sinh `SELECT <col> AS key, COUNT(*)::int AS count ... WHERE ... GROUP BY <col>`, áp mọi filter + term **TRỪ** chiều đang đếm (thấy số phương án thay thế). 3 chiều: `employmentType`, `experienceLevel`, `category`. `searchJobs` gọi 3 truy vấn đếm song song với truy vấn danh sách. Kết quả map → `{ [optionValue]: count }` cho UI.

## 8. Seed — `scripts/seed.ts` (`npm run db:seed`)

- `@faker-js/faker` locale `vi` (devDependency).
- **Idempotent**: user seed dùng email `*@seed.example`; đầu mỗi lần chạy xoá dữ liệu seed cũ theo marker rồi tạo lại — không đụng dữ liệu thật (cascade xoá job/company/cv liên quan qua quan hệ onDelete).
- Tạo: ~60 recruiter + `CompanyProfile`; ~1000 `JobDescription` (`isPublic=true`) với tiêu đề/kỹ năng/địa điểm (TP lớn VN)/lương/loại hình/cấp bậc thực tế theo danh mục nghề hiện có (`lib/jobs/job-categories`, `job-fields`, `salary`); ~30 candidate + vài CV. Mật khẩu chung băm bcrypt đạt password policy Gói A.
- Chạy với `NODE_OPTIONS=--dns-result-order=ipv4first`.

## 9. Wiring UI — `app/jobs/page.tsx`, `components/jobs/JobsBrowser`, `components/jobs/JobFilters`

- `/jobs` gọi `searchJobs(...)` thay `buildJobsWhere + findMany`. Trang đầu render server.
- Nút **"Xem thêm"** → Server Action `loadMoreJobs(params, cursor)` trả trang kế + `nextCursor`; client nối danh sách, giữ master-detail hiện có.
- `JobFilters`: hiển thị số đếm cạnh mỗi option (vd "IT (320)"); option 0 kết quả disable/mờ.
- Empty state cơ bản khi 0 kết quả (gợi ý xoá lọc); trau chuốt sâu thuộc Gói C.
- `buildJobsWhere` cũ: kiểm tra caller khác trước; `/jobs` chuyển sang module mới. Giữ `buildJobsWhere` nếu nơi khác còn dùng.

## 10. Kiểm thử (TDD — chỉ logic thuần)

- `buildSearchSql`: có/không term; từng filter và kết hợp; cursor keyset vs offset; đúng số/thứ tự param; term luôn qua param (không nội suy).
- `cursor`: round-trip encode/decode cả 2 dạng; input hỏng → null.
- `buildFacetSql`: loại đúng chiều đang đếm; áp phần filter còn lại + term; đúng param.
- DB/route/seed: kiểm thử tay theo checklist (repo không unit-test DB).

## 11. package.json & docs

- Thêm `@faker-js/faker` (devDependencies).
- Scripts: `"db:search"` (prisma db execute file), `"db:seed"` (chạy seed.ts), cùng prefix `cross-env NODE_OPTIONS=--dns-result-order=ipv4first`.
- README: mục "Khởi tạo tìm kiếm & dữ liệu mẫu" (chạy `db:push` → `db:search` → `db:seed`).

## 12. Ngoài phạm vi (gói sau)

Autocomplete/typeahead, đồng bộ trigram cho recommendations/alerts, lịch sử tìm kiếm, i18n, saved-search nâng cao. Ghi nhận, không làm ở Gói B.

## 13. Definition of Done

- `npm run db:search` + `npm run db:seed` chạy sạch (idempotent, không đụng dữ liệu thật).
- `/jobs`: tìm "ha noi" ra "Hà Nội"; chịu 1 lỗi chính tả; ranking hợp lý; "Xem thêm" phân trang đúng (không trùng/sót); facet counts đúng theo filter.
- `npm test` xanh (test thuần mới + cũ); `npm run build` + `npm run lint` pass.
