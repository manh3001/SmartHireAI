import Link from "next/link";
import { FileSearch } from "lucide-react";
import Navbar from "@/components/Navbar";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonVariants } from "@/components/ui/button";

export default function JobNotFound() {
  return (
    <div className="flex min-h-full flex-col bg-muted/20">
      <Navbar />
      <main className="mx-auto w-full max-w-3xl flex-1 p-6">
        <EmptyState
          icon={<FileSearch className="h-10 w-10" />}
          title="Tin tuyển dụng không tồn tại"
          description="Tin này có thể đã bị xoá hoặc chưa được công khai."
          action={
            <Link href="/jobs" className={buttonVariants({ variant: "outline" })}>
              ← Về danh sách việc
            </Link>
          }
        />
      </main>
    </div>
  );
}
