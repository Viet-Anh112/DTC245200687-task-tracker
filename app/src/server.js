const express = require('express');
const path = require('path');
const pool = require('./db');
const { client, metricsMiddleware } = require('./metrics');

const STATUSES = ['todo', 'in_progress', 'done'];
const PRIORITIES = ['low', 'medium', 'high'];

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '100kb' }));

// Log dang JSON de Promtail/Loki de truy van
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    console.log(JSON.stringify({
      level: 'info', time: new Date().toISOString(),
      method: req.method, url: req.originalUrl,
      status: res.statusCode, ms: Date.now() - start,
    }));
  });
  next();
});
app.use(metricsMiddleware);
app.use(express.static(path.join(__dirname, '..', 'public')));

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const bad = (res, msg) => res.status(400).json({ error: msg });

// ---------- Health & Metrics ----------
app.get('/health', wrap(async (req, res) => {
  await pool.query('SELECT 1');
  res.json({ status: 'ok' });
}));
app.get('/metrics', wrap(async (req, res) => {
  res.set('Content-Type', client.register.contentType);
  res.end(await client.register.metrics());
}));

// ---------- Tasks ----------
const TASK_SELECT = `
  SELECT t.*, p.name AS project_name, u.full_name AS assignee_name,
         (t.deadline IS NOT NULL AND t.deadline < now() AND t.status <> 'done') AS overdue
  FROM tasks t
  LEFT JOIN projects p ON p.id = t.project_id
  LEFT JOIN users u ON u.id = t.assignee_id`;

app.get('/api/tasks', wrap(async (req, res) => {
  const { status, project_id, assignee_id, q } = req.query;
  if (status && !STATUSES.includes(status)) return bad(res, 'status khong hop le');
  const cond = [], val = [];
  if (status) { val.push(status); cond.push(`t.status = $${val.length}`); }
  if (project_id) { val.push(Number(project_id)); cond.push(`t.project_id = $${val.length}`); }
  if (assignee_id) { val.push(Number(assignee_id)); cond.push(`t.assignee_id = $${val.length}`); }
  if (q) { val.push(`%${q}%`); cond.push(`t.title ILIKE $${val.length}`); }
  const where = cond.length ? 'WHERE ' + cond.join(' AND ') : '';
  const { rows } = await pool.query(`${TASK_SELECT} ${where} ORDER BY t.deadline NULLS LAST, t.id`, val);
  res.json(rows);
}));

app.get('/api/tasks/:id', wrap(async (req, res) => {
  const { rows } = await pool.query(`${TASK_SELECT} WHERE t.id = $1`, [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: 'Khong tim thay task' });
  res.json(rows[0]);
}));

app.post('/api/tasks', wrap(async (req, res) => {
  const { title, description, status = 'todo', priority = 'medium', deadline, project_id, assignee_id } = req.body;
  if (!title || !title.trim()) return bad(res, 'title bat buoc');
  if (!STATUSES.includes(status)) return bad(res, 'status khong hop le');
  if (!PRIORITIES.includes(priority)) return bad(res, 'priority khong hop le');
  const { rows } = await pool.query(
    `INSERT INTO tasks (title, description, status, priority, deadline, project_id, assignee_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [title.trim(), description || null, status, priority, deadline || null, project_id || null, assignee_id || null]);
  res.status(201).json(rows[0]);
}));

app.put('/api/tasks/:id', wrap(async (req, res) => {
  const { title, description, status, priority, deadline, project_id, assignee_id } = req.body;
  if (status && !STATUSES.includes(status)) return bad(res, 'status khong hop le');
  if (priority && !PRIORITIES.includes(priority)) return bad(res, 'priority khong hop le');
  const { rows } = await pool.query(
    `UPDATE tasks SET title = COALESCE($1, title), description = COALESCE($2, description),
       status = COALESCE($3, status), priority = COALESCE($4, priority),
       deadline = COALESCE($5, deadline), project_id = COALESCE($6, project_id),
       assignee_id = COALESCE($7, assignee_id), updated_at = now()
     WHERE id = $8 RETURNING *`,
    [title, description, status, priority, deadline, project_id, assignee_id, req.params.id]);
  if (!rows.length) return res.status(404).json({ error: 'Khong tim thay task' });
  res.json(rows[0]);
}));

app.patch('/api/tasks/:id/status', wrap(async (req, res) => {
  if (!STATUSES.includes(req.body.status)) return bad(res, 'status khong hop le');
  const { rows } = await pool.query(
    'UPDATE tasks SET status = $1, updated_at = now() WHERE id = $2 RETURNING *',
    [req.body.status, req.params.id]);
  if (!rows.length) return res.status(404).json({ error: 'Khong tim thay task' });
  res.json(rows[0]);
}));

app.delete('/api/tasks/:id', wrap(async (req, res) => {
  const r = await pool.query('DELETE FROM tasks WHERE id = $1', [req.params.id]);
  if (!r.rowCount) return res.status(404).json({ error: 'Khong tim thay task' });
  res.status(204).end();
}));

// ---------- Projects (nhom) & Users ----------
app.get('/api/projects', wrap(async (req, res) => {
  res.json((await pool.query('SELECT * FROM projects ORDER BY id')).rows);
}));
app.post('/api/projects', wrap(async (req, res) => {
  if (!req.body.name) return bad(res, 'name bat buoc');
  const { rows } = await pool.query(
    'INSERT INTO projects (name, description) VALUES ($1,$2) RETURNING *',
    [req.body.name, req.body.description || null]);
  res.status(201).json(rows[0]);
}));
app.get('/api/users', wrap(async (req, res) => {
  res.json((await pool.query('SELECT id, full_name, email FROM users ORDER BY id')).rows);
}));
app.post('/api/users', wrap(async (req, res) => {
  const { full_name, email } = req.body;
  if (!full_name || !email) return bad(res, 'full_name va email bat buoc');
  const { rows } = await pool.query(
    'INSERT INTO users (full_name, email) VALUES ($1,$2) RETURNING id, full_name, email', [full_name, email]);
  res.status(201).json(rows[0]);
}));

// ---------- Thong ke ----------
app.get('/api/stats', wrap(async (req, res) => {
  const byStatus = await pool.query('SELECT status, COUNT(*)::int AS count FROM tasks GROUP BY status');
  const overdue = await pool.query(
    "SELECT COUNT(*)::int AS count FROM tasks WHERE deadline < now() AND status <> 'done'");
  res.json({ by_status: byStatus.rows, overdue: overdue.rows[0].count });
}));

// ---------- Xu ly loi ----------
app.use((err, req, res, next) => {
  console.error(JSON.stringify({ level: 'error', time: new Date().toISOString(), message: err.message, url: req.originalUrl }));
  if (err.code === '23505') return res.status(409).json({ error: 'Du lieu bi trung' });
  if (err.code === '23503') return bad(res, 'Khoa ngoai khong ton tai');
  res.status(500).json({ error: 'Internal Server Error' });
});

app.listen(3000, '0.0.0.0', () => console.log(JSON.stringify({ level: 'info', message: 'Task Tracker listening on :3000' })));
