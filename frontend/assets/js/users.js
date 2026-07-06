let currentUserId = null;
let pendingStatusAction = null; // { id, active }

document.addEventListener('DOMContentLoaded', () => {
  auth.requireAuth();
  auth.requireAdmin();

  const user = auth.getUser();
  document.getElementById('user-name').textContent = user.full_name || user.username;
  document.getElementById('role-badge').textContent = 'Administrador';

  loadUsers();
});

function formatDeadline(deadline) {
  if (!deadline) return '';
  return new Date(deadline).toLocaleString('es-CR', { dateStyle: 'short', timeStyle: 'short' });
}

async function loadUsers() {
  const { ok, data } = await api.get('/users');
  const tbody = document.getElementById('users-table');
  const pageError = document.getElementById('page-error');
  const myId = auth.getUser().id;

  if (!ok) {
    pageError.textContent = data.message || 'No se pudo cargar la lista de usuarios.';
    pageError.style.display = 'block';
    tbody.innerHTML = '<tr><td colspan="8" class="empty-state">No se pudo cargar la lista.</td></tr>';
    return;
  }

  pageError.style.display = 'none';

  if (!data.length) {
    tbody.innerHTML = '<tr><td colspan="8" class="empty-state">No hay usuarios registrados.</td></tr>';
    return;
  }

  tbody.innerHTML = data.map(u => {
    const isSelf = u.id === myId;
    const twoFaBadge = u.totp_confirmed
      ? '<span class="status active">Confirmado</span>'
      : `<div class="twofa-cell">
          <span class="status pending">Pendiente</span>
          ${u.totp_setup_deadline ? `<span class="twofa-deadline">hasta ${formatDeadline(u.totp_setup_deadline)}</span>` : ''}
        </div>`;

    const statusBtn = isSelf
      ? ''
      : (u.active
          ? `<button class="link-btn deactivate" onclick='openConfirmModal(${JSON.stringify({ id: u.id, active: false, full_name: u.full_name })})'>Desactivar</button>`
          : `<button class="link-btn activate" onclick='openConfirmModal(${JSON.stringify({ id: u.id, active: true, full_name: u.full_name })})'>Activar</button>`);

    const qrBtn = !u.totp_confirmed
      ? `<button class="link-btn qr" onclick="viewQr(${u.id})">Ver QR</button>`
      : '';

    return `
    <tr>
      <td>${u.id}</td>
      <td class="truncate" title="${escapeHtml(u.username)}">${escapeHtml(u.username)}</td>
      <td class="truncate" title="${escapeHtml(u.email)}">${escapeHtml(u.email)}</td>
      <td class="truncate" title="${escapeHtml(u.full_name)}">${escapeHtml(u.full_name)}</td>
      <td><span class="role-tag ${u.role}">${u.role === 'admin' ? 'Administrador' : 'Cajero'}</span></td>
      <td><span class="status ${u.active ? 'active' : 'inactive'}">${u.active ? 'Activo' : 'Inactivo'}</span></td>
      <td>${twoFaBadge}</td>
      <td>
        <div class="table-actions">
          <button class="link-btn edit" onclick='openEditModal(${JSON.stringify(u)})'>Editar</button>
          ${qrBtn}
          ${statusBtn}
        </div>
      </td>
    </tr>
  `;
  }).join('');
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function openCreateModal() {
  currentUserId = null;
  document.getElementById('modal-title').textContent = 'Nuevo usuario';
  document.getElementById('user-id').value = '';
  document.getElementById('user-username').value = '';
  document.getElementById('user-username').disabled = false;
  document.getElementById('user-email').value = '';
  document.getElementById('user-fullname').value = '';
  document.getElementById('user-role').value = 'cashier';
  document.getElementById('user-password').value = '';
  document.getElementById('password-field-wrapper').style.display = 'none';
  document.getElementById('create-password-note').style.display = 'block';
  document.getElementById('modal-error').style.display = 'none';
  document.getElementById('user-modal').classList.add('active');
}

function openEditModal(u) {
  currentUserId = u.id;
  document.getElementById('modal-title').textContent = 'Editar usuario';
  document.getElementById('user-id').value = u.id;
  document.getElementById('user-username').value = u.username;
  document.getElementById('user-username').disabled = true;
  document.getElementById('user-email').value = u.email;
  document.getElementById('user-fullname').value = u.full_name;
  document.getElementById('user-role').value = u.role;
  document.getElementById('user-password').value = '';
  document.getElementById('password-field-wrapper').style.display = 'block';
  document.getElementById('create-password-note').style.display = 'none';
  document.getElementById('modal-error').style.display = 'none';
  document.getElementById('user-modal').classList.add('active');
}

function closeUserModal() {
  document.getElementById('user-modal').classList.remove('active');
}

async function submitUserForm() {
  const modalError = document.getElementById('modal-error');
  modalError.style.display = 'none';

  const full_name = document.getElementById('user-fullname').value.trim();
  const email = document.getElementById('user-email').value.trim();
  const role = document.getElementById('user-role').value;
  const password = document.getElementById('user-password').value;

  let result;
  const isCreate = !currentUserId;
  if (currentUserId) {
    const body = { full_name, email, role };
    if (password) body.password = password;
    result = await api.put(`/users/${currentUserId}`, body);
  } else {
    const username = document.getElementById('user-username').value.trim();
    result = await api.post('/users', { username, email, full_name, role });
  }

  if (!result.ok) {
    modalError.textContent = result.data.message || 'Ocurrió un error.';
    modalError.style.display = 'block';
    return;
  }

  closeUserModal();
  loadUsers();

  if (isCreate) alert(result.data.message || `Se envió un correo a ${email} con la contraseña temporal.`);
}

function openQrModal(user, isNew) {
  document.getElementById('qr-username').textContent = user.full_name || user.username;
  document.getElementById('qr-image').src = user.qrCode;
  document.getElementById('qr-secret').textContent = user.secret;

  const warning = document.getElementById('qr-deadline-warning');
  if (!user.totp_confirmed && user.totp_setup_deadline) {
    warning.textContent = `Tiene hasta el ${formatDeadline(user.totp_setup_deadline)} (24 horas) para escanear el código. Si no lo hace, el sistema desactivará su cuenta automáticamente.`;
    warning.classList.add('show');
  } else {
    warning.classList.remove('show');
  }

  document.getElementById('qr-modal').classList.add('active');
}

function closeQrModal() {
  document.getElementById('qr-modal').classList.remove('active');
}

async function viewQr(id) {
  const { ok, data } = await api.get(`/users/${id}/qr`);
  if (!ok) {
    alert(data.message || 'No se pudo obtener el QR.');
    return;
  }
  openQrModal(data, false);
}

function openConfirmModal({ id, active, full_name }) {
  pendingStatusAction = { id, active };
  document.getElementById('confirm-title').textContent = active ? 'Activar usuario' : 'Desactivar usuario';
  document.getElementById('confirm-desc').textContent = active
    ? `¿Confirmás que querés activar a ${full_name}? Ingresá tu código de Google Authenticator para continuar.`
    : `¿Confirmás que querés desactivar a ${full_name}? Ya no podrá iniciar sesión. Ingresá tu código de Google Authenticator para continuar.`;
  document.getElementById('confirm-btn').textContent = active ? 'Activar' : 'Desactivar';
  document.getElementById('confirm-totp').value = '';
  document.getElementById('confirm-error').style.display = 'none';
  document.getElementById('confirm-modal').classList.add('active');
  setTimeout(() => document.getElementById('confirm-totp').focus(), 100);
}

function closeConfirmModal() {
  document.getElementById('confirm-modal').classList.remove('active');
  pendingStatusAction = null;
}

async function submitConfirmAction() {
  if (!pendingStatusAction) return;
  const errorEl = document.getElementById('confirm-error');
  const totpToken = document.getElementById('confirm-totp').value.trim();

  if (!totpToken || totpToken.length !== 6) {
    errorEl.textContent = 'El código debe tener 6 dígitos.';
    errorEl.style.display = 'block';
    return;
  }

  const { id, active } = pendingStatusAction;
  const { ok, data } = await api.patch(`/users/${id}/status`, { active, totpToken });

  if (!ok) {
    errorEl.textContent = data.message || 'Ocurrió un error.';
    errorEl.style.display = 'block';
    return;
  }

  closeConfirmModal();
  loadUsers();
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { closeConfirmModal(); closeQrModal(); }
  if (e.key === 'Enter' && document.getElementById('confirm-modal').classList.contains('active')) {
    submitConfirmAction();
  }
});
