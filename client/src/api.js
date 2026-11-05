import { io } from 'socket.io-client';

// In development with Vite dev server on port 5173, point to local backend on 5050.
// In production (Render, Docker, or Express static), connect to current window origin seamlessly.
const socketUrl = typeof window !== 'undefined' && window.location.port === '5173'
  ? 'http://localhost:5050'
  : (typeof window !== 'undefined' ? window.location.origin : '');

export const socket = io(socketUrl, {
  autoConnect: true,
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionAttempts: Infinity,
});

export async function apiRequest(endpoint, method = 'GET', data = null, token = null) {
  const currentToken = token || localStorage.getItem('tv_dashboard_token') || 'bravia2026';
  const headers = {
    'Content-Type': 'application/json',
    'x-admin-key': currentToken,
  };

  const config = {
    method,
    headers,
  };

  if (data && (method === 'POST' || method === 'PUT')) {
    config.body = JSON.stringify(data);
  }

  const res = await fetch(`/api${endpoint}`, config);
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.error || `HTTP error ${res.status}`);
  }
  return await res.json();
}
