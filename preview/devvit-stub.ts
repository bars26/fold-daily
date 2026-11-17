// Local preview only: stands in for @devvit/web/client outside Reddit.
export const showToast = (msg: string) => {
  const el = document.createElement('div');
  el.textContent = msg;
  el.style.cssText =
    'position:fixed;bottom:16px;left:50%;transform:translateX(-50%);background:#fff;color:#000;padding:8px 14px;border-radius:999px;z-index:99;font:14px system-ui';
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2000);
};
export const navigateTo = (url: string) => window.open(url, '_blank');
export const requestExpandedMode = () => {
  location.href = '/game.html' + location.search;
};
const n = Number(new URLSearchParams(location.search).get('n') ?? '1');
export const context = { postId: 't3_preview', postData: (window as unknown as { __postData?: unknown }).__postData, username: 'preview', n };
