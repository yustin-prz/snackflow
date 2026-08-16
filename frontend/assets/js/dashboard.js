function money(n) {
  return '₡' + Number(n).toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
      <td data-label="#">#${s.id}</td>
      <td data-label="Cliente">${s.customer_name ? escapeHtml(s.customer_name) : 'Cliente general'}</td>
      <td data-label="Total">${money(s.total)}</td>
      <td data-label="Pago">${s.payment_method ? PAYMENT_LABELS[s.payment_method] : '—'}</td>
      <td data-label="Estado"><span class="status ${s.status}">${STATUS_LABELS[s.status] || s.status}</span></td>
      <td data-label="Hora">
        <div class="hora-cell">
          <span>${new Date(s.created_at).toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit' })}</span>
          ${s.status === 'completed' ? `
            <div class="row-menu">
              <button type="button" class="row-menu-btn" onclick="toggleRowMenu(event, ${s.id})" aria-label="Más opciones" title="Más opciones">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="12" cy="5" r="2.2"/><circle cx="12" cy="12" r="2.2"/><circle cx="12" cy="19" r="2.2"/>
                </svg>
              </button>
              <div class="row-menu-dropdown" id="row-menu-${s.id}">
                <button type="button" data-action="ver" onclick="abrirFactura(${s.id}, false, this)">Ver factura</button>
                <button type="button" data-action="imprimir" onclick="abrirFactura(${s.id}, true, this)">Imprimir factura</button>
              </div>
            </div>
          ` : ''}
        </div>
      </td>
    </tr>
  `).join('');
}

// ===================== Menú de fila (⋮) =====================
function closeAllRowMenus() {
  document.querySelectorAll('.row-menu-dropdown.open').forEach(el => el.classList.remove('open'));
}

function toggleRowMenu(event, saleId) {
  event.stopPropagation();
  const dropdown = document.getElementById(`row-menu-${saleId}`);
  const wasOpen = dropdown.classList.contains('open');
  closeAllRowMenus();
  if (!wasOpen) dropdown.classList.add('open');
}

document.addEventListener('click', closeAllRowMenus);
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeAllRowMenus(); });

// ===================== Modal de factura (ver/imprimir) =====================
// Reutiliza GET /api/sales/:id (ya existe para el resto de la app) — nada de
// PDF ni archivos nuevos: se arma la misma info en HTML dentro de un modal,
// y "Imprimir" solo dispara el diálogo de impresión del navegador sobre ese
// mismo contenido (ver @media print en dashboard.css). No se manda a ninguna
// impresora real ni se genera nada en el servidor.
//
// El fetch a la base de datos (Neon, en la nube) puede tardar un momento y
// no había ningún indicio visual de que algo estaba pasando — el primer
// click sí funcionaba, pero como no cambiaba nada en pantalla parecía que
// no había hecho nada, así que tocaba volver a hacer click. El texto del
// botón ahora cambia a "Cargando…" mientras espera, y se ignoran los clicks
// repetidos hasta que termine (evita además pedir la misma venta dos veces).
let facturaEnCurso = false;

async function abrirFactura(saleId, imprimir, btn) {
  if (facturaEnCurso) return;
  facturaEnCurso = true;

  const textoOriginal = btn ? btn.textContent : '';
  if (btn) { btn.disabled = true; btn.textContent = 'Cargando…'; }

  try {
    const { ok, data } = await api.get(`/sales/${saleId}`);
    if (!ok) {
      alert(data.message || 'No se pudo cargar el detalle de la venta.');
      return;
    }

    renderFactura(data);
    document.getElementById('invoice-modal').classList.add('active');

    if (imprimir) {
      // Un tick para que el modal termine de pintarse antes de abrir el diálogo.
      setTimeout(() => window.print(), 100);
    }
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = textoOriginal; }
    closeAllRowMenus();
    facturaEnCurso = false;
  }
}

function closeInvoiceModal() {
  document.getElementById('invoice-modal').classList.remove('active');
}

function renderFactura(sale) {
  const fecha = new Date(sale.created_at).toLocaleString('es-CR', { dateStyle: 'long', timeStyle: 'short' });
  const metodoPago = sale.payment_method ? PAYMENT_LABELS[sale.payment_method] : '—';

  document.getElementById('inv-numero').textContent   = `Nº ${sale.id}`;
  document.getElementById('inv-cliente').textContent  = sale.customer_name || 'Cliente general';
  document.getElementById('inv-correo').textContent   = sale.customer_email || '—';
  document.getElementById('inv-fecha').textContent    = fecha;
  document.getElementById('inv-cajero').textContent   = sale.user.full_name;
  document.getElementById('inv-pago').textContent     = metodoPago;

  document.getElementById('inv-items').innerHTML = sale.items.map(item => `
    <tr>
      <td>${escapeHtml(item.product.name)}</td>
      <td class="num">${money(item.unit_price)}</td>
      <td class="num">${item.quantity}</td>
      <td class="num">${money(item.subtotal)}</td>
    </tr>
  `).join('');

  const filas = [['Subtotal', money(sale.subtotal), false]];
  if (Number(sale.discount) > 0) {
    const etiqueta = sale.promotion === '2x1' ? 'Promoción 2x1 Gelatina' : `Descuento (${sale.discount_percentage}%)`;
    filas.push([etiqueta, `-${money(sale.discount)}`, false]);
  }
  filas.push(['IVA (13%, incluido)', money(sale.tax), false]);
  filas.push(['Total', money(sale.total), true]);

  document.getElementById('inv-totals').innerHTML = filas.map(([label, value, bold]) => `
    <div class="invoice-total-row ${bold ? 'is-total' : ''}">
      <span>${label}</span>
      <span>${value}</span>
    </div>
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