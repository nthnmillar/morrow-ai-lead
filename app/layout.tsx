import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Morrow | Enquiry review",
  description: "Review incoming enquiries and proposed next steps.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
