import "./globals.css";
import type { Metadata } from "next";
import AppTopBar from "./_components/AppTopBar";

export const metadata: Metadata = {
  title: "Capital Bonds Dashboard",
  description: "Internal pipeline dashboard for bond applications.",
  icons: {
    icon: "/capital-bonds-favicon.png",
    apple: "/capital-bonds-favicon.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-slate-900">
        <AppTopBar />
        <main className="mx-auto w-full max-w-[1600px] px-4 py-6 md:px-6 md:py-8 xl:px-8">{children}</main>
      </body>
    </html>
  );
}
