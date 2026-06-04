import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { cookies } from "next/headers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "PRTools", template: "%s — PRTools" },
  description: "Outreach, sentiment, and social posting for film & brand teams",
};

// Blocking inline script — runs before first paint so there's no flash.
// Adds .dark/.light to <html> based on the user-theme cookie, and for
// "system" preference falls back to the OS media query.
const themeScript = `(function(){try{
  var c=document.cookie.match(/(?:^|;)\\s*user-theme=([^;]+)/);
  var t=c?c[1]:'system';
  var h=document.documentElement;
  if(t==='dark'){h.classList.add('dark');}
  else if(t==='light'){h.classList.add('light');}
  else{
    if(window.matchMedia('(prefers-color-scheme:dark)').matches)h.classList.add('dark');
    window.matchMedia('(prefers-color-scheme:dark)').addEventListener('change',function(e){
      h.classList.toggle('dark',e.matches);
    });
  }
}catch(e){}})();`;

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const jar = await cookies();
  const theme = jar.get("user-theme")?.value ?? "system";
  const themeClass = theme === "dark" ? "dark" : theme === "light" ? "light" : "";

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased${themeClass ? ` ${themeClass}` : ""}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full" style={{ background: "var(--background)", color: "var(--foreground)" }}>
        {children}
      </body>
    </html>
  );
}
