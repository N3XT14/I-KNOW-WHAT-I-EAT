import type { Metadata } from "next";
import "./globals.css";
import { TooltipProvider } from "@/components/ui/Tooltip";
import QueryProvider from "@/components/providers/QueryProvider";
import BfcacheGuard from "@/components/providers/BfcacheGuard";
import BottomNav from "@/components/nav/BottomNav";

export const metadata: Metadata = {
  title: "I Know What I Eat",
  description: "Scan a label. Understand it for real, not just get told.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin=""
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full flex flex-col font-sans">
        <QueryProvider>
          <TooltipProvider>
            <div className="flex min-h-full flex-1 flex-col">{children}</div>
            <BottomNav />
          </TooltipProvider>
        </QueryProvider>
        <BfcacheGuard />
      </body>
    </html>
  );
}