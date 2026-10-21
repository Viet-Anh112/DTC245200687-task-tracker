const client = require('prom-client');
const pool = require('./db');

client.collectDefaultMetrics();

const httpDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Thoi gian xu ly HTTP request',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 2],
});

// Gauge nghiep vu: so task theo trang thai (truy van DB moi lan Prometheus scrape)
new client.Gauge({
  name: 'tasks_total',
  help: 'So luong task theo trang thai',
  labelNames: ['status'],
  async collect() {
    const { rows } = await pool.query('SELECT status, COUNT(*)::int AS n FROM tasks GROUP BY status');
    this.reset();
    rows.forEach((r) => this.set({ status: r.status }, r.n));
  },
});

function metricsMiddleware(req, res, next) {
  const end = httpDuration.startTimer();
  res.on('finish', () => {
    const route = req.route ? req.baseUrl + req.route.path : req.path;
    end({ method: req.method, route, status: res.statusCode });
  });
  next();
}

module.exports = { client, metricsMiddleware };
