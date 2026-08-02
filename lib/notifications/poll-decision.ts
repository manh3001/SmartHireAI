export type NotificationSignal = {
  unreadCount: number;
  latest: { id: string; message: string; link: string } | null;
};

export type PollAction = {
  shouldRefresh: boolean;
  toast: { message: string; link: string } | null;
};

export function decidePollAction(
  prev: NotificationSignal,
  next: NotificationSignal,
  currentPath: string,
): PollAction {
  const shouldRefresh =
    next.unreadCount !== prev.unreadCount ||
    (next.latest?.id ?? null) !== (prev.latest?.id ?? null);

  const isNewLatest =
    next.latest != null && next.latest.id !== (prev.latest?.id ?? null);
  const toast =
    isNewLatest && next.latest!.link !== currentPath
      ? { message: next.latest!.message, link: next.latest!.link }
      : null;

  return { shouldRefresh, toast };
}
