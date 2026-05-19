const auth = {
  getToken() {
    return localStorage.getItem('token');
  },

  getUser() {
    const token = this.getToken();
    if (!token) return null;
    try {
      return JSON.parse(atob(token.split('.')[1]));
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