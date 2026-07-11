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
    title: "Nook — The little agent who lives on your desktop",
    description:
      "Create a visible, teachable desktop companion with live 3D customization, supervised tasks, readable permissions, and creator-built skills.",
    openGraph: {
      title: "Nook — Meet the little agent who lives on your desktop.",
      description:
        "Create a live 3D Nook, choose an outfit, and supervise every task step.",
      type: "website",
      images: [{ url: "/og-v2.png", width: 1733, height: 909, alt: "Nook desktop companion in a midnight hoodie" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "Nook — Meet the little agent who lives on your desktop.",
      description: "Create a live 3D Nook and supervise every task step.",
      images: ["/og-v2.png"],
    },
    icons: { icon: "/favicon.svg" },
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
