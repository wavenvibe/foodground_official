import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "푸드그라운드 — 식품제조시설 매칭",
  description: "식품제조 의뢰자와 제조시설을 잇는 공공데이터 기반 경량 매칭 플랫폼",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
