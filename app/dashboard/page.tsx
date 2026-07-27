import { auth, signOut } from "@/auth";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-2xl font-bold">Xin chào, {session.user.name}</h1>
      <p className="mt-2 text-gray-600">Đây là bảng điều khiển của bạn.</p>
      <form
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/login" });
        }}
      >
        <button className="mt-4 border p-2 rounded">Đăng xuất</button>
      </form>
    </main>
  );
}
