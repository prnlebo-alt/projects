import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'NEXUS — Multi-Model AI',
  description: 'Claude, GPT-4o, and Gemini in one interface. One subscription replaces three.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="midnight" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
