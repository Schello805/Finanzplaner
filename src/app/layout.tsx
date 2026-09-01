import type { Metadata } from "next";
import { AppNavigation } from "@/components/app-navigation";
import { AppFooter } from "@/components/app-footer";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Finanzplaner", template: "%s · Finanzplaner" },
  description: "Private, quelloffene Ausgabenanalyse für Familien",
  icons: { icon: "/icons/icon-192.png", apple: "/icons/apple-touch-icon.png" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de">
      <body>
        <div className="app-shell">
          <AppNavigation />
          <main className="app-main">{children}<AppFooter /></main>
        </div>
      </body>
    </html>
  );
}
