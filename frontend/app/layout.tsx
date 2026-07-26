import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { SkipToContent } from "@/components/shared/skip-to-content";
import "./globals.css";

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Narrowli — AI Hiring Copilot",
  description:
    "AI-powered hiring copilot that ranks candidates against your criteria and shows you exactly why.",
  icons: {
    icon: "/narrowli.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${plusJakartaSans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">
        <SkipToContent />
        {children}
      </body>
    </html>
  );
}
