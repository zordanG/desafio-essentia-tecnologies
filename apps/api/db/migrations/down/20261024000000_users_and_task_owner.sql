-- Drop foreign key and column from tasks
ALTER TABLE tasks
    DROP FOREIGN KEY fk_tasks_owner_id,
    DROP INDEX idx_tasks_owner_id,
    DROP COLUMN owner_id;

-- Drop users table
DROP TABLE IF EXISTS users;

DROOP TABLE IF EXISTS refresh_sessions;