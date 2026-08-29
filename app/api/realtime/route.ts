import { auth } from "@/auth";
import { getNotificationSignalRaw } from "@/lib/notifications/poll";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const encoder = new TextEncoder();
  let closed = false;
  let intervalId: ReturnType<typeof setInterval>;

  const stream = new ReadableStream({
    start(controller) {
      void getNotificationSignalRaw(userId).then((signal) => {
        if (!closed) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(signal)}\n\n`),
          );
        }
      });

      intervalId = setInterval(() => {
        if (closed) {
          clearInterval(intervalId);
          return;
        }
        void getNotificationSignalRaw(userId)
          .then((signal) => {
            if (!closed) {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify(signal)}\n\n`),
              );
            }
          })
          .catch(() => {
            if (!closed) {
              controller.enqueue(encoder.encode(`: ping\n\n`));
            }
          });
      }, 8_000);

      req.signal.addEventListener("abort", () => {
        closed = true;
        clearInterval(intervalId);
        try {
          controller.close();
        } catch {
          // already closed
        }
      });
    },
    cancel() {
      closed = true;
      clearInterval(intervalId);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
