import http from 'node:http';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const accounts = [
  { id: 'student-a', login: 'student-a', password: 'lab-a', role: 'student' },
  { id: 'student-b', login: 'student-b', password: 'lab-b', role: 'student' },
  { id: 'teacher', login: 'teacher', password: 'lab-teacher', role: 'teacher' }
];
const initialWorks = [
  { id: 101, owner: 'student-a', title: 'Настройка NAT', grade: 4, feedback: 'Дополнить схему сети' },
  { id: 102, owner: 'student-b', title: 'Проверка прав доступа', grade: 5, feedback: 'Проверки выполнены' }
];
const html = readFileSync(new URL('./public/index.html', import.meta.url));
export function canRead(user, work) {
  return user.role === 'teacher' || work.owner === user.id;
}
export function createLab({ mode = 'fixed', logger = () => {} } = {}) {
  if (!['fixed', 'vulnerable'].includes(mode)) throw new Error('Unknown LAB_MODE');
  const sessions = new Map();
  const works = structuredClone(initialWorks);
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    const sid = /(?:^|;\s*)sid=([a-f0-9]+)/.exec(req.headers.cookie || '')?.[1];
    const user = sessions.get(sid);
    const reply = (status, data) => {
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
      res.end(JSON.stringify(data));
      logger({ time: new Date().toISOString(), method: req.method, path: url.pathname, actor: user?.id || 'anonymous', status, mode });
    };
    async function body() {
      let input = '';
      for await (const chunk of req) {
        input += chunk;
        if (Buffer.byteLength(input) > 4096) throw new Error('body too large');
      }
      return JSON.parse(input || '{}');
    }
    try {
      if (req.method === 'GET' && url.pathname === '/') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
        return res.end(html);
      }
      if (req.method === 'GET' && url.pathname === '/api/health') return reply(200, { mode, status: 'ok' });
      if (req.method === 'POST' && url.pathname === '/api/login') {
        const input = await body();
        const account = accounts.find(a => a.login === input.login && a.password === input.password);
        if (!account) return reply(401, { error: 'Неверный логин или пароль' });
        const token = randomBytes(24).toString('hex');
        sessions.set(token, { id: account.id, role: account.role });
        res.setHeader('Set-Cookie', `sid=${token}; HttpOnly; SameSite=Strict; Path=/`);
        return reply(200, { id: account.id, role: account.role });
      }
      if (req.method === 'POST' && url.pathname === '/api/logout') {
        sessions.delete(sid);
        res.setHeader('Set-Cookie', 'sid=; Max-Age=0; HttpOnly; SameSite=Strict; Path=/');
        return reply(200, { status: 'logged out' });
      }
      if (!user) return reply(401, { error: 'Сначала войдите в систему' });
      if (req.method === 'GET' && url.pathname === '/api/me') return reply(200, user);
      if (req.method === 'GET' && url.pathname === '/api/works') return reply(200, works.filter(w => canRead(user, w)));
      if (req.method === 'GET' && url.pathname === '/api/teacher/works') {
        // Учебный дефект: в vulnerable пропущена проверка роли.
        if (mode === 'fixed' && user.role !== 'teacher') return reply(403, { error: 'Только преподаватель' });
        return reply(200, works);
      }
      const match = /^\/api\/works\/(\d+)$/.exec(url.pathname);
      if (match) {
        const work = works.find(w => w.id === Number(match[1]));
        if (!work) return reply(404, { error: 'Работа не найдена' });
        if (req.method === 'GET') {
          // Учебный дефект IDOR: авторизация объекта отсутствует в vulnerable.
          if (mode === 'fixed' && !canRead(user, work)) return reply(403, { error: 'Нет доступа к чужой работе' });
          return reply(200, work);
        }
        if (req.method === 'PATCH') {
          if (user.role !== 'teacher') return reply(403, { error: 'Оценку меняет только преподаватель' });
          const input = await body();
          if (!Number.isInteger(input.grade) || input.grade < 2 || input.grade > 5) return reply(400, { error: 'Оценка должна быть целым числом от 2 до 5' });
          work.grade = input.grade;
          return reply(200, work);
        }
      }
      return reply(404, { error: 'Маршрут не найден' });
    } catch {
      return reply(400, { error: 'Некорректный запрос' });
    }
  });
  return server;
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const mode = process.env.LAB_MODE || 'fixed';
  const port = Number(process.env.PORT || 3000);
  createLab({ mode, logger: event => console.log(JSON.stringify(event)) }).listen(port, '127.0.0.1', () => {
    console.log(`Локальный стенд: http://127.0.0.1:${port} | режим: ${mode}`);
  });
}
