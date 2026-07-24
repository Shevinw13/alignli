import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Alignli - AI Hiring Copilot",
  description:
    "AI-powered hiring copilot that helps hiring managers decide who deserves an interview.",
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
          <a href="#main-content" className="skip-to-content">
            Skip to main content
          </a>
          <main id="main-content" className="flex-1">
            {children}
          </main>
        </body>
      </html>
    </ClerkProvider>
  );
}
