import "./globals.css";
import type { Metadata } from "next";
import AppTopBar from "./_components/AppTopBar";

export const metadata: Metadata = {
  title: "Capital Bonds Dashboard",
  description: "Internal pipeline dashboard for bond applications.",
  icons: {
    icon: "/capital-bonds-logo.svg",
    apple: "/capital-bonds-logo.svg",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#182439] text-white">
        <AppTopBar />
        <main className="mx-auto w-full max-w-none px-6 py-8">{children}</main>
      </body>
    </html>
  );
}

