// Paleta categórica validada (ver skill de dataviz) para las series de los gráficos.
// El "chrome" (grillas, ejes, texto) se toma de las variables CSS del tema activo.
const PALETTE = {
  light: { gold: '#b8860b', cyan: '#0891b2', coral: '#c14953', violet: '#6d4aa8', green: '#2f8a4f' },
  dark:  { gold: '#b8860b', cyan: '#0e93a8', coral: '#e2686f', violet: '#9b7cd6', green: '#34965a' }
};

const PAYMENT_LABELS = { cash: 'Efectivo', card: 'Tarjeta' };

let charts = {};
let lastData = null;

function isDarkMode() {
  return document.documentElement.getAttribute('data-theme') === 'dark';
}

function chartTheme() {
  const dark = isDarkMode();
  const style = getComputedStyle(document.documentElement);
  return {
    palette: dark ? PALETTE.dark : PALETTE.light,
    grid: dark ? '#2c2c2a' : '#e1e0d9',
    axis: dark ? '#383835' : '#c3c2b7',
    text: (style.getPropertyValue('--text-body') || '#444').trim(),
    muted: (style.getPropertyValue('--text-muted') || '#8a8577').trim()
  };
}

function money(n) {
  return '₡' + Number(n).toLocaleString('es-CR', { minimumFractionDigits: 0 });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function toInputDate(date) {
  return date.toISOString().slice(0, 10);
}

function groupByDay(transactions) {
  const grouped = {};
  transactions.forEach(t => {
    const day = t.created_at.slice(0, 10);
    grouped[day] = (grouped[day] || 0) + t.total;
  });
  return Object.entries(grouped)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, total]) => ({ date, total }));
}

function destroyCharts() {
  Object.values(charts).forEach(c => c && c.destroy());
  charts = {};
}

function baseGridOptions(theme) {
  return {
    grid: { color: theme.grid, drawTicks: false },
    ticks: { color: theme.muted, font: { size: 11 } },
    border: { color: theme.axis }
  };
}

function renderCharts(data) {
  destroyCharts();
  const theme = chartTheme();

  // ---- Ventas por día (tendencia, un solo color) ----
  const byDay = groupByDay(data.transactions);
  charts.byDay = new Chart(document.getElementById('chart-by-day'), {
    type: 'bar',
    data: {
      labels: byDay.map(d => new Date(d.date + 'T00:00:00').toLocaleDateString('es-CR', { day: '2-digit', month: 'short' })),
      datasets: [{
        label: 'Total del día',
        data: byDay.map(d => d.total),
        backgroundColor: theme.palette.gold,
        borderRadius: 4,
        maxBarThickness: 36
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => money(ctx.parsed.y) } }
      },
      scales: {
        x: baseGridOptions(theme),
        y: { ...baseGridOptions(theme), beginAtZero: true, ticks: { ...baseGridOptions(theme).ticks, callback: v => money(v) } }
      }
    }
  });

  // ---- Método de pago (parte-al-todo: una barra apilada horizontal) ----
  const cash = data.transactions.filter(t => t.payment_method === 'cash').reduce((s, t) => s + t.total, 0);
  const card = data.transactions.filter(t => t.payment_method === 'card').reduce((s, t) => s + t.total, 0);
  charts.payment = new Chart(document.getElementById('chart-payment'), {
    type: 'bar',
    data: {
      labels: ['Total'],
      datasets: [
        { label: 'Efectivo', data: [cash], backgroundColor: theme.palette.gold, borderRadius: 4 },
        { label: 'Tarjeta', data: [card], backgroundColor: theme.palette.cyan, borderRadius: 4 }
      ]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { color: theme.text, boxWidth: 12, font: { size: 12 } } },
        tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${money(ctx.parsed.x)}` } }
      },
      scales: {
        x: { ...baseGridOptions(theme), stacked: true, beginAtZero: true, ticks: { ...baseGridOptions(theme).ticks, callback: v => money(v) } },
        y: { ...baseGridOptions(theme), stacked: true, grid: { display: false } }
      }
    }
  });

  // ---- Ventas por cajero (magnitud, segundo contexto secuencial → cyan) ----
  const byUser = data.byUser.slice(0, 8);
  charts.byUser = new Chart(document.getElementById('chart-by-user'), {
    type: 'bar',
    data: {
      labels: byUser.map(u => u.full_name),
      datasets: [{ label: 'Ingresos', data: byUser.map(u => u.total), backgroundColor: theme.palette.cyan, borderRadius: 4, maxBarThickness: 24 }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => money(ctx.parsed.x) } }
      },
      scales: {
        x: { ...baseGridOptions(theme), beginAtZero: true, ticks: { ...baseGridOptions(theme).ticks, callback: v => money(v) } },
        y: { ...baseGridOptions(theme), grid: { display: false } }
      }
    }
  });

  // ---- Productos más vendidos (magnitud, dorado) ----
  const byProduct = data.byProduct.slice(0, 8);
  charts.byProduct = new Chart(document.getElementById('chart-by-product'), {
    type: 'bar',
    data: {
      labels: byProduct.map(p => p.product_name),
      datasets: [{ label: 'Ingresos', data: byProduct.map(p => p.subtotal), backgroundColor: theme.palette.gold, borderRadius: 4, maxBarThickness: 24 }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => money(ctx.parsed.x) } }
      },
      scales: {
        x: { ...baseGridOptions(theme), beginAtZero: true, ticks: { ...baseGridOptions(theme).ticks, callback: v => money(v) } },
        y: { ...baseGridOptions(theme), grid: { display: false } }
      }
    }
  });
}

function renderKpis(data) {
  const count = data.transactions.length;
  const total = data.transactions.reduce((s, t) => s + t.total, 0);
  const avg = count ? total / count : 0;

  document.getElementById('kpi-count').textContent = count;
  document.getElementById('kpi-total').textContent = money(total);
  document.getElementById('kpi-avg').textContent = money(avg);
}

function renderTable(data) {
  const tbody = document.getElementById('tx-table');

  if (!data.transactions.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No hay ventas en el período seleccionado.</td></tr>';
    return;
  }

  tbody.innerHTML = data.transactions
    .slice()
    .reverse()
    .map(t => `
      <tr>
        <td>#${t.id}</td>
        <td>${new Date(t.created_at).toLocaleString('es-CR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
        <td class="truncate" title="${escapeHtml(t.customer_name || 'Cliente general')}">${escapeHtml(t.customer_name || 'Cliente general')}</td>
        <td class="truncate" title="${escapeHtml(t.user.full_name)}">${escapeHtml(t.user.full_name)}</td>
        <td>${PAYMENT_LABELS[t.payment_method] || '—'}</td>
        <td>${money(t.total)}</td>
      </tr>
    `).join('');
}

async function loadReports() {
  const from = document.getElementById('filter-from').value;
  const to = document.getElementById('filter-to').value;
  const errorEl = document.getElementById('reports-error');
  errorEl.classList.remove('show');

  const [txRes, prodRes, userRes] = await Promise.all([
    api.get(`/reports/by-transaction?from=${from}&to=${to}`),
    api.get(`/reports/by-product?from=${from}&to=${to}`),
    api.get(`/reports/by-user?from=${from}&to=${to}`)
  ]);

  if (!txRes.ok || !prodRes.ok || !userRes.ok) {
    errorEl.textContent = (txRes.data && txRes.data.message) || 'No se pudieron cargar los reportes.';
    errorEl.classList.add('show');
    return;
  }

  lastData = { transactions: txRes.data, byProduct: prodRes.data, byUser: userRes.data };
  renderKpis(lastData);
  renderTable(lastData);
  renderCharts(lastData);
}

// El .xlsx se genera en el backend (ExcelJS) para poder aplicar formato real de
// tabla (colores, franjas, filtros) — la librería que corre en el navegador no
// soporta estilos. Acá solo se pide el archivo y se dispara la descarga.
async function downloadExcel() {
  const from = document.getElementById('filter-from').value;
  const to = document.getElementById('filter-to').value;
  const btn = document.getElementById('btn-excel');
  const errorEl = document.getElementById('reports-error');
  errorEl.classList.remove('show');

  const originalText = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Generando...';

  try {
    const token = localStorage.getItem('token');
    const res = await fetch(`/api/reports/export?from=${from}&to=${to}`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || 'No se pudo generar el Excel.');
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reporte-snackflow_${from}_a_${to}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (e) {
    errorEl.textContent = e.message;
    errorEl.classList.add('show');
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  auth.requireAuth();
  auth.requireAdmin();

  const user = auth.getUser();
  document.getElementById('user-name').textContent = user.full_name || user.username;
  document.getElementById('role-badge').textContent = 'Administrador';

  const today = new Date();
  const monthAgo = new Date(today.getTime() - 29 * 24 * 60 * 60 * 1000);
  document.getElementById('filter-to').value = toInputDate(today);
  document.getElementById('filter-from').value = toInputDate(monthAgo);

  document.querySelectorAll('.preset-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.preset-chip').forEach(c => c.classList.remove('is-active'));
      chip.classList.add('is-active');

      const days = Number(chip.dataset.days);
      const from = new Date(today.getTime() - days * 24 * 60 * 60 * 1000);
      document.getElementById('filter-from').value = toInputDate(from);
      document.getElementById('filter-to').value = toInputDate(today);
      loadReports();
    });
  });

  // Si el usuario toca las fechas a mano, ningún preset queda activo.
  ['filter-from', 'filter-to'].forEach(id => {
    document.getElementById(id).addEventListener('change', () => {
      document.querySelectorAll('.preset-chip').forEach(c => c.classList.remove('is-active'));
    });
  });

  document.getElementById('btn-generar').addEventListener('click', loadReports);
  document.getElementById('btn-excel').addEventListener('click', downloadExcel);

  // Si se cambia el tema, los gráficos necesitan repintarse con los nuevos colores
  // (canvas no puede resolver var(--x), así que los recreamos con el hex correcto).
  new MutationObserver(() => { if (lastData) renderCharts(lastData); })
    .observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  loadReports();
});
