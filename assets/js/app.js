/* ---- theme ---- */
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const btn = document.getElementById('theme-toggle');
  if (btn) btn.textContent = theme === 'dark' ? '\u263E' : '\u2600';
  try { localStorage.setItem('8ball-theme', theme); } catch (e) {}
}

function initTheme() {
  let theme = 'dark';
  try {
    theme = localStorage.getItem('8ball-theme')
      || (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
  } catch (e) {}
  applyTheme(theme);
  const btn = document.getElementById('theme-toggle');
  if (btn) {
    btn.addEventListener('click', () => {
      const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      applyTheme(next);
    });
  }
}

/* ---- mobile nav ---- */
function initMobileNav() {
  const toggle = document.getElementById('nav-toggle');
  const links = document.getElementById('nav-links');
  if (!toggle || !links) return;
  toggle.addEventListener('click', () => links.classList.toggle('open'));
  links.addEventListener('click', (e) => {
    if (e.target.closest('a')) links.classList.remove('open');
  });
}

/* ---- language ----
 * Every page is fully pre-rendered in English at build time, with
 * data-i18n="key" (and data-i18n-<var>="value" for interpolated strings)
 * sprinkled through the markup wherever translatable text lives. Switching
 * language just walks the current page's DOM and re-runs t(key, vars)
 * against every one of those elements - no page reload, no re-render. */
const AVAILABLE_LANGS = Object.keys(I18N); // ['en', 'es'] by default - add more in i18n.js

function translateDocument() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const vars = {};
    for (const attr of el.attributes) {
      if (attr.name.startsWith('data-i18n-')) {
        vars[attr.name.slice('data-i18n-'.length)] = attr.value;
      }
    }
    el.textContent = t(key, vars);
  });
  document.documentElement.lang = getLang();
  const btn = document.getElementById('lang-toggle');
  if (btn) btn.textContent = getLang().toUpperCase();
}

function initLangToggle() {
  translateDocument();
  const btn = document.getElementById('lang-toggle');
  if (!btn) return;
  btn.addEventListener('click', () => {
    const idx = AVAILABLE_LANGS.indexOf(getLang());
    const next = AVAILABLE_LANGS[(idx + 1) % AVAILABLE_LANGS.length];
    setLang(next);
    translateDocument();
  });
}

/* ---- boot ---- */
(function init() {
  initLang();
  initTheme();
  initMobileNav();
  initLangToggle();
})();
