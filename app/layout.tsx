import type { Metadata, Viewport } from "next";
import { Archivo_Black, Black_Ops_One, Bungee, Fraunces, JetBrains_Mono, Righteous, Shrikhand, Space_Grotesk } from "next/font/google";
import { themeBootScript } from "@/lib/theme";
import "./globals.css";

const serif = Fraunces({ subsets: ["latin"], variable: "--font-fraunces" });
const sans = Space_Grotesk({ subsets: ["latin"], variable: "--font-grotesk" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains" });
// Kit display fonts: not preloaded, so a phone only downloads the one its kit uses.
const archivo = Archivo_Black({ weight: "400", subsets: ["latin"], variable: "--font-archivo", preload: false });
const righteous = Righteous({ weight: "400", subsets: ["latin"], variable: "--font-righteous", preload: false });
const bungee = Bungee({ weight: "400", subsets: ["latin"], variable: "--font-bungee", preload: false });
const blackops = Black_Ops_One({ weight: "400", subsets: ["latin"], variable: "--font-blackops", preload: false });
const shrikhand = Shrikhand({ weight: "400", subsets: ["latin"], variable: "--font-shrikhand", preload: false });
const fonts = [serif, sans, mono, archivo, righteous, bungee, blackops, shrikhand].map((f) => f.variable).join(" ");

export const metadata: Metadata = {
  title: "Guess the Imposter",
  description: "A pass-and-play party game: find the imposter who doesn't know the secret word.",
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
  appleWebApp: { capable: true, title: "Imposter", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#111114",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-theme="hifi" suppressHydrationWarning className={fonts}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
