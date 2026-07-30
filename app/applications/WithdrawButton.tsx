"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { withdrawApplication } from "@/lib/applications/actions";

export default function WithdrawButton({ applicationId }: { applicationId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onWithdraw() {
    setLoading(true);
    const r = await withdrawApplication(applicationId);
    if (r.ok) {
      toast.success("Đã rút đơn");
      router.refresh();
    } else {
      toast.error(r.error);
      setLoading(false);
    }
  }

  return (
    <Button variant="destructive" size="sm" onClick={onWithdraw} disabled={loading}>
      {loading ? "Đang rút..." : "Rút đơn"}
    </Button>
  );
}
