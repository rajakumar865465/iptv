import type { Metadata } from "next";
import { Inter, Poppins } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/components/ThemeProvider";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["700"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL('https://nivatv.luxomall.in'),
  title: "NivaTV — Live TV for Every Indian Home",
  description: "Watch 500+ Indian live channels including Hindi, Bengali, Tamil, Telugu and Malayalam on your Android device. Buy a license and start streaming live TV today.",
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
  icons: {
    icon: "/logo.png",
    apple: "/logo.png",
  },
};


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en-IN" className="scroll-smooth w-full max-w-full overflow-x-clip" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var d=document.documentElement,f=document.createElement('div');f.style.display='flex';f.style.flexDirection='column';f.style.rowGap='10px';f.style.position='absolute';f.style.visibility='hidden';f.appendChild(document.createElement('div'));f.appendChild(document.createElement('div'));d.appendChild(f);var ok=f.scrollHeight>=8;d.removeChild(f);if(!ok&&d.className.indexOf('no-flex-gap')===-1)d.className+=(d.className?' ':'')+'no-flex-gap';}catch(e){}})();`,
          }}
        />
        <Script id="meta-pixel" strategy="afterInteractive">
          {`
            !function(f,b,e,v,n,t,s)
            {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)}(window, document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');
            fbq('init', '1389534106435145');
            fbq('track', 'PageView');
          `}
        </Script>
      </head>
      <body
        className={`${inter.variable} ${poppins.variable} antialiased font-sans w-full max-w-full overflow-x-clip min-h-screen`}
        suppressHydrationWarning
      >
        <noscript>
          <img height="1" width="1" style={{ display: "none" }} src="https://www.facebook.com/tr?id=1389534106435145&ev=PageView&noscript=1" alt="" />
        </noscript>
        <ThemeProvider>
          <AuthProvider>{children}</AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
