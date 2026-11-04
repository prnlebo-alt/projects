import type { PlatformSelectors } from '../../shared/types';

export const GEMINI_SELECTORS: PlatformSelectors = {
  root: 'body, gemini-app',
  sidebar: 'side-navigation-v2, mat-sidenav, bard-sidenav',
  messages: 'message-content, .model-response-text, user-query, model-response',
  input: 'rich-textarea, [contenteditable="true"]',
  userBubble: '.user-query-bubble-with-background',
  aiBubble: '.model-response-text',
};
