import Link from "next/link";

// Grouped site navigation. The header stays short (Playground / Docs / Pricing + auth), so the
// footer is where every public route is reachable from.
const groups = [
  {
    id: "footer-nav-product",
    title: "Product",
    links: [
      { href: "/playground", label: "Playground" },
      { href: "/studio", label: "Studio" },
      { href: "/chart-check", label: "Chart checker" },
      { href: "/mcp", label: "MCP server" },
      { href: "/pricing", label: "Pricing" },
    ],
  },
  {
    id: "footer-nav-resources",
    title: "Resources",
    links: [
      { href: "/docs", label: "API docs" },
      { href: "/integrations", label: "Integrations" },
      { href: "/support", label: "Support" },
      { href: "/compare", label: "Compare alternatives" },
      { href: "/register", label: "Create account" },
      { href: "/login", label: "Sign in" },
    ],
  },
  {
    id: "footer-nav-legal",
    title: "Legal",
    links: [
      { href: "/terms", label: "Terms" },
      { href: "/privacy", label: "Privacy" },
    ],
  },
];

export function Footer() {
  return <footer className="footer">
    <div className="footer-brand">
      <strong>ChartRelay</strong>
      <p>Charts your agents can ship without embarrassing you.</p>
    </div>
    <nav className="footer-nav" aria-label="Footer">
      {groups.map((group) => <div className="footer-group" key={group.id}>
        <h2 className="footer-group-title" id={group.id}>{group.title}</h2>
        <ul aria-labelledby={group.id}>
          {group.links.map((link) => <li key={link.href}><Link href={link.href}>{link.label}</Link></li>)}
        </ul>
      </div>)}
    </nav>
  </footer>;
}
