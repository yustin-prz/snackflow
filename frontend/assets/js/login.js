let pendingUsername = '';
let pendingPassword = '';

async function login() {
  const username = document.getElementById('username').value.trim();
  const password  = document.getElementById('password').value;
  const errorMsg  = document.getElementById('error-msg');
  errorMsg.style.display = 'none';

  if (!username || !password) {
    errorMsg.textContent = 'Por favor completá todos los campos.';
    errorMsg.style.display = 'block';
    return;
  }

  await attemptLogin(username, password);
}

async function attemptLogin(username, password) {
  const errorMsg = document.getElementById('error-msg');

  try {
    const { ok, data } = await api.post('/auth/login', { username, password });
    if (ok && data.token) {
      localStorage.setItem('token', data.token);
      window.location.href = '/dashboard.html';
    } else if (data.mustChangePassword) {
      pendingUsername = username;
      pendingPassword = password;
      openChangePasswordModal();
    } else if (data.requireTotp) {
      pendingUsername = username;
      pendingPassword = password;
      openTotpModal(data);
    } else {
      errorMsg.textContent = data.message || 'Usuario o contraseña incorrectos.';
      errorMsg.style.display = 'block';
    }
  } catch(e) {
    errorMsg.textContent = 'No se pudo conectar con el servidor.';
    errorMsg.style.display = 'block';
  }
}

function openChangePasswordModal() {
  document.getElementById('change-new-password').value = '';
  document.getElementById('change-confirm-password').value = '';
  document.getElementById('change-temp-password').value = '';
  document.getElementById('error-msg-change-password').style.display = 'none';
  document.getElementById('change-password-modal').classList.add('active');
}

function closeChangePasswordModal() {
  document.getElementById('change-password-modal').classList.remove('active');
}

async function submitChangePassword() {
  const errorMsg = document.getElementById('error-msg-change-password');
  errorMsg.style.display = 'none';

  const newPassword = document.getElementById('change-new-password').value;
  const confirmPassword = document.getElementById('change-confirm-password').value;
  const tempPassword = document.getElementById('change-temp-password').value;

  if (!newPassword || !confirmPassword || !tempPassword) {
    errorMsg.textContent = 'Completá todos los campos.';
    errorMsg.style.display = 'block';
    return;
  }
  if (newPassword !== confirmPassword) {
    errorMsg.textContent = 'Las contraseñas nuevas no coinciden.';
    errorMsg.style.display = 'block';
    return;
  }
  if (newPassword.length < 6) {
    errorMsg.textContent = 'La contraseña debe tener al menos 6 caracteres.';
    errorMsg.style.display = 'block';
    return;
  }

  try {
    const { ok, data } = await api.post('/auth/change-temp-password', {
      username: pendingUsername, tempPassword, newPassword, confirmPassword
    });
    if (!ok) {
      errorMsg.textContent = data.message || 'No se pudo cambiar la contraseña.';
      errorMsg.style.display = 'block';
      return;
    }

    closeChangePasswordModal();
    pendingPassword = newPassword;
    // Continúa el flujo automáticamente (ahora debería pedir el QR/2FA).
    await attemptLogin(pendingUsername, pendingPassword);
  } catch (e) {
    errorMsg.textContent = 'No se pudo conectar con el servidor.';
    errorMsg.style.display = 'block';
  }
}

function openTotpModal(data) {
  document.getElementById('totp-input').value = '';
  document.getElementById('error-msg-totp').style.display = 'none';

  const warning = document.getElementById('totp-setup-warning');
  if (data.pendingSetup && data.deadline) {
    const formatted = new Date(data.deadline).toLocaleString('es-CR', { dateStyle: 'short', timeStyle: 'short' });
    warning.textContent = `Todavía no confirmaste tu Google Authenticator. Tenés hasta el ${formatted} (24 horas) para escanear el QR e ingresar el código, o tu cuenta será desactivada automáticamente.`;
    warning.style.display = 'block';
  } else {
    warning.style.display = 'none';
  }

  const qrContainer = document.getElementById('totp-qr-container');
  if (data.pendingSetup && data.qrCode) {
    document.getElementById('totp-qr-image').src = data.qrCode;
    document.getElementById('totp-qr-secret').textContent = data.secret || '';
    qrContainer.style.display = 'block';
  } else {
    qrContainer.style.display = 'none';
  }

  document.getElementById('totp-modal').classList.add('active');
  setTimeout(() => document.getElementById('totp-input').focus(), 100);
}

function closeTotpModal() {
  document.getElementById('totp-modal').classList.remove('active');
  pendingUsername = '';
  pendingPassword = '';
}

async function verifyTotp() {
  const totpToken = document.getElementById('totp-input').value.trim();
  const errorMsg  = document.getElementById('error-msg-totp');
  errorMsg.style.display = 'none';

  if (!totpToken || totpToken.length !== 6) {
    errorMsg.textContent = 'El código debe tener 6 dígitos.';
    errorMsg.style.display = 'block';
    return;
  }

  try {
    const { ok, data } = await api.post('/auth/login', {
      username:  pendingUsername,
      password:  pendingPassword,
      totpToken
    });
    if (ok) {
      localStorage.setItem('token', data.token);
      window.location.href = '/dashboard.html';
    } else if (data.requireTotp) {
      // Código incorrecto pero seguimos pendientes de configurar: mantené el QR visible.
      openTotpModal(data);
      errorMsg.textContent = data.message === 'Código de Google Authenticator incorrecto o expirado.'
        ? 'Código incorrecto o expirado.'
        : data.message;
      errorMsg.style.display = 'block';
    } else {
      errorMsg.textContent = data.message || 'Código incorrecto.';
      errorMsg.style.display = 'block';
    }
  } catch(e) {
    errorMsg.textContent = 'No se pudo conectar con el servidor.';
    errorMsg.style.display = 'block';
  }
}

function togglePassword() {
  const input      = document.getElementById('password');
  const iconEye    = document.getElementById('icon-eye');
  const iconEyeOff = document.getElementById('icon-eye-off');
  if (input.type === 'password') {
    input.type = 'text';
    iconEye.style.display    = 'none';
    iconEyeOff.style.display = 'block';
  } else {
    input.type = 'password';
    iconEye.style.display    = 'block';
    iconEyeOff.style.display = 'none';
  }
}

function toggleForgotPassword(inputId, eyeId, eyeOffId) {
  const input  = document.getElementById(inputId);
  const eye    = document.getElementById(eyeId);
  const eyeOff = document.getElementById(eyeOffId);
  if (input.type === 'password') {
    input.type = 'text';
    eye.style.display    = 'none';
    eyeOff.style.display = 'block';
  } else {
    input.type = 'password';
    eye.style.display    = 'block';
    eyeOff.style.display = 'none';
  }
}

function forgotPassword() {
  openForgotModal();
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if (document.getElementById('totp-modal').classList.contains('active')) closeTotpModal();
    if (document.getElementById('change-password-modal').classList.contains('active')) closeChangePasswordModal();
  }
  if (e.key === 'Enter') {
    if (document.getElementById('totp-modal').classList.contains('active')) {
      verifyTotp();
    } else if (document.getElementById('change-password-modal').classList.contains('active')) {
      submitChangePassword();
    } else {
      login();
    }
  }
});