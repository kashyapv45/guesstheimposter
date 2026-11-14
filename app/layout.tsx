import type { Metadata, Viewport } from "next";
import { Fraunces, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import { themeBootScript } from "@/lib/theme";
import "./globals.css";

const serif = Fraunces({ subsets: ["latin"], variable: "--font-fraunces" });
const sans = Space_Grotesk({ subsets: ["latin"], variable: "--font-grotesk" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains" });

export const metadata: Metadata = {
  title: "Guess the Imposter",
  description: "A pass-and-play vinyl party game: find the imposter who doesn't know the secret word.",
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
  appleWebApp: { capable: true, title: "Imposter", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#121214",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-theme="hifi" suppressHydrationWarning className={`${serif.variable} ${sans.variable} ${mono.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body className="font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
