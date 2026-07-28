USE table_tennis_system;

-- Add username column for login by short identifier.
SET @col_exists := (
    SELECT COUNT(*)
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'members'
      AND column_name = 'username'
);
SET @col_sql := IF(
    @col_exists = 0,
    'ALTER TABLE members ADD COLUMN username VARCHAR(255) NULL AFTER email',
    'SELECT 1'
);
PREPARE stmt_col FROM @col_sql;
EXECUTE stmt_col;
DEALLOCATE PREPARE stmt_col;

-- Backfill username from the email local-part for existing records.
UPDATE members
SET username = LOWER(SUBSTRING_INDEX(email, '@', 1))
WHERE username IS NULL OR TRIM(username) = '';

-- Add unique index once.
SET @idx_exists := (
    SELECT COUNT(*)
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'members'
      AND index_name = 'uq_members_username'
);
SET @idx_sql := IF(
    @idx_exists = 0,
    'ALTER TABLE members ADD CONSTRAINT uq_members_username UNIQUE (username)',
    'SELECT 1'
);
PREPARE stmt_idx FROM @idx_sql;
EXECUTE stmt_idx;
DEALLOCATE PREPARE stmt_idx;

-- Enforce NOT NULL after backfill.
ALTER TABLE members
    MODIFY username VARCHAR(255) NOT NULL;
