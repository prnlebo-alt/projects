export default function PrivacyPage() {
  return (
    <main style={{ maxWidth: 760, margin: '0 auto', padding: 32, fontFamily: 'system-ui, sans-serif', lineHeight: 1.6 }}>
      <h1>Skyn Privacy Policy</h1>
      <p>
        Skyn applies CSS-only visual skins to supported AI assistant websites. Skyn does not read, collect,
        transmit, sell, or store your conversation content.
      </p>
      <h2>What Skyn does not do</h2>
      <p>
        Skyn does not read prompts or responses. It does not access input values, cookies, localStorage, or
        sessionStorage on supported AI websites. It does not listen for keyboard events.
      </p>
      <h2>What Skyn stores</h2>
      <p>
        Skyn stores account, license, and purchase records needed to unlock paid skins. The browser extension
        stores your active skin, font, enabled state, and optional background image preference.
      </p>
      <h2>Payments</h2>
      <p>
        Payments are handled by Stripe Checkout. Skyn stores purchase metadata such as item ID, amount, Stripe
        session ID, license token, and unlocked skin IDs.
      </p>
      <h2>Contact</h2>
      <p>
        For privacy questions, contact the Skyn team through the public support address listed on skynapp.app.
      </p>
    </main>
  );
}
