import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import NewJobForm from "./NewJobForm";

export default async function NewJobPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (session.user.role !== "RECRUITER") redirect("/dashboard");

  return (
    <div className="flex min-h-full flex-col bg-muted/30">
      <Navbar />
      <main className="mx-auto w-full max-w-2xl flex-1 p-6">
        <Link href="/dashboard" className="text-sm text-primary hover:underline">← Về dashboard</Link>
        <Card className="mt-3">
          <CardHeader><CardTitle className="text-primary">Đăng tin tuyển dụng</CardTitle></CardHeader>
          <CardContent>
            <NewJobForm />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
