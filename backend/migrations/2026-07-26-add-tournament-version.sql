USE table_tennis_system;

-- Add optimistic-lock version column for concurrent tournament updates.
SET @col_exists := (
    SELECT COUNT(*)
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'tournaments'
      AND column_name = 'version'
);
SET @col_sql := IF(
    @col_exists = 0,
    'ALTER TABLE tournaments ADD COLUMN version BIGINT NOT NULL DEFAULT 0 AFTER id',
    'SELECT 1'
);
PREPARE stmt_col FROM @col_sql;
EXECUTE stmt_col;
DEALLOCATE PREPARE stmt_col;
