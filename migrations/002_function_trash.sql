-- Soft deletion preserves releases, grants and history until explicit permanent deletion.
ALTER TABLE functions ADD COLUMN deleted_at TEXT;
