const STORAGE_KEY = 'portfolio-theme';

function getInitialTheme() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'dark' || stored === 'light') return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme, callback) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem(STORAGE_KEY, theme);
  if (callback) requestAnimationFrame(callback);
}

function toggleTheme(callback) {
  const current = document.documentElement.getAttribute('data-theme');
  applyTheme(current === 'dark' ? 'light' : 'dark', callback);
}

function initTheme() {
  applyTheme(getInitialTheme());
}

export { initTheme, applyTheme, toggleTheme };
