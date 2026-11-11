// Thin API client. The token lives in localStorage; all scoring happens on the server.
const KEY = 'cb_token';
export const getToken = () => localStorage.getItem(KEY);
export const setToken = (t) => (t ? localStorage.setItem(KEY, t) : localStorage.removeItem(KEY));

export class ApiError extends Error { constructor(message, status, fields) { super(message); this.status = status; this.fields = fields; } }

export async function api(path, { method = 'GET', body } = {}) {
  let res;
  try {
    res = await fetch('/api' + path, { method, headers: { 'content-type': 'application/json', ...(getToken() ? { authorization: `Bearer ${getToken()}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  } catch { throw new ApiError('Cannot reach the Consult Brain server. Is it running?', 0); }
  let data = null; try { data = await res.json(); } catch {}
  if (!res.ok) {
    if (res.status === 401 && getToken()) { setToken(null); window.dispatchEvent(new Event('cb-logout')); }
    throw new ApiError(data?.error || 'Request failed', res.status, data?.fields);
  }
  return data;
}
export const post = (path, body) => api(path, { method: 'POST', body: body || {} });
export async function download(path, filename) {
  const res = await fetch('/api' + path, { headers: { authorization: `Bearer ${getToken()}` } });
  if (!res.ok) throw new ApiError('Export failed', res.status);
  const url = URL.createObjectURL(await res.blob()); const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(url), 2000);
}
