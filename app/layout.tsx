import type { Metadata } from "next";
import { Geist, Geist_Mono, Be_Vietnam_Pro, Lora } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const beVietnamPro = Be_Vietnam_Pro({
  variable: "--font-be-vietnam-pro",
  subsets: ["vietnamese", "latin"],
  weight: ["400", "700"],
});

const lora = Lora({
  variable: "--font-lora",
  subsets: ["vietnamese", "latin"],
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: "Nền tảng CV thông minh",
  description: "Tạo CV, đánh giá bằng AI, tìm việc phù hợp.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="vi"
      className={`${geistSans.variable} ${geistMono.variable} ${beVietnamPro.variable} ${lora.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
