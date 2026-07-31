import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { createJobDescription } from "@/lib/jobs/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  EMPLOYMENT_TYPES,
  EMPLOYMENT_TYPE_LABELS,
  EXPERIENCE_LEVELS,
  EXPERIENCE_LEVEL_LABELS,
} from "@/lib/jobs/job-fields";

export default async function NewJobPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (session.user.role !== "RECRUITER") redirect("/dashboard");

  return (
    <div className="flex min-h-full flex-col bg-slate-50">
      <Navbar />
      <main className="mx-auto w-full max-w-2xl flex-1 p-6">
        <Link href="/dashboard" className="text-sm text-blue-600 hover:underline">← Về dashboard</Link>
        <Card className="mt-3">
          <CardHeader><CardTitle className="text-blue-700">Đăng tin tuyển dụng</CardTitle></CardHeader>
          <CardContent>
            <form action={createJobDescription} className="grid gap-3">
              <div><Label>Tiêu đề vị trí</Label>
                <Input name="title" placeholder="VD: Frontend Developer" required /></div>
              <div><Label>Công ty</Label>
                <Input name="company" placeholder="VD: ACME" /></div>
              <div><Label>Địa điểm</Label>
                <Input name="location" placeholder="VD: Hà Nội, Remote" /></div>
              <div><Label>Loại hình làm việc</Label>
                <select name="employmentType" className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm">
                  <option value="">— Chọn —</option>
                  {EMPLOYMENT_TYPES.map((t) => (
                    <option key={t} value={t}>{EMPLOYMENT_TYPE_LABELS[t]}</option>
                  ))}
                </select></div>
              <div><Label>Cấp bậc</Label>
                <select name="experienceLevel" className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm">
                  <option value="">— Chọn —</option>
                  {EXPERIENCE_LEVELS.map((l) => (
                    <option key={l} value={l}>{EXPERIENCE_LEVEL_LABELS[l]}</option>
                  ))}
                </select></div>
              <div><Label>Kỹ năng yêu cầu</Label>
                <Input name="skills" placeholder="VD: React, Node, SQL (cách nhau bởi phẩy)" /></div>
              <div><Label>Mô tả công việc (JD)</Label>
                <Textarea name="rawText" rows={10} placeholder="Dán nội dung mô tả công việc..." required /></div>
              <Button type="submit" className="justify-self-start">Đăng tin</Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
