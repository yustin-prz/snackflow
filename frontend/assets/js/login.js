async function login() {
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;
  const errorMsg = document.getElementById('error-msg');
  errorMsg.style.display = 'none';

  if (!username || !password) {
    errorMsg.textContent = 'Por favor completá todos los campos.';
    errorMsg.style.display = 'block';
    return;
  }

  try {
    const { ok, data } = await api.post('/auth/login', { username, password });
    if (ok) {
      localStorage.setItem('token', data.token);
      window.location.href = '/dashboard.html';
    } else {
      errorMsg.textContent = data.message || 'Usuario o contraseña incorrectos.';
      errorMsg.style.display = 'block';
    }
  } catch(e) {
    errorMsg.textContent = 'No se pudo conectar con el servidor.';
    errorMsg.style.display = 'block';
  }
}

document.addEventListener('keydown', e => {
  if (e.key === 'Enter') login();
});