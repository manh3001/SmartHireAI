"use client";

import { useTransition, useState } from "react";
import { upsertCandidateProfile } from "@/lib/candidates/profile";
import type { ProfileInput } from "@/lib/candidates/profile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

type Props = {
  initial: ProfileInput & { username: string };
  baseUrl: string;
};

export default function ProfileForm({ initial, baseUrl }: Props) {
  const [form, setForm] = useState<ProfileInput>(initial);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleChange(field: keyof ProfileInput, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
    setSaved(false);
    setError(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await upsertCandidateProfile(form);
      if (result.ok) {
        setSaved(true);
      } else {
        setError(result.error ?? "Đã có lỗi xảy ra");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div>
        <Label htmlFor="username">Username *</Label>
        <Input
          id="username"
          value={form.username}
          onChange={(e) => handleChange("username", e.target.value)}
          placeholder="nguyena"
          className="mt-1"
          required
        />
        {form.username && (
          <p className="mt-1 text-xs text-muted-foreground">
            {baseUrl}/u/{form.username.toLowerCase()}
          </p>
        )}
      </div>

      <div>
        <Label htmlFor="bio">Giới thiệu bản thân</Label>
        <Textarea
          id="bio"
          value={form.bio}
          onChange={(e) => handleChange("bio", e.target.value)}
          placeholder="Mô tả ngắn về bản thân..."
          rows={3}
          maxLength={300}
          className="mt-1"
        />
        <p className="mt-1 text-right text-xs text-muted-foreground">{form.bio.length}/300</p>
      </div>

      {(["github", "linkedin", "twitter", "website"] as const).map((field) => (
        <div key={field}>
          <Label htmlFor={field} className="capitalize">
            {field === "website"
              ? "Website"
              : field === "twitter"
                ? "Twitter/X"
                : field.charAt(0).toUpperCase() + field.slice(1)}
          </Label>
          <Input
            id={field}
            value={form[field]}
            onChange={(e) => handleChange(field, e.target.value)}
            placeholder={
              field === "github"
                ? "github.com/username"
                : field === "linkedin"
                  ? "linkedin.com/in/username"
                  : field === "twitter"
                    ? "twitter.com/username"
                    : "yoursite.com"
            }
            className="mt-1"
          />
        </div>
      ))}

      {error && <p className="text-sm text-destructive">{error}</p>}
      {saved && <p className="text-sm text-emerald-600">Đã lưu thành công!</p>}

      <div className="flex items-center justify-between">
        {form.username && (
          <a
            href={`/u/${form.username.toLowerCase()}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-primary hover:underline"
          >
            Xem hồ sơ công khai ↗
          </a>
        )}
        <Button type="submit" disabled={isPending} className="ml-auto">
          {isPending ? "Đang lưu..." : "Lưu thay đổi"}
        </Button>
      </div>
    </form>
  );
}
