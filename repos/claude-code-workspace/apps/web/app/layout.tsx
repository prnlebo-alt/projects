export const metadata = {
  title: "Market Intelligence — Phase 1",
  description: "Evidence Engine admin inspection (Phase 1). Full UI is Phase 7."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", margin: "2rem" }}>{children}</body>
    </html>
  );
}
