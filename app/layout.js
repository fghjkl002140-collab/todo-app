import "./globals.css";

export const metadata = {
  title: "かんたんToDoリスト",
  description: "シンプルで使いやすいToDoリストアプリ",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
