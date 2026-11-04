# Best Practices

Keep API keys server-side. Rotate them when exposed. Use separate keys per environment or integration so they can be revoked independently.

Prefer SVG in web products and PNG in email or systems with unreliable SVG support. Store the returned asset URL instead of re-rendering the same chart on every page view.

Treat warnings as publication checks, not decoration. Block automatic publishing on QA errors. Review warnings when a chart is customer-facing.

Keep titles specific. “Revenue” is weak. “Monthly recurring revenue grew 84% in six months” tells readers what the chart is for.

Aggregate dense time series before rendering. A 900-pixel image cannot communicate hundreds of labeled points honestly.
