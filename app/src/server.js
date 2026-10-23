/**
 * Server REST API chinh cua he thong Task Tracker
 * Su dung Express 4, PostgreSQL (pg.Pool), va Prometheus (prom-client)
 */
const express = require('express');
const path = require('path');
const pool = require('./db');
const { client, metricsMiddleware, updateTasksMetrics } = require('./metrics');

const app = express();
const PORT = process.env.PORT || 3000;

// Cac gia tri hop le theo rang buoc CHECK cua CSDL
const VALID_STATUSES = ['todo', 'in_progress', 'done'];
const VALID_PRIORITIES = ['low', 'medium', 'high'];

// 1. Bao mat co ban: An header X-Powered-By de che giau cong nghe backend
app.disable('x-powered-by');

// 2. Gioi han dung luong payload JSON de ngan chan DoS (100kb)
app.use(express.json({ limit: '100kb' }));

// 3. Middleware ghi log JSON ra stdout cho moi request (cho Promtail / Loki phan tich)
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    const isError = res.statusCode >= 500;
    const logEntry = {
      level: isError ? 'error' : 'info',
      time: new Date().toISOString(),
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      ms: duration,
    };
    if (isError) {
      console.error(JSON.stringify(logEntry));
    } else {
      console.log(JSON.stringify(logEntry));
    }
  });
  next();
});

// 4. Middleware do metrics cho Prometheus
app.use(metricsMiddleware);

// 5. Phuc vu frontend static file
app.use(express.static(path.join(__dirname, '..', 'public')));

// Helper boc async function de bat loi tap trung
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const badRequest = (res, msg) => res.status(400).json({ error: msg });

// Cau lenh SELECT co ban kem JOIN de lay ten nhom va nguoi thuc hien
const TASK_SELECT = `
  SELECT 
    t.id,
    t.title,
    t.description,
    t.status,
    t.priority,
    t.deadline,
    t.project_id,
    t.assignee_id,
    t.created_at,
    t.updated_at,
    p.name AS project_name,
    u.full_name AS assignee_name,
    (t.deadline IS NOT NULL AND t.deadline < now() AND t.status <> 'done') AS overdue
  FROM tasks t
  LEFT JOIN projects p ON p.id = t.project_id
  LEFT JOIN users u ON u.id = t.assignee_id
`;

// ==========================================
// 1. HEALTHCHECK & METRICS ENDPOINTS
// ==========================================

// Endpoint kiem tra ket noi den database phuc vu Docker HEALTHCHECK va load balancer
app.get('/health', wrap(async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.status(200).json({ status: 'UP', timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(503).json({ status: 'DOWN', error: 'Khong the ket noi den CSDL', details: err.message });
  }
}));

// Endpoint cung cap metrics cho Prometheus scrape
app.get('/metrics', wrap(async (req, res) => {
  // Cap nhat chi so tasks_total truoc khi Prometheus doc
  await updateTasksMetrics(pool);
  res.set('Content-Type', client.register.contentType);
  res.end(await client.register.metrics());
}));

// ==========================================
// 2. STATISTICS API
// ==========================================

app.get('/api/stats', wrap(async (req, res) => {
  const query = `
    SELECT 
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE status = 'todo')::int AS todo,
      COUNT(*) FILTER (WHERE status = 'in_progress')::int AS in_progress,
      COUNT(*) FILTER (WHERE status = 'done')::int AS done,
      COUNT(*) FILTER (WHERE deadline IS NOT NULL AND deadline < now() AND status <> 'done')::int AS overdue
    FROM tasks;
  `;
  const { rows } = await pool.query(query);
  res.json(rows[0] || { total: 0, todo: 0, in_progress: 0, done: 0, overdue: 0 });
}));

// ==========================================
// 3. TASKS API
// ==========================================

// GET /api/tasks: Danh sach cong viec (ho tro loc theo status, project_id, assignee_id, tim kiem tieu de)
app.get('/api/tasks', wrap(async (req, res) => {
  const { status, project_id, assignee_id, q } = req.query;

  if (status && !VALID_STATUSES.includes(status)) {
    return badRequest(res, 'Trạng thái status không hợp lệ (phải là todo, in_progress hoặc done)');
  }

  const conditions = [];
  const values = [];

  // Truy van tham so hoa de chong SQL Injection
  if (status) {
    values.push(status);
    conditions.push(`t.status = $${values.length}`);
  }
  if (project_id) {
    values.push(Number(project_id));
    conditions.push(`t.project_id = $${values.length}`);
  }
  if (assignee_id) {
    values.push(Number(assignee_id));
    conditions.push(`t.assignee_id = $${values.length}`);
  }
  if (q && q.trim()) {
    values.push(`%${q.trim()}%`);
    conditions.push(`t.title ILIKE $${values.length}`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const sql = `${TASK_SELECT} ${whereClause} ORDER BY t.deadline NULLS LAST, t.id DESC`;

  const { rows } = await pool.query(sql, values);
  res.json(rows);
}));

// GET /api/tasks/:id: Lay chi tiet mot task
app.get('/api/tasks/:id', wrap(async (req, res) => {
  const taskId = Number(req.params.id);
  if (isNaN(taskId)) return badRequest(res, 'ID task không hợp lệ');

  const { rows } = await pool.query(`${TASK_SELECT} WHERE t.id = $1`, [taskId]);
  if (!rows.length) {
    return res.status(404).json({ error: 'Không tìm thấy công việc' });
  }
  res.json(rows[0]);
}));

// POST /api/tasks: Tao moi cong viec
app.post('/api/tasks', wrap(async (req, res) => {
  const {
    title,
    description = '',
    status = 'todo',
    priority = 'medium',
    deadline = null,
    project_id = null,
    assignee_id = null,
  } = req.body;

  if (!title || !title.trim()) {
    return badRequest(res, 'Tiêu đề công việc là bắt buộc');
  }
  if (title.trim().length > 200) {
    return badRequest(res, 'Tiêu đề không được vượt quá 200 ký tự');
  }
  if (!VALID_STATUSES.includes(status)) {
    return badRequest(res, 'Trạng thái không hợp lệ');
  }
  if (!VALID_PRIORITIES.includes(priority)) {
    return badRequest(res, 'Mức độ ưu tiên không hợp lệ');
  }

  const insertSql = `
    INSERT INTO tasks (title, description, status, priority, deadline, project_id, assignee_id)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING id;
  `;
  const { rows: inserted } = await pool.query(insertSql, [
    title.trim(),
    description ? description.trim() : null,
    status,
    priority,
    deadline ? new Date(deadline) : null,
    project_id ? Number(project_id) : null,
    assignee_id ? Number(assignee_id) : null,
  ]);

  const { rows } = await pool.query(`${TASK_SELECT} WHERE t.id = $1`, [inserted[0].id]);
  res.status(201).json(rows[0]);
}));

// PUT /api/tasks/:id: Cap nhat toan dien mot cong viec
app.put('/api/tasks/:id', wrap(async (req, res) => {
  const taskId = Number(req.params.id);
  if (isNaN(taskId)) return badRequest(res, 'ID task không hợp lệ');

  const {
    title,
    description = '',
    status = 'todo',
    priority = 'medium',
    deadline = null,
    project_id = null,
    assignee_id = null,
  } = req.body;

  if (!title || !title.trim()) {
    return badRequest(res, 'Tiêu đề công việc là bắt buộc');
  }
  if (title.trim().length > 200) {
    return badRequest(res, 'Tiêu đề không được vượt quá 200 ký tự');
  }
  if (!VALID_STATUSES.includes(status)) {
    return badRequest(res, 'Trạng thái không hợp lệ');
  }
  if (!VALID_PRIORITIES.includes(priority)) {
    return badRequest(res, 'Mức độ ưu tiên không hợp lệ');
  }

  const updateSql = `
    UPDATE tasks 
    SET title = $1,
        description = $2,
        status = $3,
        priority = $4,
        deadline = $5,
        project_id = $6,
        assignee_id = $7,
        updated_at = now()
    WHERE id = $8
    RETURNING id;
  `;
  const { rows: updated } = await pool.query(updateSql, [
    title.trim(),
    description ? description.trim() : null,
    status,
    priority,
    deadline ? new Date(deadline) : null,
    project_id ? Number(project_id) : null,
    assignee_id ? Number(assignee_id) : null,
    taskId,
  ]);

  if (!updated.length) {
    return res.status(404).json({ error: 'Không tìm thấy công việc để cập nhật' });
  }

  const { rows } = await pool.query(`${TASK_SELECT} WHERE t.id = $1`, [taskId]);
  res.json(rows[0]);
}));

// PATCH /api/tasks/:id/status: Chuyen nhanh trang thai tren the Kanban
app.patch('/api/tasks/:id/status', wrap(async (req, res) => {
  const taskId = Number(req.params.id);
  const { status } = req.body;

  if (isNaN(taskId)) return badRequest(res, 'ID task không hợp lệ');
  if (!status || !VALID_STATUSES.includes(status)) {
    return badRequest(res, 'Trạng thái chuyển đổi không hợp lệ');
  }

  const { rows: updated } = await pool.query(
    'UPDATE tasks SET status = $1, updated_at = now() WHERE id = $2 RETURNING id;',
    [status, taskId]
  );

  if (!updated.length) {
    return res.status(404).json({ error: 'Không tìm thấy công việc' });
  }

  const { rows } = await pool.query(`${TASK_SELECT} WHERE t.id = $1`, [taskId]);
  res.json(rows[0]);
}));

// DELETE /api/tasks/:id: Xoa cong viec
app.delete('/api/tasks/:id', wrap(async (req, res) => {
  const taskId = Number(req.params.id);
  if (isNaN(taskId)) return badRequest(res, 'ID task không hợp lệ');

  const { rowCount } = await pool.query('DELETE FROM tasks WHERE id = $1;', [taskId]);
  if (rowCount === 0) {
    return res.status(404).json({ error: 'Không tìm thấy công việc để xóa' });
  }
  res.status(204).send();
}));

// ==========================================
// 4. PROJECTS API
// ==========================================

app.get('/api/projects', wrap(async (req, res) => {
  const { rows } = await pool.query('SELECT id, name, description, created_at FROM projects ORDER BY name;');
  res.json(rows);
}));

app.post('/api/projects', wrap(async (req, res) => {
  const { name, description = '' } = req.body;
  if (!name || !name.trim()) return badRequest(res, 'Tên nhóm/dự án là bắt buộc');
  if (name.trim().length > 100) return badRequest(res, 'Tên nhóm không được vượt quá 100 ký tự');

  try {
    const { rows } = await pool.query(
      'INSERT INTO projects (name, description) VALUES ($1, $2) RETURNING *;',
      [name.trim(), description ? description.trim() : null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    // 23505 la ma loi unique_violation trong PostgreSQL
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Tên nhóm/dự án đã tồn tại' });
    }
    throw err;
  }
}));

// ==========================================
// 5. USERS API
// ==========================================

app.get('/api/users', wrap(async (req, res) => {
  const { rows } = await pool.query('SELECT id, full_name, email, created_at FROM users ORDER BY full_name;');
  res.json(rows);
}));

app.post('/api/users', wrap(async (req, res) => {
  const { full_name, email } = req.body;
  if (!full_name || !full_name.trim()) return badRequest(res, 'Họ tên người dùng là bắt buộc');
  if (!email || !email.trim()) return badRequest(res, 'Email người dùng là bắt buộc');

  try {
    const { rows } = await pool.query(
      'INSERT INTO users (full_name, email) VALUES ($1, $2) RETURNING *;',
      [full_name.trim(), email.trim().toLowerCase()]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Email người dùng đã tồn tại' });
    }
    throw err;
  }
}));

// ==========================================
// 6. ERROR HANDLING MIDDLEWARE TAP TRUNG
// ==========================================
// Bat tat ca ngoai le, ghi log JSON ma khong lam lo stack trace ra ngoai client
app.use((err, req, res, next) => {
  console.error(JSON.stringify({
    level: 'error',
    time: new Date().toISOString(),
    method: req.method,
    url: req.originalUrl,
    status: 500,
    error: err.message,
    stack: process.env.NODE_ENV === 'production' ? undefined : err.stack,
  }));

  res.status(500).json({
    error: 'Lỗi máy chủ nội bộ. Vui lòng thử lại sau.',
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(JSON.stringify({
    level: 'info',
    time: new Date().toISOString(),
    msg: `Ung dung Task Tracker da khoi dong tren cong ${PORT}`,
  }));
});
