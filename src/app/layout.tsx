import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Grade AI System - AI-Powered Exam Grading",
  description: "Advanced AI-powered exam grading system with handwritten answer analysis and assessment. Built with TypeScript, Tailwind CSS, and shadcn/ui.",
  keywords: ["Grade AI", "Exam Grading", "Handwriting Recognition", "Next.js", "TypeScript", "Tailwind CSS", "shadcn/ui", "AI development", "React"],
  authors: [{ name: "Rajaram" }],
  icons: {
    icon: "https://www.lavudyaraja.in/favicon.ico",
  },
  openGraph: {
    title: "Grade AI System",
    description: "AI-powered exam grading with handwritten answer analysis",
    url: "https://www.lavudyaraja.in",
    siteName: "Grade AI",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Grade AI System",
    description: "AI-powered exam grading with handwritten answer analysis",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
