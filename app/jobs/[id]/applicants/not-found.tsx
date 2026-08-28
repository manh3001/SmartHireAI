import Link from "next/link";
import { FileSearch } from "lucide-react";
import Navbar from "@/components/Navbar";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonVariants } from "@/components/ui/button";

export default function ApplicantsNotFound() {
  return (
    <div className="flex min-h-full flex-col bg-muted/20">
      <Navbar />
      <main className="mx-auto w-full max-w-6xl flex-1 p-6">
        <EmptyState
          icon={<FileSearch className="h-10 w-10" />}
          title="Tin tuyển dụng không tồn tại"
          description="Tin này không tồn tại hoặc bạn không có quyền xem."
          action={
            <Link href="/dashboard" className={buttonVariants({ variant: "outline" })}>
              ← Về Dashboard
            </Link>
          }
        />
      </main>
    </div>
  );
}
