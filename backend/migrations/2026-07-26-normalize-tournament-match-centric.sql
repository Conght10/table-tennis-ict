USE table_tennis_system;

-- Extend matches for first-class tournament event metadata.
SET @col_exists := (
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'matches' AND column_name = 'tournament_id'
);
SET @sql_stmt := IF(@col_exists = 0,
    'ALTER TABLE matches ADD COLUMN tournament_id VARCHAR(255) AFTER recorded_by_id',
    'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'matches' AND column_name = 'tournament_match_key'
);
SET @sql_stmt := IF(@col_exists = 0,
    'ALTER TABLE matches ADD COLUMN tournament_match_key VARCHAR(255) AFTER tournament_id',
    'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'matches' AND column_name = 'tournament_stage'
);
SET @sql_stmt := IF(@col_exists = 0,
    'ALTER TABLE matches ADD COLUMN tournament_stage VARCHAR(255) AFTER tournament_match_key',
    'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'matches' AND column_name = 'tournament_group_name'
);
SET @sql_stmt := IF(@col_exists = 0,
    'ALTER TABLE matches ADD COLUMN tournament_group_name VARCHAR(255) AFTER tournament_stage',
    'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'matches' AND column_name = 'tournament_sub_match_idx'
);
SET @sql_stmt := IF(@col_exists = 0,
    'ALTER TABLE matches ADD COLUMN tournament_sub_match_idx INT AFTER tournament_group_name',
    'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'matches' AND column_name = 'action_type'
);
SET @sql_stmt := IF(@col_exists = 0,
    'ALTER TABLE matches ADD COLUMN action_type VARCHAR(255) AFTER tournament_sub_match_idx',
    'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'matches' AND column_name = 'request_id'
);
SET @sql_stmt := IF(@col_exists = 0,
    'ALTER TABLE matches ADD COLUMN request_id VARCHAR(255) AFTER action_type',
    'SELECT 1');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Normalized write model table.
CREATE TABLE IF NOT EXISTS tournament_match_states (
    id VARCHAR(255) PRIMARY KEY,
    tournament_id VARCHAR(255) NOT NULL,
    stage VARCHAR(255) NOT NULL,
    group_name VARCHAR(255),
    match_key VARCHAR(255) NOT NULL,
    parent_match_key VARCHAR(255),
    sub_match_index INT,
    home_competitor_id VARCHAR(255) NOT NULL,
    away_competitor_id VARCHAR(255) NOT NULL,
    home_score INT NOT NULL DEFAULT 0,
    away_score INT NOT NULL DEFAULT 0,
    completed BOOLEAN NOT NULL DEFAULT FALSE,
    winner_id VARCHAR(255),
    set_scores TEXT,
    version BIGINT NOT NULL DEFAULT 0,
    updated_at DATETIME NOT NULL,
    updated_by VARCHAR(255),
    UNIQUE KEY uk_tournament_match_states_tournament_match_key (tournament_id, match_key),
    KEY idx_tournament_match_states_tournament_stage (tournament_id, stage),
    CONSTRAINT fk_tournament_match_states_tournament
        FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE
);

-- Read model projection table.
CREATE TABLE IF NOT EXISTS tournament_match_lineups (
    id VARCHAR(255) PRIMARY KEY,
    tournament_id VARCHAR(255) NOT NULL,
    stage VARCHAR(255) NOT NULL,
    group_name VARCHAR(255),
    match_key VARCHAR(255) NOT NULL,
    lineup_json TEXT,
    sub_matches_json TEXT,
    version BIGINT NOT NULL DEFAULT 0,
    updated_at DATETIME NOT NULL,
    updated_by VARCHAR(255),
    UNIQUE KEY uk_tournament_match_lineups_tournament_stage_match (tournament_id, stage, match_key),
    KEY idx_tournament_match_lineups_tournament_stage (tournament_id, stage),
    CONSTRAINT fk_tournament_match_lineups_tournament
        FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE
);

-- Read model projection table.
CREATE TABLE IF NOT EXISTS tournament_standing_projections (
    id VARCHAR(255) PRIMARY KEY,
    tournament_id VARCHAR(255) NOT NULL,
    group_name VARCHAR(255) NOT NULL,
    competitor_id VARCHAR(255) NOT NULL,
    competitor_name VARCHAR(255),
    played INT NOT NULL DEFAULT 0,
    won INT NOT NULL DEFAULT 0,
    lost INT NOT NULL DEFAULT 0,
    points_for INT NOT NULL DEFAULT 0,
    points_against INT NOT NULL DEFAULT 0,
    sets_for INT NOT NULL DEFAULT 0,
    sets_against INT NOT NULL DEFAULT 0,
    match_points INT NOT NULL DEFAULT 0,
    standing_rank INT NOT NULL DEFAULT 0,
    projection_version BIGINT NOT NULL DEFAULT 0,
    updated_at DATETIME NOT NULL,
    UNIQUE KEY uk_tournament_standing_projection (tournament_id, group_name, competitor_id),
    KEY idx_tournament_standing_projections_tournament_group_rank (tournament_id, group_name, standing_rank),
    CONSTRAINT fk_tournament_standing_projections_tournament
        FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE
);

-- Immutable event log table.
CREATE TABLE IF NOT EXISTS tournament_match_events (
    id VARCHAR(255) PRIMARY KEY,
    tournament_id VARCHAR(255) NOT NULL,
    match_key VARCHAR(255),
    action_type VARCHAR(255) NOT NULL,
    payload_json TEXT,
    actor_id VARCHAR(255),
    request_id VARCHAR(255),
    created_at DATETIME NOT NULL,
    UNIQUE KEY uk_tournament_match_events_request (tournament_id, request_id),
    KEY idx_tournament_match_events_tournament_created_at (tournament_id, created_at),
    CONSTRAINT fk_tournament_match_events_tournament
        FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE
);
