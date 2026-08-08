import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import prisma from "@/lib/db/prisma";
import Navbar from "@/components/Navbar";
import { upsertCompanyProfile } from "@/lib/company/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function CompanyEditPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (session.user.role !== "RECRUITER") redirect("/dashboard");

  const profile = await prisma.companyProfile.findUnique({
    where: { userId: session.user.id },
    select: { name: true, description: true, website: true, location: true, logoUrl: true },
  });

  return (
    <div className="flex min-h-full flex-col bg-muted/20">
      <Navbar />
      <main className="mx-auto w-full max-w-2xl flex-1 p-6">
        <Link href="/dashboard" className="text-sm text-primary hover:underline">← Về dashboard</Link>
        <Card className="mt-3">
          <CardHeader><CardTitle className="text-foreground">Hồ sơ công ty</CardTitle></CardHeader>
          <CardContent>
            <form action={upsertCompanyProfile} className="grid gap-3">
              <div><Label>Tên công ty</Label>
                <Input name="name" defaultValue={profile?.name ?? ""} placeholder="VD: ACME" required /></div>
              <div><Label>Địa điểm</Label>
                <Input name="location" defaultValue={profile?.location ?? ""} placeholder="VD: Hà Nội" /></div>
              <div><Label>Website</Label>
                <Input name="website" defaultValue={profile?.website ?? ""} placeholder="https://..." /></div>
              <div><Label>Logo (URL ảnh)</Label>
                <Input name="logoUrl" defaultValue={profile?.logoUrl ?? ""} placeholder="https://.../logo.png" /></div>
              <div><Label>Giới thiệu công ty</Label>
                <Textarea name="description" rows={6} defaultValue={profile?.description ?? ""} placeholder="Mô tả về công ty..." /></div>
              <Button type="submit" className="justify-self-start">Lưu hồ sơ</Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
