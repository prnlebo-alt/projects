import type { PlatformSelectors } from '../../shared/types';

export const CHATGPT_SELECTORS: PlatformSelectors = {
  root: 'body, #__next, main',
  sidebar: '#sidebar, [data-testid="sidebar"], nav[aria-label="Chat history"], nav[aria-label], aside',
  messages: '[data-message-author-role], [data-testid^="conversation-turn"], article[data-testid], article, .markdown, .prose',
  input: '#prompt-textarea, textarea, [contenteditable="true"][data-lexical-editor], [data-testid="composer"] [contenteditable="true"]',
  userBubble: '.user-message-bubble-color',
  aiBubble: '[data-message-author-role="assistant"] .markdown',
};
