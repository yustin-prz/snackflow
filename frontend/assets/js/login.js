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

  try {
    const { ok, data } = await api.post('/auth/login', { username, password });
    if (ok && data.token) {
      localStorage.setItem('token', data.token);
      window.location.href = '/dashboard.html';
    } else if (data.requireTotp) {
      pendingUsername = username;
      pendingPassword = password;
      openTotpModal();
    } else {
      errorMsg.textContent = data.message || 'Usuario o contraseña incorrectos.';
      errorMsg.style.display = 'block';
    }
  } catch(e) {
    errorMsg.textContent = 'No se pudo conectar con el servidor.';
    errorMsg.style.display = 'block';
  }
}

function openTotpModal() {
  document.getElementById('totp-input').value = '';
  document.getElementById('error-msg-totp').style.display = 'none';
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
  if (e.key === 'Escape') closeTotpModal();
  if (e.key === 'Enter') {
    const totpModal = document.getElementById('totp-modal');
    if (totpModal.classList.contains('active')) {
      verifyTotp();
    } else {
      login();
    }
  }
});