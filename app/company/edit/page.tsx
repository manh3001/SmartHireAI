import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import prisma from "@/lib/db/prisma";
import Navbar from "@/components/Navbar";
import CompanyAvatar from "@/components/CompanyAvatar";
import { upsertCompanyProfile } from "@/lib/company/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function CompanyEditPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (session.user.role !== "RECRUITER") redirect("/dashboard");

  const { error } = await searchParams;

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
            <form action={upsertCompanyProfile} encType="multipart/form-data" className="grid gap-3">
              <div><Label>Tên công ty</Label>
                <Input name="name" defaultValue={profile?.name ?? ""} placeholder="VD: ACME" required /></div>
              <div><Label>Địa điểm</Label>
                <Input name="location" defaultValue={profile?.location ?? ""} placeholder="VD: Hà Nội" /></div>
              <div><Label>Website</Label>
                <Input name="website" defaultValue={profile?.website ?? ""} placeholder="https://..." /></div>
              <div>
                <Label>Logo công ty</Label>
                <div className="mt-1 mb-2 flex items-center gap-3">
                  {profile?.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={profile.logoUrl} alt="Logo công ty" className="h-12 w-12 rounded-lg object-cover" />
                  ) : (
                    <CompanyAvatar name={profile?.name ?? ""} className="h-12 w-12" />
                  )}
                </div>
                <input
                  type="file"
                  name="logo"
                  accept="image/png,image/jpeg,image/webp"
                  className="block w-full text-sm text-foreground file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-primary-foreground"
                />
                {profile?.logoUrl && (
                  <label className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                    <input type="checkbox" name="removeLogo" value="1" /> Xóa logo
                  </label>
                )}
                <p className="mt-1 text-xs text-muted-foreground">PNG, JPEG hoặc WebP, tối đa 500KB.</p>
              </div>
              <div><Label>Giới thiệu công ty</Label>
                <Textarea name="description" rows={6} defaultValue={profile?.description ?? ""} placeholder="Mô tả về công ty..." /></div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="justify-self-start">Lưu hồ sơ</Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
