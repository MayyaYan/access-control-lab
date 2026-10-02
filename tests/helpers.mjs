import { createLab } from '../server.mjs';
export async function lab(t, mode = 'fixed') {
  const events = [];
  const server = createLab({ mode, logger: e => events.push(e) });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const request = (path, cookie, method='GET', data) => fetch(base+path, {method, headers: { ...(cookie?{cookie}:{}), ...(data?{'Content-Type':'application/json'}:{}) }, body: data ? JSON.stringify(data):undefined});
  async function login(login, password) {
    const response = await request('/api/login', null, 'POST', {login,password});
    return response.headers.get('set-cookie')?.split(';')[0];
  }
  return {request, login, events, raw: (path, options) => fetch(base+path, options)};
}
