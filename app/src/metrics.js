/**
 * Khoi tao metrics cho Prometheus qua thu vien prom-client
 * - Metrics mac dinh cua Node.js (CPU, bo nho, event loop...)
 * - Histogram do thoi gian dap ung HTTP request
 * - Gauge dem tong so task theo tung trang thai (cap nhat dong tu DB)
 */
const client = require('prom-client');

// Thu thap metrics mac dinh cua tien trinh Node.js
client.collectDefaultMetrics({
  timeout: 5000,
});

// Histogram do thoi gian xu ly HTTP request (tinh theo giay)
const httpRequestDurationSeconds = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Thoi gian xu ly HTTP request tinh bang giay',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
});

// Gauge do luong so task theo tung trang thai (todo, in_progress, done)
const tasksTotalGauge = new client.Gauge({
  name: 'tasks_total',
  help: 'Tong so task trong he thong phan theo trang thai',
  labelNames: ['status'],
});

/**
 * Cap nhat chi so tasks_total tu CSDL khi Prometheus scrape /metrics
 */
async function updateTasksMetrics(pool) {
  try {
    const { rows } = await pool.query(`
      SELECT status, COUNT(*)::int AS count 
      FROM tasks 
      GROUP BY status;
    `);

    // Reset ve 0 truoc khi gan de dong bo voi cac trang thai co the khong con task nao
    ['todo', 'in_progress', 'done'].forEach((st) => {
      tasksTotalGauge.set({ status: st }, 0);
    });

    rows.forEach((row) => {
      tasksTotalGauge.set({ status: row.status }, row.count);
    });
  } catch (err) {
    // Khong de loi scrape lam chet ung dung
    console.error(JSON.stringify({
      level: 'error',
      time: new Date().toISOString(),
      msg: 'Loi cap nhat metric tasks_total tu DB',
      error: err.message,
    }));
  }
}

/**
 * Middleware do luong thoi gian cho moi HTTP request
 */
function metricsMiddleware(req, res, next) {
  const start = process.hrtime();

  res.on('finish', () => {
    // Lay route template (vi du: /api/tasks/:id) neu Express da match, nguoc lai dung path
    const route = (req.route && req.route.path) ? req.baseUrl + req.route.path : req.path;
    const diff = process.hrtime(start);
    const durationSeconds = diff[0] + diff[1] / 1e9;

    httpRequestDurationSeconds.observe(
      {
        method: req.method,
        route: route || 'unknown',
        status: res.statusCode,
      },
      durationSeconds
    );
  });

  next();
}

module.exports = {
  client,
  httpRequestDurationSeconds,
  tasksTotalGauge,
  updateTasksMetrics,
  metricsMiddleware,
};
