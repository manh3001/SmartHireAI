export default function Home() {
  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-3xl font-bold">Nền tảng CV thông minh</h1>
      <p className="mt-2 text-gray-600">Tạo CV, đánh giá bằng AI, tìm việc phù hợp.</p>
      <div className="mt-6 flex gap-3">
        <a href="/register" className="bg-black text-white p-2 rounded">Đăng ký</a>
        <a href="/login" className="border p-2 rounded">Đăng nhập</a>
      </div>
    </main>
  );
}
