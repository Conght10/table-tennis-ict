USE table_tennis_system;

-- 1. Add versioning columns to tournaments table
SET @reg_version_exists := (
    SELECT COUNT(*)
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'tournaments'
      AND column_name = 'registration_version'
);
SET @reg_version_sql := IF(
    @reg_version_exists = 0,
    'ALTER TABLE tournaments ADD COLUMN registration_version BIGINT NOT NULL DEFAULT 0 AFTER competition_version',
    'SELECT 1'
);
PREPARE stmt_reg_version FROM @reg_version_sql;
EXECUTE stmt_reg_version;
DEALLOCATE PREPARE stmt_reg_version;

SET @draw_rev_exists := (
    SELECT COUNT(*)
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'tournaments'
      AND column_name = 'draw_revision_current'
);
SET @draw_rev_sql := IF(
    @draw_rev_exists = 0,
    'ALTER TABLE tournaments ADD COLUMN draw_revision_current INT NOT NULL DEFAULT 0 AFTER registration_version',
    'SELECT 1'
);
PREPARE stmt_draw_rev FROM @draw_rev_sql;
EXECUTE stmt_draw_rev;
DEALLOCATE PREPARE stmt_draw_rev;

-- 2. Create tournament_registrations table
CREATE TABLE IF NOT EXISTS tournament_registrations (
    tournament_id VARCHAR(255) NOT NULL,
    member_id VARCHAR(255) NOT NULL,
    seed INT DEFAULT NULL,
    seed_source VARCHAR(50) DEFAULT 'auto',
    rank_snapshot VARCHAR(20) NOT NULL,
    elo_snapshot INT NOT NULL,
    gender_snapshot VARCHAR(50),
    department_snapshot VARCHAR(255),
    is_captain BOOLEAN DEFAULT FALSE,
    status VARCHAR(50) DEFAULT 'active',
    registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (tournament_id, member_id),
    FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE,
    FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
    UNIQUE KEY uk_tournament_seed (tournament_id, seed)
);

-- 3. Create tournament_seed_override_history table
CREATE TABLE IF NOT EXISTS tournament_seed_override_history (
    id VARCHAR(255) PRIMARY KEY,
    tournament_id VARCHAR(255) NOT NULL,
    member_id VARCHAR(255) NOT NULL,
    old_seed INT,
    new_seed INT,
    reason TEXT NOT NULL,
    actor_id VARCHAR(255) NOT NULL,
    overridden_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    draw_revision_before INT,
    draw_revision_after INT,
    FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE,
    FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
    FOREIGN KEY (actor_id) REFERENCES members(id) ON DELETE CASCADE
);

-- 4. Create tournament_draw_revisions table
CREATE TABLE IF NOT EXISTS tournament_draw_revisions (
    id VARCHAR(255) PRIMARY KEY,
    tournament_id VARCHAR(255) NOT NULL,
    revision_no INT NOT NULL,
    status VARCHAR(50) NOT NULL,
    reason VARCHAR(500) NOT NULL,
    actor_id VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    rule_config_json TEXT,
    objective_score DOUBLE NOT NULL DEFAULT 0.0,
    based_on_registration_version BIGINT NOT NULL DEFAULT 0,
    UNIQUE KEY uk_tournament_revision (tournament_id, revision_no),
    FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE,
    FOREIGN KEY (actor_id) REFERENCES members(id) ON DELETE CASCADE
);

-- 5. Create tournament_draw_revision_teams table
CREATE TABLE IF NOT EXISTS tournament_draw_revision_teams (
    revision_id VARCHAR(255) NOT NULL,
    team_id VARCHAR(255) NOT NULL,
    team_name VARCHAR(255) NOT NULL,
    seed_total INT NOT NULL,
    PRIMARY KEY (revision_id, team_id),
    FOREIGN KEY (revision_id) REFERENCES tournament_draw_revisions(id) ON DELETE CASCADE
);

-- 6. Create tournament_draw_revision_team_members table
CREATE TABLE IF NOT EXISTS tournament_draw_revision_team_members (
    revision_id VARCHAR(255) NOT NULL,
    team_id VARCHAR(255) NOT NULL,
    member_id VARCHAR(255) NOT NULL,
    PRIMARY KEY (revision_id, team_id, member_id),
    FOREIGN KEY (revision_id) REFERENCES tournament_draw_revisions(id) ON DELETE CASCADE,
    FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
);

-- 7. Create tournament_draw_revision_groups table
CREATE TABLE IF NOT EXISTS tournament_draw_revision_groups (
    revision_id VARCHAR(255) NOT NULL,
    group_name VARCHAR(50) NOT NULL,
    competitor_id VARCHAR(255) NOT NULL,
    PRIMARY KEY (revision_id, group_name, competitor_id),
    FOREIGN KEY (revision_id) REFERENCES tournament_draw_revisions(id) ON DELETE CASCADE
);
