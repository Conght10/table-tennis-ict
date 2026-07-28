SET NAMES utf8mb4;
CREATE DATABASE IF NOT EXISTS table_tennis_system CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE table_tennis_system;

-- 1. Members
CREATE TABLE IF NOT EXISTS members (
    id VARCHAR(255) PRIMARY KEY,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    username VARCHAR(255) NOT NULL UNIQUE,
    elo INT DEFAULT 1200,
    rank_tier VARCHAR(255) DEFAULT 'A5',
    roles VARCHAR(255) NOT NULL, -- Comma-separated roles: e.g. "player,admin"
    joined_at DATE NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    department VARCHAR(255),
    gender VARCHAR(255),
    phone VARCHAR(255),
    notes TEXT,
    password VARCHAR(255) NOT NULL DEFAULT '123456'
);

-- 2. Matches
CREATE TABLE IF NOT EXISTS matches (
    id VARCHAR(255) PRIMARY KEY,
    played_at DATETIME NOT NULL,
    source VARCHAR(255) NOT NULL,
    home_player_id VARCHAR(255),
    away_player_id VARCHAR(255),
    home_score INT NOT NULL,
    away_score INT NOT NULL,
    home_elo_before INT NOT NULL,
    away_elo_before INT NOT NULL,
    home_elo_after INT NOT NULL,
    away_elo_after INT NOT NULL,
    status VARCHAR(255) DEFAULT 'confirmed',
    recorded_by_id VARCHAR(255),
    tournament_id VARCHAR(255),
    tournament_match_key VARCHAR(255),
    tournament_stage VARCHAR(255),
    tournament_group_name VARCHAR(255),
    tournament_sub_match_idx INT,
    action_type VARCHAR(255),
    request_id VARCHAR(255),
    confirmed_by_id VARCHAR(255),
    notes TEXT,
    home_checked_in BOOLEAN DEFAULT FALSE,
    away_checked_in BOOLEAN DEFAULT FALSE,
    is_walkover BOOLEAN DEFAULT FALSE,
    walkover_winner_id VARCHAR(255),
    court_name VARCHAR(255),
    time_slot VARCHAR(255),
    FOREIGN KEY (home_player_id) REFERENCES members(id) ON DELETE SET NULL,
    FOREIGN KEY (away_player_id) REFERENCES members(id) ON DELETE SET NULL
);

-- 3. Challenge Requests
CREATE TABLE IF NOT EXISTS challenge_requests (
    id VARCHAR(255) PRIMARY KEY,
    challenger_id VARCHAR(255) NOT NULL,
    opponent_id VARCHAR(255) NOT NULL,
    requested_at DATETIME NOT NULL,
    preferred_time DATETIME,
    best_of INT NOT NULL,
    note TEXT,
    status VARCHAR(255) NOT NULL,
    FOREIGN KEY (challenger_id) REFERENCES members(id) ON DELETE CASCADE,
    FOREIGN KEY (opponent_id) REFERENCES members(id) ON DELETE CASCADE
);

-- 4. Notifications
CREATE TABLE IF NOT EXISTS notifications (
    id VARCHAR(255) PRIMARY KEY,
    receiver_id VARCHAR(255) NOT NULL,
    created_at DATETIME NOT NULL,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (receiver_id) REFERENCES members(id) ON DELETE CASCADE
);

-- 5. Tournaments
CREATE TABLE IF NOT EXISTS tournaments (
    id VARCHAR(255) PRIMARY KEY,
    version BIGINT NOT NULL DEFAULT 0,
    metadata_version BIGINT NOT NULL DEFAULT 0,
    competition_version BIGINT NOT NULL DEFAULT 0,
    registration_version BIGINT NOT NULL DEFAULT 0,
    draw_revision_current INT NOT NULL DEFAULT 0,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(255) NOT NULL, -- single, double, team
    started_at DATE NOT NULL,
    finished_at DATE,
    status VARCHAR(255) DEFAULT 'draft', -- draft, ongoing, finished
    group_size INT DEFAULT 4,
    team_size INT DEFAULT 3,
    stage VARCHAR(255) DEFAULT 'group', -- group, knockout
    location VARCHAR(255),
    prizes TEXT,
    format VARCHAR(255) DEFAULT 'group'
);

-- 6. Tournament mutable aggregate state (moved out of tournaments metadata table)
CREATE TABLE IF NOT EXISTS tournament_states (
    tournament_id VARCHAR(255) PRIMARY KEY,
    participants TEXT,
    `groups` TEXT,
    scores TEXT,
    knockout_matches TEXT,
    teams TEXT,
    captains TEXT,
    FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE
);

-- 7. Tournament Participants (Join table mapping members to tournaments)
CREATE TABLE IF NOT EXISTS tournament_participants (
    tournament_id VARCHAR(255) NOT NULL,
    member_id VARCHAR(255) NOT NULL,
    PRIMARY KEY (tournament_id, member_id),
    FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE,
    FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
);

-- 8. Teams
CREATE TABLE IF NOT EXISTS teams (
    id VARCHAR(255) PRIMARY KEY,
    tournament_id VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE
);

-- 9. Team Players (Join table mapping players to teams)
CREATE TABLE IF NOT EXISTS team_players (
    team_id VARCHAR(255) NOT NULL,
    member_id VARCHAR(255) NOT NULL,
    PRIMARY KEY (team_id, member_id),
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
    FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
);

-- 10. Tournament Captains (Join table mapping captains to tournaments)
CREATE TABLE IF NOT EXISTS tournament_captains (
    tournament_id VARCHAR(255) NOT NULL,
    member_id VARCHAR(255) NOT NULL,
    PRIMARY KEY (tournament_id, member_id),
    FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE,
    FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
);

-- 11. Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
    id VARCHAR(255) PRIMARY KEY,
    timestamp DATETIME NOT NULL,
    actor_id VARCHAR(255) NOT NULL,
    action VARCHAR(255) NOT NULL,
    details TEXT NOT NULL,
    reason VARCHAR(255) NOT NULL
);

-- 12. Tournament Match States (normalized per-match write model)
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
    FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE
);

-- 13. Tournament Match Lineups (normalized lineup read model)
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
    FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE
);

-- 14. Tournament Match Events (immutable audit/event log)
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
    FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE
);

-- 15. Tournament Registrations (Join table with snapshot values)
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

-- 16. Tournament Seed Override History
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

-- 17. Tournament Draw Revisions
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

-- 18. Tournament Draw Revision Teams
CREATE TABLE IF NOT EXISTS tournament_draw_revision_teams (
    revision_id VARCHAR(255) NOT NULL,
    team_id VARCHAR(255) NOT NULL,
    team_name VARCHAR(255) NOT NULL,
    seed_total INT NOT NULL,
    PRIMARY KEY (revision_id, team_id),
    FOREIGN KEY (revision_id) REFERENCES tournament_draw_revisions(id) ON DELETE CASCADE
);

-- 19. Tournament Draw Revision Team Members
CREATE TABLE IF NOT EXISTS tournament_draw_revision_team_members (
    revision_id VARCHAR(255) NOT NULL,
    team_id VARCHAR(255) NOT NULL,
    member_id VARCHAR(255) NOT NULL,
    PRIMARY KEY (revision_id, team_id, member_id),
    FOREIGN KEY (revision_id) REFERENCES tournament_draw_revisions(id) ON DELETE CASCADE,
    FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
);

-- 20. Tournament Draw Revision Groups
CREATE TABLE IF NOT EXISTS tournament_draw_revision_groups (
    revision_id VARCHAR(255) NOT NULL,
    group_name VARCHAR(50) NOT NULL,
    competitor_id VARCHAR(255) NOT NULL,
    PRIMARY KEY (revision_id, group_name, competitor_id),
    FOREIGN KEY (revision_id) REFERENCES tournament_draw_revisions(id) ON DELETE CASCADE
);

-- Seed actual EVNICT members from user roster
INSERT IGNORE INTO members (id, full_name, email, username, elo, rank_tier, roles, joined_at, is_active, department, gender, phone, notes) VALUES
('u01', 'Trần Văn Ninh', 'ninhtv.evnit@evn.com.vn', 'ninhtv.evnit', 1650, 'A2', 'admin,player', '2026-01-10', TRUE, 'Phòng TKDV', 'Nam', '0904554596', NULL),
('u02', 'Nguyễn Việt Thắng', 'thangnv.evnit@evn.com.vn', 'thangnv.evnit', 1600, 'A2', 'admin,player', '2026-02-15', TRUE, 'TTANTT', 'Nam', '0963998993', NULL),
('u03', 'Hồ Trung Công', 'conght.evnit@evn.com.vn', 'conght.evnit', 1620, 'A2', 'admin,player', '2026-01-20', TRUE, 'TTPM', 'Nam', '0326542734', NULL),
('u04', 'Đỗ Văn Nghĩa', 'nghiadv.evnit@evn.com.vn', 'nghiadv.evnit', 1520, 'A1', 'player', '2026-03-01', TRUE, 'TTPM', 'Nam', '0989198768', NULL),
('u05', 'Vũ Minh Thành', 'thanhvm.evnit@evn.com.vn', 'thanhvm.evnit', 1480, 'A3', 'player', '2026-01-15', TRUE, 'TTHT', 'Nam', '0963214705', NULL),
('u06', 'Đỗ Văn Trang', 'trangdv.evnit@evn.com.vn', 'trangdv.evnit', 1500, 'A1', 'player', '2026-02-28', TRUE, 'TTHT', 'Nam', '0963616888', NULL),
('u07', 'Trần Hồng Dương', 'duongth@evn.com.vn', 'duongth', 1440, 'A3', 'player', '2026-04-10', TRUE, 'KT', 'Nam', '0966181999', NULL),
('u08', 'Ngô Hồng Ngọc', 'ngoctnh.evnit@evn.com.vn', 'ngoctnh.evnit', 1320, 'A4', 'player', '2026-01-05', TRUE, 'TCHC', 'Nữ', '0968110986', NULL),
('u09', 'Nguyễn Văn Công', 'congnv.evnit@evn.com.vn', 'congnv.evnit', 1492, 'A3', 'player', '2026-02-10', TRUE, 'TTHT', 'Nam', '0962626216', NULL),
('u10', 'Vũ Thế Anh', 'anhvt@evn.com.vn', 'anhvt', 1510, 'A1', 'player', '2026-03-12', TRUE, 'Ban ĐTXD EVN', 'Nam', '0963598666', NULL),
('u11', 'Nguyễn Long Anh', 'Anhnl2.evnit@evn.com.vn', 'anhnl2.evnit', 1555, 'A1', 'player', '2026-01-18', TRUE, 'TTANTT', 'Nam', '0962333297', NULL),
('u12', 'Lại Thế Hùng', 'hunglt.evnit@evn.com.vn', 'hunglt.evnit', 1395, 'A4', 'player', '2026-02-22', TRUE, 'TTHT', 'Nam', '0966807777', NULL),
('u13', 'Khổng Thị Ngọc Hải', 'haiktn.evnit@evn.com.vn', 'haiktn.evnit', 1360, 'A4', 'player', '2026-01-25', TRUE, 'TTPM', 'Nữ', '0973577481', NULL),
('u14', 'Nguyễn Thị Hải Hà', 'hanth.evnit@evn.com.vn', 'hanth.evnit', 1375, 'A4', 'player', '2026-03-05', TRUE, 'TTPM', 'Nữ', '0966181666', NULL),
('u15', 'Trần Minh Hưởng', 'huongtm@evn.com.vn', 'huongtm', 1450, 'A3', 'player', '2026-01-30', TRUE, 'TTPM', 'Nam', '0962033369', NULL),
('u16', 'Nguyễn Dương Mạnh Dũng', 'dungndm.evnit@evn.com.vn', 'dungndm.evnit', 1560, 'A1', 'referee,player', '2026-02-05', TRUE, 'TTPM', 'Nam', '0848907219', 'Thành viên tổ trọng tài'),
('u17', 'Nguyễn Hùng Minh', 'HungNM@huutri.com.vn', 'hungnm', 1250, 'A5', 'player', '2026-04-01', TRUE, 'Ban Hưu trí', 'Nam', '0963606268', NULL),
('u18', 'Trịnh Thị Nghĩa Bình', 'binhttn.evnit@evn.com.vn', 'binhttn.evnit', 1315, 'A4', 'player', '2026-02-12', TRUE, 'TTPM', 'Nữ', '0947859059', NULL),
('u19', 'Đặng Thanh Xuân', 'xuandt@evn.com.vn', 'xuandt', 1420, 'A3', 'player', '2026-03-20', TRUE, 'Ban KDMBĐ EVN', 'Nam', '0966653356', NULL),
('u20', 'Phan Thế Đại', 'daipt@evn.com.vn', 'daipt', 1475, 'A3', 'player', '2026-01-28', TRUE, 'Ban KHCNCĐS EVN', 'Nam', '0966633388', NULL),
('u21', 'Đỗ Minh Hà', 'hadm@evn.com.vn', 'hadm', 1410, 'A3', 'player', '2026-02-18', TRUE, 'Ban QLXD EVN', 'Nam', '0912380327', NULL);
