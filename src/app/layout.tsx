import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/hooks/use-auth";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Schichtplaner",
  description: "Moderne Schichtplanung für Teams und Mitarbeiter",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de">
      <body className={`${inter.className} antialiased`}>
        <AuthProvider>{children}</AuthProvider>
        <Toaster />
      </body>

    </html>
  );
}

