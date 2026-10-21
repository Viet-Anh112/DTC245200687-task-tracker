CREATE TABLE users (
  id         SERIAL PRIMARY KEY,
  full_name  VARCHAR(100) NOT NULL,
  email      VARCHAR(150) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE projects (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE tasks (
  id          SERIAL PRIMARY KEY,
  title       VARCHAR(200) NOT NULL,
  description TEXT,
  status      VARCHAR(20) NOT NULL DEFAULT 'todo'
              CHECK (status IN ('todo','in_progress','done')),
  priority    VARCHAR(10) NOT NULL DEFAULT 'medium'
              CHECK (priority IN ('low','medium','high')),
  deadline    TIMESTAMPTZ,
  project_id  INT REFERENCES projects(id) ON DELETE SET NULL,
  assignee_id INT REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tasks_status   ON tasks(status);
CREATE INDEX idx_tasks_deadline ON tasks(deadline);

INSERT INTO users (full_name, email) VALUES
  ('Nguyễn Văn A', 'a@example.com'),
  ('Trần Thị B',   'b@example.com');
INSERT INTO projects (name, description) VALUES
  ('Bài tập lớn', 'Nhóm làm bài tập lớn môn Triển khai hệ thống'),
  ('Việc cá nhân', 'Công việc cá nhân hằng ngày');
INSERT INTO tasks (title, status, priority, deadline, project_id, assignee_id) VALUES
  ('Viết docker-compose',       'done',        'high',   now() - interval '2 days', 1, 1),
  ('Cấu hình Nginx HTTPS',      'in_progress', 'high',   now() + interval '1 day',  1, 1),
  ('Dựng dashboard Grafana',    'todo',        'medium', now() + interval '3 days', 1, 2),
  ('Nộp báo cáo',               'todo',        'high',   now() - interval '1 day',  1, 2),
  ('Đọc tài liệu LogQL',        'todo',        'low',    NULL,                      2, 1);
