# Privacy

Skyn changes how supported AI assistant websites look. It does not process conversation content.

The extension does not:

- Read prompts or responses
- Access input values
- Listen for keyboard events
- Access cookies on supported AI domains
- Access localStorage or sessionStorage on supported AI domains
- Transmit page content
- Inject ads or tracking into supported AI domains

The extension stores user preferences in Chrome extension storage:

- Active skin
- Active font
- Enabled/disabled state
- Unlocked skin IDs
- License token
- Background image, stored locally on the device

Payment and license validation use the Skyn backend. Checkout opens in a new browser tab. The extension sends license and purchase metadata to validate access, not conversation content.
