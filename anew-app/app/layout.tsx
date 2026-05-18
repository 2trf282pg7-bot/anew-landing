import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Anew — リレーションシップサポート",
  description: "パートナーとの関係を、もう一度。",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body className="min-h-screen bg-warm-white">
        <div className="mx-auto max-w-[480px] min-h-screen">
          {children}
        </div>
      </body>
    </html>
  );
}
