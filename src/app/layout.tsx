import type { Metadata } from "next";
import "@/index.css";
import { Providers } from "@/components/Providers";

export const metadata: Metadata = {
  title: "eLeopards Dashboard",
  description: "eLeopards Clients Dashboard · Internal use only",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
