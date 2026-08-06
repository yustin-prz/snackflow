document.addEventListener('DOMContentLoaded', () => {
  auth.requireAuth();

  const user = auth.getUser();
  document.getElementById('user-name').textContent  = user.full_name || user.username;
  document.getElementById('role-badge').textContent = user.role === 'admin' ? 'Administrador' : 'Cajero';

  // ===================== Catálogo =====================
  // Productos reales del backend (mismo endpoint que usa /products.html).
  let PRODUCTS = [];

  const IVA_RATE = 0.13;

  // Reglas de negocio del descuento manual (HU-05) y la promo 2x1 (HU-06).
  // "Total de la venta" = suma de los productos, que ya incluyen el IVA
  // (mismo criterio que usa sale.service.js en el backend).
  const DESCUENTO_MAX_PORCENTAJE = 10;
  const DESCUENTO_MINIMO_VENTA = 10000;
  const DESCUENTO_MINIMO_PRODUCTOS_DISTINTOS = 3;
  const NOMBRE_PRODUCTO_PROMO_2X1 = 'gelatina'; // coincide con "Gelatinas" u otra variante que contenga esta palabra

  // ===================== Estado del wizard =====================
  const state = {
    step: 1,
    cliente: { nombre: '', telefono: '', notas: '' },
    carrito: {},   // { [productId]: cantidad }
    metodoPago: null,
    // tipo: null | 'manual' | '2x1'. Son mutuamente excluyentes: nunca puede
    // haber más de una promoción/descuento activo en la misma venta.
    descuento: { tipo: null, monto: 0, porcentaje: null },
  };

  // ===================== Helpers =====================
  const $ = (id) => document.getElementById(id);
  const money = (n) => '₡' + Number(n).toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const round2 = (n) => Math.round(n * 100) / 100;

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

  // Suma de los productos del carrito, ya con IVA incluido (mismo criterio
  // que "itemsTotal" en sale.service.js). Es el monto sobre el que se evalúan
  // las reglas del descuento manual y se calcula la promo 2x1.
  function subtotal() {
    return carritoItems().reduce((sum, item) => sum + item.price * item.qty, 0);
  }

  // ===================== Promociones / descuento =====================

  // Busca el ítem de Gelatina en el carrito (comparación insensible a mayúsculas/espacios).
  function itemGelatina() {
    return carritoItems().find(i => i.name && i.name.trim().toLowerCase().includes(NOMBRE_PRODUCTO_PROMO_2X1));
  }

  // 2x1 de Gelatina: por cada par de unidades, se descuenta el precio de una
  // (4 gelatinas = 2 pares = se descuentan 2; 3 gelatinas = 1 par = se descuenta 1, la tercera se cobra completa).
  function calcularPromo2x1() {
    const item = itemGelatina();
    if (!item || item.qty < 2) return { activa: false, monto: 0 };
    const pares = Math.floor(item.qty / 2);
    return { activa: true, monto: round2(pares * Number(item.price)) };
  }

  // Requisitos para poder ingresar un descuento manual: al menos 3 productos
  // DIFERENTES en la venta y un total (con IVA incluido) de al menos ₡10,000.
  function descuentoManualDisponible() {
    return carritoItems().length >= DESCUENTO_MINIMO_PRODUCTOS_DISTINTOS && subtotal() >= DESCUENTO_MINIMO_VENTA;
  }

  // Mantiene state.descuento coherente con el carrito actual. Se llama cada
  // vez que el carrito cambia y al entrar al resumen. Las promociones son
  // mutuamente excluyentes: si ya hay un descuento manual aplicado, la 2x1
  // no se activa sola, y si el carrito deja de cumplir los requisitos del
  // descuento manual (o de la 2x1), la promoción se desactiva automáticamente.
  function sincronizarDescuento() {
    if (state.descuento.tipo === 'manual') {
      if (!descuentoManualDisponible()) {
        state.descuento = { tipo: null, monto: 0, porcentaje: null };
      }
      return; // un descuento manual activo nunca es reemplazado por la 2x1
    }

    const promo2x1 = calcularPromo2x1();
    if (promo2x1.activa) {
      state.descuento = { tipo: '2x1', monto: promo2x1.monto, porcentaje: null };
    } else if (state.descuento.tipo === '2x1') {
      state.descuento = { tipo: null, monto: 0, porcentaje: null };
    }
  }

  // Calcula los montos a mostrar en el resumen. Los precios de los productos
  // ya incluyen IVA, así que: se le resta el descuento al total de productos
  // (todo en montos con IVA incluido), y recién de ese resultado final se
  // desglosa el subtotal sin IVA y el IVA — mismo criterio que recalculateSale()
  // en el backend.
  function totales() {
    const raw = subtotal(); // suma de productos, con IVA incluido, antes de descuento
    const base = round2(Math.max(0, raw - state.descuento.monto)); // lo que se cobra, con IVA incluido
    const subtotalSinIva = round2(base / (1 + IVA_RATE));
    const iva = round2(base - subtotalSinIva);
    return { raw, descuento: state.descuento.monto, subtotal: subtotalSinIva, iva, total: base };
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
            ? `<img src="/api/products/${product.id}/image?v=${product.imageVersion}" alt="${escapeHtml(product.name)}">`
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
    sincronizarDescuento();

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

    $('cart-promo-badge').style.display = state.descuento.tipo === '2x1' ? 'block' : 'none';
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

  $('btn-aplicar-descuento').addEventListener('click', () => {
    const errorEl = $('descuento-error');
    errorEl.textContent = '';

    if (state.descuento.tipo === '2x1') {
      errorEl.textContent = 'Esta venta ya tiene la promoción 2x1 de Gelatina aplicada; no se puede combinar con otro descuento.';
      return;
    }

    if (!descuentoManualDisponible()) {
      errorEl.textContent = `El descuento requiere al menos ${DESCUENTO_MINIMO_PRODUCTOS_DISTINTOS} productos diferentes y un total de ${money(DESCUENTO_MINIMO_VENTA)} o más.`;
      return;
    }

    const porcentaje = Number($('descuento-input').value);

    if (!porcentaje || porcentaje <= 0) {
      errorEl.textContent = 'Ingresá un porcentaje de descuento válido.';
      return;
    }

    if (porcentaje > DESCUENTO_MAX_PORCENTAJE) {
      errorEl.textContent = `El descuento no puede superar el ${DESCUENTO_MAX_PORCENTAJE}% del total de la venta.`;
      return;
    }

    state.descuento = {
      tipo: 'manual',
      porcentaje,
      monto: round2(subtotal() * (porcentaje / 100)),
    };
    renderResumen();
  });

  $('btn-quitar-descuento').addEventListener('click', () => {
    state.descuento = { tipo: null, monto: 0, porcentaje: null };
    $('descuento-input').value = '';
    renderResumen();
  });

  document.querySelectorAll('#pago-options .option-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#pago-options .option-btn').forEach(b => b.classList.remove('is-selected'));
      btn.classList.add('is-selected');
      state.metodoPago = btn.dataset.value;
      $('pago-error').textContent = '';
    });
  });

  function renderResumen() {
    sincronizarDescuento();

    const dl = $('resumen-cliente');
    dl.innerHTML = `
      <dt>Nombre</dt><dd>${state.cliente.nombre || '—'}</dd>
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

    const t = totales();

    // Filas de "Productos" (antes de descuento) y "Descuento" solo se
    // muestran cuando hay una promoción activa; si no, el resumen se ve
    // exactamente igual que antes de esta funcionalidad.
    const productosRow = $('resumen-productos-row');
    const descuentoRow = $('resumen-descuento-row');

    if (state.descuento.tipo) {
      productosRow.style.display = 'flex';
      $('resumen-productos').textContent = money(t.raw);

      descuentoRow.style.display = 'flex';
      $('resumen-descuento-label').textContent = state.descuento.tipo === '2x1'
        ? 'Promoción 2x1 Gelatina'
        : `Descuento (${state.descuento.porcentaje}%)`;
      $('resumen-descuento').textContent = '−' + money(t.descuento);
    } else {
      productosRow.style.display = 'none';
      descuentoRow.style.display = 'none';
    }

    $('resumen-subtotal').textContent = money(t.subtotal);
    $('resumen-iva').textContent      = money(t.iva);
    $('resumen-total').textContent    = money(t.total);

    renderDescuentoUI();
  }

  // Controla los distintos estados del bloque "Descuento manual": disponible,
  // no disponible (con el motivo), aplicado, o bloqueado por la promo 2x1.
  function renderDescuentoUI() {
    const rowInput    = $('descuento-row-input');
    const rowAplicado = $('descuento-aplicado-row');
    const hint        = $('descuento-hint');
    const input       = $('descuento-input');
    const applyBtn    = $('btn-aplicar-descuento');

    $('descuento-error').textContent = '';

    if (state.descuento.tipo === 'manual') {
      rowInput.style.display = 'none';
      rowAplicado.style.display = 'flex';
      $('descuento-aplicado-texto').textContent =
        `Descuento del ${state.descuento.porcentaje}% aplicado (−${money(state.descuento.monto)})`;
      hint.textContent = '';
      return;
    }

    rowAplicado.style.display = 'none';
    rowInput.style.display = 'flex';

    if (state.descuento.tipo === '2x1') {
      input.disabled = true;
      applyBtn.disabled = true;
      hint.textContent = 'Esta venta ya tiene la promoción 2x1 de Gelatina aplicada; no se puede combinar con otro descuento.';
      return;
    }

    if (!descuentoManualDisponible()) {
      input.disabled = true;
      applyBtn.disabled = true;
      hint.textContent = `Disponible con ${DESCUENTO_MINIMO_PRODUCTOS_DISTINTOS}+ productos diferentes y un total desde ${money(DESCUENTO_MINIMO_VENTA)}.`;
      return;
    }

    input.disabled = false;
    applyBtn.disabled = false;
    hint.textContent = `Podés aplicar hasta un ${DESCUENTO_MAX_PORCENTAJE}% de descuento.`;
  }

  $('btn-to-step2-back').addEventListener('click', () => goToStep(2));

  // Vuelve el wizard a su estado inicial para poder registrar otra venta.
  function resetWizard() {
    state.cliente = { nombre: '', telefono: '', notas: '' };
    state.carrito = {};
    state.metodoPago = null;
    state.descuento = { tipo: null, monto: 0, porcentaje: null };

    $('cliente-nombre').value = '';
    $('cliente-telefono').value = '';
    $('cliente-notas').value = '';
    $('descuento-input').value = '';
    document.querySelectorAll('#pago-options .option-btn').forEach(b => b.classList.remove('is-selected'));
    $('pago-error').textContent = '';
    $('descuento-error').textContent = '';

    renderCart();
    goToStep(1);
  }

  $('btn-confirmar').addEventListener('click', async () => {
    if (!state.metodoPago) {
      $('pago-error').textContent = 'Elegí un método de pago para confirmar la venta.';
      return;
    }

    const btn = $('btn-confirmar');
    $('pago-error').textContent = '';
    btn.disabled = true;
    btn.textContent = 'Guardando...';

    try {
      // 1. Crear el encabezado de la venta (el usuario se toma del token en el backend)
      const { ok: okSale, data: saleData } = await api.post('/sales', {
        customer_name: state.cliente.nombre || null,
        customer_phone: state.cliente.telefono || null,
        notes: state.cliente.notas || null
      });
      if (!okSale) throw new Error(saleData.message || 'No se pudo crear la venta.');

      const saleId = saleData.id;

      // 2. Agregar cada producto del carrito a la venta.
      // La 2x1 de Gelatina no requiere ningún paso extra: el backend la
      // detecta sola, recalculando la venta automáticamente cada vez que
      // se agrega un ítem.
      for (const item of carritoItems()) {
        const { ok: okItem, data: itemData } = await api.post(`/sales/${saleId}/items`, {
          product_id: item.id,
          quantity: item.qty
        });
        if (!okItem) throw new Error(itemData.message || `No se pudo agregar "${item.name}" a la venta.`);
      }

      // 3. Si se aplicó un descuento manual, se manda al backend antes de
      // cerrar la venta. El backend vuelve a validar todos los requisitos
      // (3+ productos distintos, total mínimo, tope de 10%, sin otra
      // promoción activa) — la validación del frontend es solo para la
      // experiencia del cajero, la que realmente cuenta es esta.
      if (state.descuento.tipo === 'manual') {
        const { ok: okDescuento, data: descuentoData } = await api.post(`/sales/${saleId}/discount`, {
          percentage: state.descuento.porcentaje
        });
        if (!okDescuento) throw new Error(descuentoData.message || 'No se pudo aplicar el descuento.');
      }

      // 4. Cerrar la venta con el método de pago elegido. El total que
      // devuelve ya viene con el descuento/promoción incluido (calculado en
      // el backend).
      const paymentMethod = state.metodoPago === 'tarjeta' ? 'card' : 'cash';
      const { ok: okComplete, data: completeData } = await api.patch(`/sales/${saleId}/complete`, {
        payment_method: paymentMethod
      });
      if (!okComplete) throw new Error(completeData.message || 'No se pudo cerrar la venta.');

      alert(`Venta #${saleId} registrada correctamente. Total: ${money(completeData.total)}`);
      resetWizard();
    } catch (e) {
      $('pago-error').textContent = e.message || 'Ocurrió un error al registrar la venta.';
    } finally {
      btn.disabled = false;
      btn.textContent = 'Confirmar venta';
    }
  });

  // ===================== Init =====================
  loadProducts();
  renderCart();
  goToStep(1);
});