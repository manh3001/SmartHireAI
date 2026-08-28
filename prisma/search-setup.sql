-- Idempotent: chạy nhiều lần an toàn. Cung cấp trigram search + bỏ dấu cho JobDescription.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- unaccent mặc định KHÔNG immutable -> không dùng được trong index. Bọc lại immutable.
-- Sử dụng public.unaccent từ extension unaccent (compatible với Neon PostgreSQL).
CREATE OR REPLACE FUNCTION immutable_unaccent(text) RETURNS text
  LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
  AS $$ SELECT public.unaccent($1) $$;

-- GIN trigram trên vùng text đã bỏ dấu + lowercase (khớp SEARCH_EXPR trong lib/jobs/job-sql.ts).
CREATE INDEX IF NOT EXISTS job_search_trgm ON "JobDescription"
  USING gin (
    immutable_unaccent(lower(
      coalesce(title,'')||' '||coalesce(company,'')||' '||coalesce(location,'')||' '||
      coalesce(skills,'')||' '||coalesce("rawText",'')
    )) gin_trgm_ops
  );

-- Hỗ trợ keyset browse + lọc isPublic.
CREATE INDEX IF NOT EXISTS job_public_created ON "JobDescription" ("isPublic", "createdAt" DESC, id);
