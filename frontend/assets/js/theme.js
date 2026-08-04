(function() {
  if (localStorage.getItem('theme') === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
  }
})();

function toggleTheme() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  if (isDark) {
    document.documentElement.removeAttribute('data-theme');
    localStorage.setItem('theme', 'light');
  } else {
    document.documentElement.setAttribute('data-theme', 'dark');
    localStorage.setItem('theme', 'dark');
  }
}

// Menú de usuario del header en celular (usuario/rol/cerrar sesión detrás
// del botón ☰, en vez de amontonados en la barra). En tablet/desktop
// .header-menu se muestra inline vía CSS y este toggle no aplica.
function toggleHeaderMenu() {
  const menu = document.getElementById('header-menu');
  const btn = document.getElementById('menu-toggle');
  if (!menu || !btn) return;
  const open = menu.classList.toggle('open');
  btn.setAttribute('aria-expanded', open ? 'true' : 'false');
}

function closeHeaderMenu() {
  const menu = document.getElementById('header-menu');
  const btn = document.getElementById('menu-toggle');
  if (!menu || !menu.classList.contains('open')) return;
  menu.classList.remove('open');
  if (btn) btn.setAttribute('aria-expanded', 'false');
}

document.addEventListener('click', (e) => {
  const menu = document.getElementById('header-menu');
  const btn = document.getElementById('menu-toggle');
  if (!menu || !btn) return;
  if (!menu.contains(e.target) && !btn.contains(e.target)) closeHeaderMenu();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeHeaderMenu();
});
