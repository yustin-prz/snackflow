const API_URL = '/api';

const api = {
  async post(endpoint, body) {
    const token = localStorage.getItem('token');
    const res = await fetch(`${API_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` })
      },
      body: JSON.stringify(body)
    });
    return { ok: res.ok, data: await res.json() };
  },

  async get(endpoint) {
    const token = localStorage.getItem('token');
    const res = await fetch(`${API_URL}${endpoint}`, {
      headers: {
        ...(token && { 'Authorization': `Bearer ${token}` })
      }
    });
    return { ok: res.ok, data: await res.json() };
  }
};