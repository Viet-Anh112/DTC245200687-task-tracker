# Task Tracker - Triển khai & Quản trị Hệ thống Phần mềm (Đề 24)

Ứng dụng quản lý công việc cá nhân/nhóm (task, deadline, trạng thái) chạy hoàn toàn bằng Docker Compose:
Node.js (Express) + PostgreSQL + pgAdmin + Nginx reverse proxy (HTTPS) + Prometheus + Grafana + Loki + Promtail.

## Yêu cầu
- Docker Engine 24+ và Docker Compose v2
- Git, OpenSSL

## Chạy hệ thống
```bash
git clone https://github.com/<tai-khoan-MSSV>/<MSSV>-task-tracker.git
cd <MSSV>-task-tracker
cp .env.example .env            # sửa mật khẩu trong .env
sh scripts/gen-cert.sh          # tạo chứng chỉ HTTPS tự ký
docker compose up -d --build
docker compose ps
```

## Địa chỉ truy cập
| Dịch vụ | URL | Ghi chú |
|---|---|---|
| Web Task Tracker | https://localhost | qua Nginx (HTTP 80 tự chuyển sang HTTPS) |
| pgAdmin | http://127.0.0.1:5050 | đăng nhập bằng PGADMIN_EMAIL / PGADMIN_PASSWORD |
| Prometheus | http://127.0.0.1:9090 | Status > Targets |
| Grafana | http://127.0.0.1:3000 | dashboard "Task Tracker - Overview", Explore > Loki |

Kết nối DB trong pgAdmin: Host `db`, Port `5432`, Database `taskdb`, user `tt_admin`.

## Truy vấn LogQL mẫu
```
{job="nginx"} | json | status >= 500
{job="app"} |~ "(?i)(error|exception|failed)"
sum by (status) (count_over_time({job="nginx"} | json [5m]))
```

## Cấu trúc
```
app/        mã nguồn Node.js + Dockerfile
db/init/    schema, dữ liệu mẫu, tạo role tối thiểu quyền
nginx/      nginx.conf (reverse proxy, HTTPS, security headers)
monitoring/ prometheus.yml + Grafana provisioning/dashboard
logging/    loki-config.yaml + promtail-config.yaml
scripts/    gen-cert.sh
```

## Commit
1. Ứng dụng + PostgreSQL + pgAdmin + Nginx reverse proxy
2. Prometheus + Grafana
3. Loki + Promtail
4. Hardening + README + báo cáo
