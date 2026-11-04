/**
 * Project Plant — background.js (MV3 service worker)
 *
 * Ephemeral — can be killed at any time by Chrome.
 * NO in-memory state. Everything that must survive goes to chrome.storage.local.
 */

'use strict';

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'PLANT_GET_CONFIG') {
    // Return config to content script on request
    chrome.storage.local.get(['plant_theme_preference'], result => {
      sendResponse({
        theme: result.plant_theme_preference ?? 'default',
      });
    });
    return true; // keep channel open for async sendResponse
  }
});

// On install: set defaults
chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === 'install') {
    chrome.storage.local.set({
      plant_theme_preference: 'default',
    });
  }
});
