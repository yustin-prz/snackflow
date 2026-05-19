let currentStep = 1;
let verifiedUsername = '';

function openForgotModal() {
  currentStep = 1;
  verifiedUsername = '';
  showStep(1);
  document.getElementById('forgot-username').value = '';
  document.getElementById('forgot-token').value = '';
  document.getElementById('forgot-new-password').value = '';
  document.getElementById('forgot-confirm-password').value = '';
  hideMessages();
  document.getElementById('forgot-modal').classList.add('active');
}

function closeForgotModal() {
  document.getElementById('forgot-modal').classList.remove('active');
}

function showStep(step) {
  for (let i = 1; i <= 3; i++) {
    const el = document.getElementById(`step-${i}`);
    if (el) el.style.display = i === step ? 'block' : 'none';

    const indicator = document.getElementById(`step-ind-${i}`);
    if (indicator) {
      indicator.className = 'step';
      if (i < step)  indicator.classList.add('done');
      if (i === step) indicator.classList.add('active');
    }
  }
}

function hideMessages() {
  document.querySelectorAll('.modal .error-msg, .modal .success-msg').forEach(el => {
    el.style.display = 'none';
    el.textContent = '';
  });
}

function showError(id, msg) {
  hideMessages();
  const el = document.getElementById(id);
  el.textContent = msg;
  el.style.display = 'block';
}

function showSuccess(id, msg) {
  hideMessages();
  const el = document.getElementById(id);
  el.textContent = msg;
  el.style.display = 'block';
}

// Paso 1 — Verificar usuario y mostrar QR
async function submitForgotUsername() {
  const username = document.getElementById('forgot-username').value.trim();
  if (!username) return showError('forgot-error-1', 'Ingresá tu nombre de usuario.');

  try {
    const token = localStorage.getItem('token');
    const res = await fetch('/api/auth/setup-totp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Setup TOTP requiere token — solo si ya está autenticado
        // Para recuperación sin sesión usamos el endpoint público
      }
    });

    // Para recuperación de contraseña no necesitamos setup-totp
    // Solo verificamos que el usuario existe pasando al paso 2
    verifiedUsername = username;
    currentStep = 2;
    showStep(2);
    hideMessages();

  } catch(e) {
    showError('forgot-error-1', 'Error al conectar con el servidor.');
  }
}

// Paso 2 — Verificar código TOTP y nueva contraseña
async function submitForgotReset() {
  const token       = document.getElementById('forgot-token').value.trim();
  const newPassword = document.getElementById('forgot-new-password').value;
  const confirmPass = document.getElementById('forgot-confirm-password').value;

  if (!token)       return showError('forgot-error-2', 'Ingresá el código de Google Authenticator.');
  if (token.length !== 6) return showError('forgot-error-2', 'El código debe tener 6 dígitos.');
  if (!newPassword) return showError('forgot-error-2', 'Ingresá la nueva contraseña.');
  if (newPassword.length < 6) return showError('forgot-error-2', 'La contraseña debe tener al menos 6 caracteres.');
  if (newPassword !== confirmPass) return showError('forgot-error-2', 'Las contraseñas no coinciden.');

  try {
    const { ok, data } = await api.post('/auth/reset-password', {
      username: verifiedUsername,
      token,
      newPassword
    });

    if (ok) {
      currentStep = 3;
      showStep(3);
    } else {
      showError('forgot-error-2', data.message || 'Código incorrecto.');
    }
  } catch(e) {
    showError('forgot-error-2', 'Error al conectar con el servidor.');
  }
}

// Cerrar con Escape
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeForgotModal();
});