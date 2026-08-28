import Link from "next/link";
import { FileSearch } from "lucide-react";
import Navbar from "@/components/Navbar";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col bg-muted/20">
      <Navbar />
      <main className="flex flex-1 flex-col items-center justify-center p-6">
        <EmptyState
          icon={<FileSearch className="h-12 w-12" />}
          title="Trang không tồn tại"
          description="Địa chỉ này không đúng hoặc trang đã bị xoá."
          action={
            <Link href="/" className={buttonVariants()}>
              Về trang chủ
            </Link>
          }
        />
      </main>
    </div>
  );
}
