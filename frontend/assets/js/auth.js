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

  requireAuth() {
    if (!this.isAuthenticated()) {
      window.location.href = '/login.html';
    }
  },

  requireAdmin() {
    const user = this.getUser();
    if (!user || user.role !== 'admin') {
      window.location.href = '/dashboard.html';
    }
  }
};