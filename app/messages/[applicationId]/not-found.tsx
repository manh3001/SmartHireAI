import Link from "next/link";
import { MessageSquare } from "lucide-react";
import Navbar from "@/components/Navbar";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonVariants } from "@/components/ui/button";

export default function MessagesNotFound() {
  return (
    <div className="flex min-h-full flex-col bg-muted/20">
      <Navbar />
      <main className="mx-auto w-full max-w-2xl flex-1 p-6">
        <EmptyState
          icon={<MessageSquare className="h-10 w-10" />}
          title="Cuộc trò chuyện không tồn tại"
          description="Đơn ứng tuyển này không tồn tại hoặc bạn không có quyền truy cập."
          action={
            <Link href="/applications" className={buttonVariants({ variant: "outline" })}>
              ← Về đơn ứng tuyển
            </Link>
          }
        />
      </main>
    </div>
  );
}
