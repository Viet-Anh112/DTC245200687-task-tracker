-- ============================================================================
-- 01-schema.sql: Khoi tao cau truc bang, chi muc va du lieu mau cho Task Tracker
-- De tai: De 24 - Trien khai va Quan tri He thong Phan mem
-- ============================================================================

-- 1. Bang nguoi dung (users)
CREATE TABLE IF NOT EXISTS users (
  id         SERIAL PRIMARY KEY,
  full_name  VARCHAR(100) NOT NULL,
  email      VARCHAR(150) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Bang nhom / du an (projects)
CREATE TABLE IF NOT EXISTS projects (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Bang cong viec (tasks)
CREATE TABLE IF NOT EXISTS tasks (
  id          SERIAL PRIMARY KEY,
  title       VARCHAR(200) NOT NULL,
  description TEXT,
  status      VARCHAR(20) NOT NULL DEFAULT 'todo'
              CHECK (status IN ('todo', 'in_progress', 'done')),
  priority    VARCHAR(10) NOT NULL DEFAULT 'medium'
              CHECK (priority IN ('low', 'medium', 'high')),
  deadline    TIMESTAMPTZ,
  project_id  INT REFERENCES projects(id) ON DELETE SET NULL,
  assignee_id INT REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Chi muc (Indexes) de toi uu hieu nang truy van theo yeu cau
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_deadline ON tasks(deadline);
CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee_id ON tasks(assignee_id);

-- ============================================================================
-- 5. Du lieu mau ban dau (Seed Data): 2 nguoi dung, 2 nhom, 5 cong viec
-- ============================================================================

-- Chen 2 nguoi dung mau
INSERT INTO users (id, full_name, email) VALUES
  (1, 'Nguyễn Văn An', 'an.nguyen@example.com'),
  (2, 'Trần Thị Bình', 'binh.tran@example.com')
ON CONFLICT (email) DO NOTHING;

-- Chen 2 nhom/du an mau
INSERT INTO projects (id, name, description) VALUES
  (1, 'Dự án Triển khai Hệ thống', 'Xây dựng môi trường Docker, Reverse Proxy và Monitoring'),
  (2, 'Nâng cấp Hạ tầng Mạng', 'Tối ưu hóa tường lửa, cô lập mạng nội bộ và backup định kỳ')
ON CONFLICT (name) DO NOTHING;

-- Chen 5 task mau (trong do co 1 task da qua han voi deadline trong qua khu)
INSERT INTO tasks (id, title, description, status, priority, deadline, project_id, assignee_id, created_at, updated_at) VALUES
  (1, 'Cấu hình Nginx reverse proxy với HTTPS', 'Thiết lập SSL tự ký, chuyển hướng HTTP sang HTTPS và thêm security headers', 'done', 'high', now() - INTERVAL '3 days', 1, 1, now() - INTERVAL '4 days', now() - INTERVAL '3 days'),
  (2, 'Tích hợp Prometheus và Grafana dashboard', 'Thu thập metrics Node.js, cAdvisor, Nginx và PostgreSQL qua exporter', 'in_progress', 'high', now() + INTERVAL '2 days', 1, 2, now() - INTERVAL '2 days', now() - INTERVAL '1 day'),
  (3, 'Gia cố container Docker và phân quyền CSDL', 'Áp dụng non-root, read_only, cap_drop và role tt_app giới hạn quyền', 'todo', 'medium', now() + INTERVAL '5 days', 1, 1, now() - INTERVAL '1 day', now() - INTERVAL '1 day'),
  (4, 'Nộp báo cáo bài tập lớn hệ thống phần mềm', 'Hoàn thiện tài liệu Word, cấu trúc repo GitHub và video thuyết minh', 'todo', 'high', now() - INTERVAL '1 day', 1, 2, now() - INTERVAL '3 days', now() - INTERVAL '2 days'), -- TASK QUA HAN (DEADLINE < NOW & STATUS != DONE)
  (5, 'Cấu hình thu thập log tập trung với Loki', 'Cài đặt Promtail parse log JSON từ container stdout và đẩy về Loki', 'todo', 'low', now() + INTERVAL '7 days', 2, 1, now() - INTERVAL '12 hours', now() - INTERVAL '12 hours')
ON CONFLICT (id) DO NOTHING;

-- Dong bo lai chuoi sequence tu dong tang sau khi chen du lieu co kem ID cu the
SELECT setval('users_id_seq', (SELECT MAX(id) FROM users));
SELECT setval('projects_id_seq', (SELECT MAX(id) FROM projects));
SELECT setval('tasks_id_seq', (SELECT MAX(id) FROM tasks));
