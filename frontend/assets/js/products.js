let currentProductId = null;
let selectedImageDataUrl = undefined; // undefined = sin cambios, null = quitar, string = nueva imagen
let isAdmin = false;

document.addEventListener('DOMContentLoaded', () => {
  auth.requireAuth();

  const user = auth.getUser();
  isAdmin = user.role === 'admin';
  document.getElementById('user-name').textContent = user.full_name || user.username;
  document.getElementById('role-badge').textContent = isAdmin ? 'Administrador' : 'Cajero';
  if (isAdmin) document.getElementById('new-product-btn').style.display = 'inline-block';

  loadProducts();
});

function formatPrice(price) {
  return '₡' + Number(price).toLocaleString('es-CR', { minimumFractionDigits: 0 });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

async function loadProducts() {
  const { ok, data } = await api.get('/products');
  const grid = document.getElementById('products-grid');
  const pageError = document.getElementById('page-error');

  if (!ok) {
    pageError.textContent = data.message || 'No se pudo cargar el catálogo.';
    pageError.style.display = 'block';
    grid.innerHTML = '<p class="empty-state">No se pudo cargar el catálogo.</p>';
    return;
  }

  pageError.style.display = 'none';

  if (!data.length) {
    grid.innerHTML = '<p class="empty-state">No hay productos registrados.</p>';
    return;
  }

  grid.innerHTML = data.map(p => `
    <div class="product-card ${p.active ? '' : 'inactive'}">
      <div class="product-thumb">
        ${p.hasImage
          ? `<img src="/api/products/${p.id}/image" alt="${escapeHtml(p.name)}">`
          : `<span class="placeholder-icon">🍽️</span>`}
      </div>
      <div class="product-body">
        <span class="product-name">${escapeHtml(p.name)}</span>
        <span class="product-price">${formatPrice(p.price)}</span>
        <span class="status ${p.active ? 'active' : 'inactive'}">${p.active ? 'Activo' : 'Inactivo'}</span>
        ${isAdmin ? `
          <div class="product-actions">
            <button class="link-btn edit" onclick="openEditModal(${p.id})">Editar</button>
            <button class="link-btn deactivate" onclick="deleteProduct(${p.id}, '${escapeHtml(p.name).replace(/'/g, "\\'")}')">Eliminar</button>
          </div>
        ` : ''}
      </div>
    </div>
  `).join('');
}

function resetImageState() {
  selectedImageDataUrl = undefined;
  document.getElementById('product-image-input').value = '';
  document.getElementById('product-image-preview-wrapper').style.display = 'none';
  document.getElementById('product-image-preview').src = '';
}

function openCreateModal() {
  currentProductId = null;
  document.getElementById('product-modal-title').textContent = 'Nuevo producto';
  document.getElementById('product-id').value = '';
  document.getElementById('product-name').value = '';
  document.getElementById('product-price').value = '';
  document.getElementById('product-active').checked = true;
  document.getElementById('product-modal-error').style.display = 'none';
  resetImageState();
  document.getElementById('product-modal').classList.add('active');
}

async function openEditModal(id) {
  const { ok, data } = await api.get(`/products/${id}`);
  if (!ok) {
    alert(data.message || 'No se pudo cargar el producto.');
    return;
  }

  currentProductId = data.id;
  document.getElementById('product-modal-title').textContent = 'Editar producto';
  document.getElementById('product-id').value = data.id;
  document.getElementById('product-name').value = data.name;
  document.getElementById('product-price').value = data.price;
  document.getElementById('product-active').checked = data.active;
  document.getElementById('product-modal-error').style.display = 'none';
  resetImageState();

  if (data.image) {
    document.getElementById('product-image-preview').src = data.image;
    document.getElementById('product-image-preview-wrapper').style.display = 'flex';
  }

  document.getElementById('product-modal').classList.add('active');
}

function closeProductModal() {
  document.getElementById('product-modal').classList.remove('active');
}

const MAX_IMAGE_DIMENSION = 500; // px, en el lado más largo
const IMAGE_JPEG_QUALITY = 0.75;

// Redimensiona y comprime la imagen en el navegador antes de convertirla a base64,
// para que la BD no crezca varios MB por cada foto que suba un admin.
function compressImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      let { width, height } = img;
      if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION) {
        const scale = MAX_IMAGE_DIMENSION / Math.max(width, height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);

      resolve(canvas.toDataURL('image/jpeg', IMAGE_JPEG_QUALITY));
    };
    img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('No se pudo leer la imagen.')); };
    img.src = objectUrl;
  });
}

async function handleImageSelect(event) {
  const file = event.target.files[0];
  if (!file) return;

  if (file.size > 8 * 1024 * 1024) {
    alert('La imagen es demasiado grande (máximo 8MB antes de comprimir).');
    event.target.value = '';
    return;
  }

  try {
    selectedImageDataUrl = await compressImage(file);
    document.getElementById('product-image-preview').src = selectedImageDataUrl;
    document.getElementById('product-image-preview-wrapper').style.display = 'flex';
  } catch (e) {
    alert(e.message);
    event.target.value = '';
  }
}

function removeImage() {
  selectedImageDataUrl = null;
  document.getElementById('product-image-input').value = '';
  document.getElementById('product-image-preview-wrapper').style.display = 'none';
  document.getElementById('product-image-preview').src = '';
}

async function submitProductForm() {
  const modalError = document.getElementById('product-modal-error');
  modalError.style.display = 'none';

  const name = document.getElementById('product-name').value.trim();
  const price = document.getElementById('product-price').value;
  const active = document.getElementById('product-active').checked;

  const body = { name, price, active };
  if (selectedImageDataUrl !== undefined) body.image = selectedImageDataUrl;

  const result = currentProductId
    ? await api.put(`/products/${currentProductId}`, body)
    : await api.post('/products', body);

  if (!result.ok) {
    modalError.textContent = result.data.message || 'Ocurrió un error.';
    modalError.style.display = 'block';
    return;
  }

  closeProductModal();
  loadProducts();
}

async function deleteProduct(id, name) {
  const confirmed = confirm(`¿Eliminar "${name}" permanentemente? Esta acción no se puede deshacer y borra el producto de la base de datos.`);
  if (!confirmed) return;

  const { ok, data } = await api.del(`/products/${id}`);
  if (!ok) {
    alert(data.message || 'No se pudo eliminar el producto.');
    return;
  }
  loadProducts();
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && document.getElementById('product-modal').classList.contains('active')) {
    closeProductModal();
  }
});
