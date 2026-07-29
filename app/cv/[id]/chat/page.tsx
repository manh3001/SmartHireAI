import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import prisma from "@/lib/db/prisma";
import ChatClient, { type ChatMsg } from "./ChatClient";

export default async function ChatPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const cv = await prisma.cV.findFirst({
    where: { id, userId: session.user.id },
    select: { id: true, title: true },
  });
  if (!cv) notFound();

  const chatSession = await prisma.chatSession.findFirst({
    where: { cvId: cv.id, userId: session.user.id },
    select: {
      messages: {
        orderBy: { createdAt: "asc" },
        select: { id: true, role: true, content: true },
      },
    },
  });

  const initial: ChatMsg[] =
    chatSession?.messages.map((m) => ({
      id: m.id,
      role: m.role === "USER" ? "user" : "assistant",
      content: m.content,
    })) ?? [];

  return <ChatClient cvId={cv.id} cvTitle={cv.title} initial={initial} />;
}
