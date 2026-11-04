import type { PlatformSelectors } from '../../shared/types';

export const CLAUDE_SELECTORS: PlatformSelectors = {
  root: 'body, [data-testid="chat-view"], .bg-bg-000, [class*="bg-bg"]',
  // Wide net — Claude's current DOM exposes no stable single anchor for the
  // sidebar. The two data-testid candidates plus the substring-i match cover
  // anything Claude calls "sidebar"; the aria-label nav/aside shots are
  // qualified by "chat"/"conversation"/"recent" so we don't false-match an
  // unrelated nav; the :has() shots target by sidebar-only landmark (a "new
  // chat" button or a /chat/ link inside). Confirmed against current DOM via
  // probes 2026-05-12 and 2026-05-13. Mirrors the SELECTOR_SIDEBAR_NET in
  // shared/skin-css-snippets.ts — keep both in sync when the DOM moves.
  sidebar: [
    '[data-testid="sidebar"]',
    '[data-testid="sidebar-menu"]',
    '[data-testid="navigation-sidebar"]',
    '[data-testid="conversation-list"]',
    '[data-testid="chat-history"]',
    '[data-testid*="sidebar" i]',
    'nav[aria-label*="chat" i]',
    'nav[aria-label*="conversation" i]',
    'nav[aria-label*="recent" i]',
    'aside[aria-label*="chat" i]',
    '[role="complementary"]',
    '[class*="sidebar" i]',
    'aside:has(button[aria-label*="new chat" i])',
    'aside:has(a[href*="/chat/"])',
    'nav:has(button[aria-label*="new chat" i])',
    'nav:has(a[href*="/chat/"])',
  ].join(', '),
  messages: '[data-testid="message-content"], [data-testid="assistant-turn"], [data-testid="assistant-turn-content"], [data-testid="human-turn"], .font-claude-message',
  input: '[data-testid="chat-input-area"], [contenteditable="true"], textarea',
  userBubble: '[data-user-message-bubble="true"]',
  aiBubble: '.font-claude-message',
};
