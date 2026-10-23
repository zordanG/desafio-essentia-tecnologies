-- Users table
CREATE TABLE users (
    id CHAR(36) NOT NULL,
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    UNIQUE KEY unique_email (email)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

-- Add owner_id to tasks
ALTER TABLE tasks
    ADD COLUMN owner_id CHAR(36) NOT NULL AFTER id,
    ADD CONSTRAINT fk_tasks_owner_id
        FOREIGN KEY (owner_id) REFERENCES users(id)
        ON DELETE CASCADE;

-- Index for owner_id lookups
CREATE INDEX idx_tasks_owner_id ON tasks (owner_id);

CREATE TABLE refresh_sessions (
    token_hash CHAR(64) PRIMARY KEY,
    user_id CHAR(36) NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_refresh_sessions_user (user_id),
    INDEX idx_refresh_sessions_expiry (expires_at),
    CONSTRAINT fk_refresh_sessions_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE
);