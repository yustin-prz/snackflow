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
    const data = await res.json();
    return { ok: res.ok, data };
  },

  async get(endpoint) {
    const token = localStorage.getItem('token');
    const res = await fetch(`${API_URL}${endpoint}`, {
      headers: {
        ...(token && { 'Authorization': `Bearer ${token}` })
      }
    });
    const data = await res.json();
    return { ok: res.ok, data };
  },

  async put(endpoint, body) {
    const token = localStorage.getItem('token');
    const res = await fetch(`${API_URL}${endpoint}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` })
      },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    return { ok: res.ok, data };
  },

  async patch(endpoint, body) {
    const token = localStorage.getItem('token');
    const res = await fetch(`${API_URL}${endpoint}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` })
      },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    return { ok: res.ok, data };
  },

  async del(endpoint) {
    const token = localStorage.getItem('token');
    const res = await fetch(`${API_URL}${endpoint}`, {
      method: 'DELETE',
      headers: {
        ...(token && { 'Authorization': `Bearer ${token}` })
      }
    });
    const data = await res.json();
    return { ok: res.ok, data };
  }
};