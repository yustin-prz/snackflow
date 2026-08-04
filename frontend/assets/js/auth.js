const auth = {
  getToken() {
    return localStorage.getItem('token');
  },

  getUser() {
    const token = this.getToken();
    if (!token) return null;
    try {
      // atob() decodifica base64 a bytes crudos, no a UTF-8: sin este paso
      // los acentos y ñ del nombre (viajan en el JWT) se ven corruptos.
      const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64).split('').map(c => '%' + c.charCodeAt(0).toString(16).padStart(2, '0')).join('')
      );
      return JSON.parse(jsonPayload);
    } catch(e) {
      return null;
    }
  },

  isAuthenticated() {
    return !!this.getUser();
  },

  logout() {
    localStorage.removeItem('token');
    window.location.href = '/login.html';
  },

  // Pedir el código de Google Authenticator en cada login es tedioso si hay
  // que repetirlo seguido; en vez de eso la sesión se cierra sola después de
  // 10 minutos sin actividad (mouse, teclado, touch o scroll) en vez de
  // depender de que el usuario cierre sesión a mano.
  IDLE_LIMIT_MS: 10 * 60 * 1000,
  _idleTimer: null,

  startIdleWatcher() {
    const resetTimer = () => {
      clearTimeout(this._idleTimer);
      this._idleTimer = setTimeout(() => {
        localStorage.removeItem('token');
        window.location.href = '/login.html?reason=idle';
      }, this.IDLE_LIMIT_MS);
    };

    ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'].forEach(evt => {
      document.addEventListener(evt, resetTimer, { passive: true });
    });

    resetTimer();
  },

  requireAuth() {
    if (!this.isAuthenticated()) {
      window.location.href = '/login.html';
      return;
    }
    this.startIdleWatcher();
  },

  requireAdmin() {
    const user = this.getUser();
    if (!user || user.role !== 'admin') {
      window.location.href = '/dashboard.html';
    }
  }
};