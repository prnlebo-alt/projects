const NAVIGATION_EVENT = 'skyn:navigation';

export function startSpaObserver(onNavigate: () => void): () => void {
  let currentUrl = location.href;
  let rafId = 0;

  patchHistoryMethod('pushState');
  patchHistoryMethod('replaceState');

  const schedule = () => {
    cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(() => {
      if (location.href === currentUrl) return;
      currentUrl = location.href;
      onNavigate();
    });
  };

  const observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('popstate', schedule);
  window.addEventListener(NAVIGATION_EVENT, schedule);

  return () => {
    cancelAnimationFrame(rafId);
    observer.disconnect();
    window.removeEventListener('popstate', schedule);
    window.removeEventListener(NAVIGATION_EVENT, schedule);
  };
}

function patchHistoryMethod(method: 'pushState' | 'replaceState'): void {
  const original = history[method];
  const patchKey = `__skyn_${method}_patched`;
  const historyWithFlag = history as History & Record<string, boolean>;
  if (historyWithFlag[patchKey]) return;

  history[method] = function patchedHistoryMethod(...args) {
    const result = original.apply(this, args);
    window.dispatchEvent(new Event(NAVIGATION_EVENT));
    return result;
  };
  historyWithFlag[patchKey] = true;
}
