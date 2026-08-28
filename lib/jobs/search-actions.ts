"use server";

import { searchJobs, type SearchInput, type JobRow } from "./search";

// Server Action cho nút "Xem thêm" — chỉ trả danh sách + cursor, không tính lại facet.
export async function loadMoreJobs(
  input: SearchInput,
): Promise<{ items: JobRow[]; nextCursor: string | null }> {
  return searchJobs(input);
}
