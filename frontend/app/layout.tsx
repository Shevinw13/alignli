import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { SkipToContent } from "@/components/shared/skip-to-content";
import "./globals.css";

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "BTS - BrightWell Talent Solutions",
  description:
    "AI-powered hiring copilot that helps hiring managers decide who deserves an interview.",
  icons: {
    icon: "/logo.jpeg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en" className={`${plusJakartaSans.variable} h-full antialiased`}>
        <body className="min-h-full flex flex-col font-sans">
          <SkipToContent />
          <main id="main-content" className="flex-1">
            {children}
          </main>
        </body>
      </html>
    </ClerkProvider>
  );
}
