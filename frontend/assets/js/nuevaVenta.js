document.addEventListener('DOMContentLoaded', () => {
  auth.requireAuth();

  const user = auth.getUser();
  document.getElementById('user-name').textContent  = user.full_name || user.username;
  document.getElementById('role-badge').textContent = user.role === 'admin' ? 'Administrador' : 'Cajero';

  // ===================== Catálogo =====================
  // Productos reales del backend (mismo endpoint que usa /products.html).
  let PRODUCTS = [];

  const IVA_RATE = 0.13;

  // ===================== Estado del wizard =====================
  const state = {
    step: 1,
    cliente: { nombre: '', telefono: '', notas: '' },
    carrito: {},   // { [productId]: cantidad }
    metodoPago: null,
  };

  // ===================== Helpers =====================
  const $ = (id) => document.getElementById(id);
  const money = (n) => '₡' + Number(n).toLocaleString('es-CR', { minimumFractionDigits: 0 });

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function carritoItems() {
    return Object.entries(state.carrito)
      .filter(([, qty]) => qty > 0)
      .map(([id, qty]) => ({ ...PRODUCTS.find(p => String(p.id) === id), qty }));
  }

  function subtotal() {
    return carritoItems().reduce((sum, item) => sum + item.price * item.qty, 0);
  }

  // ===================== Navegación entre pasos =====================
  function goToStep(step) {
    state.step = step;

    document.querySelectorAll('.pos-step').forEach(section => {
      section.classList.toggle('step-active', Number(section.dataset.step) === step);
    });

    document.querySelectorAll('.stepper-item').forEach(item => {
      const itemStep = Number(item.dataset.step);
      item.classList.toggle('is-active', itemStep === step);
      item.classList.toggle('is-done', itemStep < step);
    });

    if (step === 3) renderResumen();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ===================== Paso 1: Cliente =====================
  $('btn-to-step2').addEventListener('click', () => {
    state.cliente.nombre    = $('cliente-nombre').value.trim();
    state.cliente.telefono  = $('cliente-telefono').value.trim();
    state.cliente.notas     = $('cliente-notas').value.trim();
    goToStep(2);
  });

  // ===================== Paso 2: Pedido =====================
  async function loadProducts() {
    const grid = $('product-grid');
    const pageError = $('products-error');

    const { ok, data } = await api.get('/products');

    if (!ok) {
      pageError.textContent = data.message || 'No se pudo cargar el catálogo.';
      pageError.style.display = 'block';
      grid.innerHTML = '<p class="empty-state">No se pudo cargar el catálogo.</p>';
      return;
    }

    pageError.style.display = 'none';

    // Solo se muestran productos activos: son los únicos disponibles para la venta.
    PRODUCTS = data.filter(p => p.active);

    renderProductGrid();
  }

  function renderProductGrid() {
    const grid = $('product-grid');

    if (!PRODUCTS.length) {
      grid.innerHTML = '<p class="empty-state">No hay productos disponibles.</p>';
      return;
    }

    grid.innerHTML = '';
    PRODUCTS.forEach(product => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'product-card';
      card.innerHTML = `
        <div class="product-thumb">
          ${product.hasImage
            ? `<img src="/api/products/${product.id}/image" alt="${escapeHtml(product.name)}">`
            : `<span class="placeholder-icon">🍽️</span>`}
        </div>
        <div class="product-body">
          <div class="product-name">${escapeHtml(product.name)}</div>
          <div class="product-price">${money(product.price)}</div>
        </div>
      `;
      card.addEventListener('click', () => {
        state.carrito[product.id] = (state.carrito[product.id] || 0) + 1;
        renderCart();
      });
      grid.appendChild(card);
    });
  }

  function changeQty(productId, delta) {
    const next = (state.carrito[productId] || 0) + delta;
    state.carrito[productId] = Math.max(0, next);
    renderCart();
  }

  function renderCart() {
    const container = $('cart-items');
    const items = carritoItems();

    if (items.length === 0) {
      container.innerHTML = '<p class="empty-state">Todavía no has agregado productos.</p>';
    } else {
      container.innerHTML = '';
      items.forEach(item => {
        const row = document.createElement('div');
        row.className = 'cart-item';
        row.innerHTML = `
          <div>
            <div class="cart-item-name">${item.name}</div>
            <div class="cart-item-price">${money(item.price)} c/u</div>
          </div>
          <div class="qty-control">
            <button type="button" class="qty-btn" data-action="dec">−</button>
            <span class="qty-value">${item.qty}</span>
            <button type="button" class="qty-btn" data-action="inc">+</button>
          </div>
        `;
        row.querySelector('[data-action="dec"]').addEventListener('click', () => changeQty(item.id, -1));
        row.querySelector('[data-action="inc"]').addEventListener('click', () => changeQty(item.id, 1));
        container.appendChild(row);
      });
    }

    $('cart-subtotal').textContent = money(subtotal());
  }

  $('btn-to-step1').addEventListener('click', () => goToStep(1));

  $('btn-to-step3').addEventListener('click', () => {
    if (carritoItems().length === 0) {
      alert('Agregá al menos un producto para continuar.');
      return;
    }
    goToStep(3);
  });

  // ===================== Paso 3: Resumen =====================
  document.querySelectorAll('#pago-options .option-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#pago-options .option-btn').forEach(b => b.classList.remove('is-selected'));
      btn.classList.add('is-selected');
      state.metodoPago = btn.dataset.value;
      $('pago-error').textContent = '';
    });
  });

  function renderResumen() {
    const dl = $('resumen-cliente');
    dl.innerHTML = `
      <dt>Nombre</dt><dd>${state.cliente.nombre}</dd>
      <dt>Teléfono</dt><dd>${state.cliente.telefono || '—'}</dd>
      ${state.cliente.notas ? `<dt>Notas</dt><dd>${state.cliente.notas}</dd>` : ''}
    `;

    const itemsContainer = $('resumen-items');
    itemsContainer.innerHTML = '';
    carritoItems().forEach(item => {
      const row = document.createElement('div');
      row.className = 'cart-item';
      row.innerHTML = `
        <div class="cart-item-name">${item.qty} × ${item.name}</div>
        <div class="cart-item-price">${money(item.price * item.qty)}</div>
      `;
      itemsContainer.appendChild(row);
    });

    const sub = subtotal();
    const iva = Math.round(sub * IVA_RATE);
    const total = sub + iva;

    $('resumen-subtotal').textContent = money(sub);
    $('resumen-iva').textContent      = money(iva);
    $('resumen-total').textContent    = money(total);
  }

  $('btn-to-step2-back').addEventListener('click', () => goToStep(2));

  $('btn-confirmar').addEventListener('click', () => {
    if (!state.metodoPago) {
      $('pago-error').textContent = 'Elegí un método de pago para confirmar la venta.';
      return;
    }

    // TODO: reemplazar por POST /api/sales cuando exista el módulo de ventas.
    console.log('Venta (mock):', {
      cliente: state.cliente,
      items: carritoItems(),
      metodoPago: state.metodoPago,
      subtotal: subtotal(),
    });

    alert('Cascarón de venta completo. Todavía falta conectar el backend.');
  });

  // ===================== Init =====================
  loadProducts();
  renderCart();
  goToStep(1);
});