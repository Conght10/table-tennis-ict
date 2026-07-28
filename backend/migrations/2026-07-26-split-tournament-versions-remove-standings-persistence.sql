USE table_tennis_system;

-- Add separated concurrency tokens for tournament metadata and competition state.
SET @meta_col_exists := (
    SELECT COUNT(*)
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'tournaments'
      AND column_name = 'metadata_version'
);
SET @meta_col_sql := IF(
    @meta_col_exists = 0,
    'ALTER TABLE tournaments ADD COLUMN metadata_version BIGINT NOT NULL DEFAULT 0 AFTER version',
    'SELECT 1'
);
PREPARE stmt_meta_col FROM @meta_col_sql;
EXECUTE stmt_meta_col;
DEALLOCATE PREPARE stmt_meta_col;

SET @comp_col_exists := (
    SELECT COUNT(*)
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'tournaments'
      AND column_name = 'competition_version'
);
SET @comp_col_sql := IF(
    @comp_col_exists = 0,
    'ALTER TABLE tournaments ADD COLUMN competition_version BIGINT NOT NULL DEFAULT 0 AFTER metadata_version',
    'SELECT 1'
);
PREPARE stmt_comp_col FROM @comp_col_sql;
EXECUTE stmt_comp_col;
DEALLOCATE PREPARE stmt_comp_col;

-- Create separated mutable aggregate table. tournaments keeps only metadata/version columns.
CREATE TABLE IF NOT EXISTS tournament_states (
    tournament_id VARCHAR(255) PRIMARY KEY,
    participants TEXT,
    `groups` TEXT,
    scores TEXT,
    knockout_matches TEXT,
    teams TEXT,
    captains TEXT,
    CONSTRAINT fk_tournament_states_tournament
        FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE
);

-- Backfill existing mutable columns into tournament_states (works even if some columns were already removed).
SET @participants_col_exists := (
    SELECT COUNT(*)
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'tournaments'
      AND column_name = 'participants'
);
SET @groups_col_exists := (
    SELECT COUNT(*)
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'tournaments'
      AND column_name = 'groups'
);
SET @scores_col_exists := (
    SELECT COUNT(*)
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'tournaments'
      AND column_name = 'scores'
);
SET @knockout_col_exists := (
    SELECT COUNT(*)
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'tournaments'
      AND column_name = 'knockout_matches'
);
SET @teams_col_exists := (
    SELECT COUNT(*)
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'tournaments'
      AND column_name = 'teams'
);
SET @captains_col_exists := (
    SELECT COUNT(*)
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'tournaments'
      AND column_name = 'captains'
);

SET @participants_expr := IF(@participants_col_exists = 1, 't.participants', 'NULL');
SET @groups_expr := IF(@groups_col_exists = 1, 't.`groups`', 'NULL');
SET @scores_expr := IF(@scores_col_exists = 1, 't.scores', 'NULL');
SET @knockout_expr := IF(@knockout_col_exists = 1, 't.knockout_matches', 'NULL');
SET @teams_expr := IF(@teams_col_exists = 1, 't.teams', 'NULL');
SET @captains_expr := IF(@captains_col_exists = 1, 't.captains', 'NULL');

SET @backfill_state_sql := CONCAT(
    'INSERT INTO tournament_states (tournament_id, participants, `groups`, scores, knockout_matches, teams, captains) ',
    'SELECT t.id, ', @participants_expr, ', ', @groups_expr, ', ', @scores_expr, ', ', @knockout_expr, ', ', @teams_expr, ', ', @captains_expr, ' ',
    'FROM tournaments t ',
    'ON DUPLICATE KEY UPDATE ',
    'participants = COALESCE(tournament_states.participants, VALUES(participants)), ',
    '`groups` = COALESCE(tournament_states.`groups`, VALUES(`groups`)), ',
    'scores = COALESCE(tournament_states.scores, VALUES(scores)), ',
    'knockout_matches = COALESCE(tournament_states.knockout_matches, VALUES(knockout_matches)), ',
    'teams = COALESCE(tournament_states.teams, VALUES(teams)), ',
    'captains = COALESCE(tournament_states.captains, VALUES(captains))'
);
PREPARE stmt_backfill_state FROM @backfill_state_sql;
EXECUTE stmt_backfill_state;
DEALLOCATE PREPARE stmt_backfill_state;

-- Stop persisting mutable tournament state inside tournaments table.
SET @participants_drop_sql := IF(
    @participants_col_exists = 1,
    'ALTER TABLE tournaments DROP COLUMN participants',
    'SELECT 1'
);
PREPARE stmt_drop_participants FROM @participants_drop_sql;
EXECUTE stmt_drop_participants;
DEALLOCATE PREPARE stmt_drop_participants;

SET @groups_drop_sql := IF(
    @groups_col_exists = 1,
    'ALTER TABLE tournaments DROP COLUMN `groups`',
    'SELECT 1'
);
PREPARE stmt_drop_groups FROM @groups_drop_sql;
EXECUTE stmt_drop_groups;
DEALLOCATE PREPARE stmt_drop_groups;

SET @scores_drop_sql := IF(
    @scores_col_exists = 1,
    'ALTER TABLE tournaments DROP COLUMN scores',
    'SELECT 1'
);
PREPARE stmt_drop_scores FROM @scores_drop_sql;
EXECUTE stmt_drop_scores;
DEALLOCATE PREPARE stmt_drop_scores;

SET @knockout_drop_sql := IF(
    @knockout_col_exists = 1,
    'ALTER TABLE tournaments DROP COLUMN knockout_matches',
    'SELECT 1'
);
PREPARE stmt_drop_knockout FROM @knockout_drop_sql;
EXECUTE stmt_drop_knockout;
DEALLOCATE PREPARE stmt_drop_knockout;

SET @teams_drop_sql := IF(
    @teams_col_exists = 1,
    'ALTER TABLE tournaments DROP COLUMN teams',
    'SELECT 1'
);
PREPARE stmt_drop_teams FROM @teams_drop_sql;
EXECUTE stmt_drop_teams;
DEALLOCATE PREPARE stmt_drop_teams;

SET @captains_drop_sql := IF(
    @captains_col_exists = 1,
    'ALTER TABLE tournaments DROP COLUMN captains',
    'SELECT 1'
);
PREPARE stmt_drop_captains FROM @captains_drop_sql;
EXECUTE stmt_drop_captains;
DEALLOCATE PREPARE stmt_drop_captains;

-- Stop persisting standings as source-of-truth in tournaments table.
SET @standings_col_exists := (
    SELECT COUNT(*)
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'tournaments'
      AND column_name = 'standings'
);
SET @standings_col_sql := IF(
    @standings_col_exists = 1,
    'ALTER TABLE tournaments DROP COLUMN standings',
    'SELECT 1'
);
PREPARE stmt_standings_col FROM @standings_col_sql;
EXECUTE stmt_standings_col;
DEALLOCATE PREPARE stmt_standings_col;

-- Standing projections are no longer persisted.
DROP TABLE IF EXISTS tournament_standing_projections;
