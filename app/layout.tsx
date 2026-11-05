import type { Metadata } from "next";
import { Fraunces, Source_Sans_3 } from "next/font/google";
import { SiteHeader } from "@/components/SiteHeader";
import "./globals.css";

const display = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
});

const body = Source_Sans_3({
  variable: "--font-body",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Nathan Felix",
    template: "%s · Nathan Felix",
  },
  description: "Projects, experiments, and infrastructure notes from Nathan Felix.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <div className="site-shell flex min-h-full flex-1 flex-col">
          <SiteHeader />
          <main>{children}</main>
          <footer className="site-footer">
            Built with Next.js · Hosted on AWS · Managed with Terraform
          </footer>
        </div>
      </body>
    </html>
  );
}
