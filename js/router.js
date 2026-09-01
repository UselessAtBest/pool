const ROUTES = [];

function route(pattern, handler) {
  // pattern like '/player/:slug' -> regex with named groups
  const paramNames = [];
  const regexStr = '^' + pattern.replace(/:[^/]+/g, (m) => {
    paramNames.push(m.slice(1));
    return '([^/]+)';
  }) + '/?$';
  ROUTES.push({ regex: new RegExp(regexStr, 'i'), paramNames, handler });
}

function currentPath() {
  return window.location.pathname.replace(/\/index\.html$/, '') || '/';
}

async function renderRoute() {
  const path = currentPath();
  const main = document.getElementById('app-main');
  for (const r of ROUTES) {
    const match = r.regex.exec(path);
    if (match) {
      const params = {};
      r.paramNames.forEach((name, i) => { params[name] = decodeURIComponent(match[i + 1]); });
      try {
        main.innerHTML = '<div class="empty-state">Loading…</div>';
        const html = await r.handler(params);
        main.innerHTML = html;
      } catch (err) {
        console.error(err);
        main.innerHTML = notFoundView();
      }
      updateActiveNav(path);
      window.scrollTo({ top: 0 });
      return;
    }
  }
  main.innerHTML = notFoundView();
  updateActiveNav(path);
}

function notFoundView() {
  return `
    <div class="page-header">
      <div class="eyebrow">${t('notfound.eyebrow')}</div>
      <h1>${t('notfound.title')}</h1>
      <p>${t('notfound.subtitle')}</p>
    </div>
    <a class="btn" href="/" data-link>${t('notfound.back_home')}</a>
  `;
}

function navigate(path) {
  if (path !== currentPath()) {
    window.history.pushState({}, '', path);
  }
  renderRoute();
}

function updateActiveNav(path) {
  document.querySelectorAll('.nav-links a').forEach(a => {
    const target = a.getAttribute('href');
    const isActive = target === '/' ? path === '/' : path.startsWith(target);
    a.classList.toggle('active', isActive);
  });
}

document.addEventListener('click', (e) => {
  const link = e.target.closest('a[data-link]');
  if (!link) return;
  const url = new URL(link.href);
  if (url.origin !== window.location.origin) return;
  e.preventDefault();
  navigate(url.pathname);
});

window.addEventListener('popstate', renderRoute);
