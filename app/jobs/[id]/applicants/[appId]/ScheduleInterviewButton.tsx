"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import InterviewModal, { type InterviewInitial } from "@/components/InterviewModal";

export default function ScheduleInterviewButton({
  applicationId,
  initial,
}: {
  applicationId: string;
  initial?: InterviewInitial;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const isEdit = !!initial;

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        {isEdit ? "Sửa lịch" : "Đặt lịch phỏng vấn"}
      </Button>
      {open && (
        <InterviewModal
          open={true}
          applicationId={applicationId}
          initial={initial}
          onClose={() => setOpen(false)}
          onSuccess={() => {
            setOpen(false);
            router.refresh();
          }}
        />
      )}
    </>
  );
}
