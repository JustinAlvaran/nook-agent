import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const metadataBase = new URL(`${protocol}://${host}`);

  return {
    metadataBase,
    title: "Nook — Your trainable desktop companion",
    description:
      "A visible, approval-first desktop pet that helps across your apps — plus a marketplace for creator-built companions and skills.",
    openGraph: {
      title: "Nook — Ask your pet. Watch it get done.",
      description:
        "Trainable desktop companions, visible automations, and a creator marketplace.",
      type: "website",
      images: [{ url: "/og.png", width: 1733, height: 909, alt: "Nook desktop companion" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "Nook — Your trainable desktop companion",
      description: "Ask your pet. Watch it get done.",
      images: ["/og.png"],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
