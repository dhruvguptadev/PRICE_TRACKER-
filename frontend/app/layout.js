import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
});

export const metadata = {
  title: "Price Tracker",
  description: "Scheduled price and stock tracking for the INE mock storefront.",
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${instrumentSerif.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">
        <header className="border-b border-line bg-surface">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
            <Link href="/" className="flex items-center gap-2 font-semibold">
              <span aria-hidden="true" className="grid h-7 w-7 place-items-center rounded-md bg-accent text-sm text-accent-ink">₹</span>
              Price Tracker
            </Link>
            <nav className="flex items-center gap-5 text-sm">
              <Link href="/#how" className="hidden text-ink-2 hover:text-ink sm:inline">How it works</Link>
              <a href="https://github.com/bipul724/price-tracker" className="hidden text-ink-2 hover:text-ink sm:inline">Source</a>
              <Link href="/dashboard" className="rounded-md px-3 py-1.5 font-medium ring-1 ring-line hover:bg-surface-2">Dashboard</Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">{children}</main>
      </body>
    </html>
  );
}
