"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { scheduleInterview } from "@/lib/applications/interview";
import { changeStatus } from "@/lib/applications/actions";

type Props = {
  open: boolean;
  applicationId: string;
  onClose: () => void;
  onSuccess: () => void;
};

export default function InterviewModal({
  open,
  applicationId,
  onClose,
  onSuccess,
}: Props) {
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [location, setLocation] = useState("");
  const [meetingLink, setMeetingLink] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSkip() {
    setSaving(true);
    try {
      const r = await changeStatus(applicationId, "INTERVIEW", "");
      if (r.ok) {
        onClose();
        onSuccess();
      } else {
        toast.error(r.error);
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleSave() {
    if (!date || !time) {
      toast.error("Vui lòng chọn ngày và giờ phỏng vấn");
      return;
    }
    setSaving(true);
    try {
      const scheduledAt = new Date(`${date}T${time}`);
      const [r1, r2] = await Promise.all([
        scheduleInterview(applicationId, {
          scheduledAt,
          location,
          meetingLink,
          note,
        }),
        changeStatus(applicationId, "INTERVIEW", ""),
      ]);
      if (!r1.ok) { toast.error(r1.error); return; }
      if (!r2.ok) { toast.error(r2.error); return; }
      toast.success("Đã lưu lịch phỏng vấn");
      onClose();
      onSuccess();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Đặt lịch phỏng vấn (không bắt buộc)</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="iv-date">Ngày *</Label>
              <Input
                id="iv-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="iv-time">Giờ *</Label>
              <Input
                id="iv-time"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="iv-loc">Địa điểm</Label>
            <Input
              id="iv-loc"
              placeholder="Địa chỉ văn phòng..."
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="iv-link">Link meeting</Label>
            <Input
              id="iv-link"
              placeholder="meet.google.com/abc-def-ghi"
              value={meetingLink}
              onChange={(e) => setMeetingLink(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="iv-note">Ghi chú thêm</Label>
            <Textarea
              id="iv-note"
              placeholder="Phỏng vấn kỹ thuật 45 phút..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className="resize-none"
            />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleSkip} disabled={saving}>
            Bỏ qua
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Đang lưu..." : "Lưu lịch"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
