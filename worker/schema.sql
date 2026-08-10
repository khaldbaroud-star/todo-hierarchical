CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  device_id TEXT NOT NULL,
  title TEXT NOT NULL,
  type TEXT NOT NULL,
  parent_id TEXT,
  due_date TEXT NOT NULL,
  original_due_date TEXT NOT NULL,
  status TEXT NOT NULL,
  is_in_daily_list INTEGER NOT NULL DEFAULT 0,
  deleted INTEGER NOT NULL DEFAULT 0,
  completed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tasks_device ON tasks(device_id);
CREATE INDEX IF NOT EXISTS idx_tasks_parent ON tasks(parent_id);
