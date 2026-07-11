document.addEventListener('DOMContentLoaded', () => {
  auth.requireAuth();

  const user = auth.getUser();

  // Mostrar info del usuario
  document.getElementById('welcome-name').textContent = user.full_name || user.username;
  document.getElementById('user-name').textContent    = user.full_name || user.username;
  document.getElementById('role-badge').textContent   = user.role === 'admin' ? 'Administrador' : 'Cajero';

  // Acciones según rol
  const adminActions = [
    { icon: '🧾', title: 'Nueva venta',  desc: 'Iniciar una nueva transacción', href: '/nuevaVenta.html'},
    { icon: '📊', title: 'Reportes',     desc: 'Ver reportes de ventas',         href: '/reports.html' },
    { icon: '👥', title: 'Usuarios',     desc: 'Gestionar usuarios del sistema', href: '/users.html'   },
    { icon: '📦', title: 'Productos',    desc: 'Ver catálogo de productos',       href: '/products.html' },
  ];

  const cashierActions = [
    { icon: '🧾', title: 'Nueva venta', desc: 'Iniciar una nueva transacción', href: '/nuevaVenta.html' },
    { icon: '📦', title: 'Productos',   desc: 'Ver catálogo de productos',      href: '/products.html' },
  ];

  const actions = user.role === 'admin' ? adminActions : cashierActions;
  const container = document.getElementById('actions-container');
  actions.forEach(a => {
    const btn = document.createElement('button');
    btn.className = 'action-btn';
    btn.onclick = () => window.location.href = a.href;
    btn.innerHTML = `
      <div class="action-icon">${a.icon}</div>
      <div class="action-title">${a.title}</div>
      <div class="action-desc">${a.desc}</div>
    `;
    container.appendChild(btn);
  });

  // Stats — se conectarán al API cuando esté listo el módulo de ventas
  document.getElementById('stat-ventas').textContent   = '0';
  document.getElementById('stat-total').textContent    = '₡0';
  document.getElementById('stat-efectivo').textContent = '₡0';
  document.getElementById('stat-tarjeta').textContent  = '₡0';
  document.getElementById('sales-table').innerHTML =
    '<tr><td colspan="6" class="empty-state">No hay ventas registradas hoy.</td></tr>';
});