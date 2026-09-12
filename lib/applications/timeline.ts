import { STATUS_LABELS, type ApplicationStatus } from "./status";

export type TimelineStep = {
  status: ApplicationStatus;
  label: string;
  date: Date;
  isCurrent: boolean;
};

// events phải được sắp xếp tăng dần theo createdAt (trang applications đã orderBy asc).
export function buildApplicationTimeline(app: {
  createdAt: Date;
  status: ApplicationStatus;
  events: { toStatus: ApplicationStatus; createdAt: Date }[];
}): TimelineStep[] {
  const raw: { status: ApplicationStatus; date: Date }[] = [];
  const hasSubmitted = app.events.some((e) => e.toStatus === "SUBMITTED");
  if (!hasSubmitted) raw.push({ status: "SUBMITTED", date: app.createdAt });
  for (const e of app.events) raw.push({ status: e.toStatus, date: e.createdAt });

  let currentIdx = -1;
  for (let i = raw.length - 1; i >= 0; i--) {
    if (raw[i].status === app.status) { currentIdx = i; break; }
  }

  return raw.map((s, i) => ({
    status: s.status,
    label: STATUS_LABELS[s.status],
    date: s.date,
    isCurrent: i === currentIdx,
  }));
}
