function money(n) {
  return '₡' + Number(n).toLocaleString('es-CR', { minimumFractionDigits: 0 });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function isToday(dateStr) {
  const d = new Date(dateStr);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

// Semana calendario actual (lunes 00:00 → ahora).
function startOfWeek() {
  const now = new Date();
  const day = now.getDay(); // 0 = domingo, 1 = lunes, ...
  const diffToMonday = day === 0 ? 6 : day - 1;
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diffToMonday);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function isThisWeek(dateStr) {
  return new Date(dateStr) >= startOfWeek();
}

const STATUS_LABELS = { open: 'Abierta', completed: 'Completada', cancelled: 'Cancelada' };
const PAYMENT_LABELS = { cash: 'Efectivo', card: 'Tarjeta' };

async function loadSalesStats() {
  const tbody = document.getElementById('sales-table');
  const { ok, data } = await api.get('/sales');

  if (!ok) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No se pudieron cargar las ventas.</td></tr>';
    return;
  }

  // Las 4 tarjetas de arriba son de la semana calendario actual (lunes → ahora);
  // la tabla de "ventas recientes" de más abajo sigue siendo solo de hoy.
  const weekSales = data.filter(s => isThisWeek(s.created_at));
  const completedThisWeek = weekSales.filter(s => s.status === 'completed');

  const totalRecaudado = completedThisWeek.reduce((sum, s) => sum + Number(s.total), 0);
  const efectivo = completedThisWeek
    .filter(s => s.payment_method === 'cash')
    .reduce((sum, s) => sum + Number(s.total), 0);
  const tarjeta = completedThisWeek
    .filter(s => s.payment_method === 'card')
    .reduce((sum, s) => sum + Number(s.total), 0);

  document.getElementById('stat-ventas').textContent   = completedThisWeek.length;
  document.getElementById('stat-total').textContent    = money(totalRecaudado);
  document.getElementById('stat-efectivo').textContent = money(efectivo);
  document.getElementById('stat-tarjeta').textContent  = money(tarjeta);

  const todaySales = data.filter(s => isToday(s.created_at));
  const recent = [...todaySales]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 10);

  if (!recent.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No hay ventas registradas hoy.</td></tr>';
    return;
  }

  tbody.innerHTML = recent.map(s => `
    <tr>
      <td>#${s.id}</td>
      <td>${s.customer_name ? escapeHtml(s.customer_name) : 'Cliente general'}</td>
      <td>${money(s.total)}</td>
      <td>${s.payment_method ? PAYMENT_LABELS[s.payment_method] : '—'}</td>
      <td><span class="status ${s.status}">${STATUS_LABELS[s.status] || s.status}</span></td>
      <td>${new Date(s.created_at).toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit' })}</td>
    </tr>
  `).join('');
}

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

  loadSalesStats();
});