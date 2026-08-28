import Link from "next/link";
import { Building2 } from "lucide-react";
import Navbar from "@/components/Navbar";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonVariants } from "@/components/ui/button";

export default function CompanyNotFound() {
  return (
    <div className="flex min-h-full flex-col bg-muted/20">
      <Navbar />
      <main className="mx-auto w-full max-w-3xl flex-1 p-6">
        <EmptyState
          icon={<Building2 className="h-10 w-10" />}
          title="Công ty không tồn tại"
          description="Trang công ty này có thể đã bị xoá hoặc chưa được tạo."
          action={
            <Link href="/companies" className={buttonVariants({ variant: "outline" })}>
              ← Về danh sách công ty
            </Link>
          }
        />
      </main>
    </div>
  );
}
