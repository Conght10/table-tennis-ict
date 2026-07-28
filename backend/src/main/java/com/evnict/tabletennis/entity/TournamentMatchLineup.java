package com.evnict.tabletennis.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Entity
@Table(
        name = "tournament_match_lineups",
        uniqueConstraints = {
                @UniqueConstraint(name = "uk_tournament_match_lineups_tournament_stage_match", columnNames = {"tournament_id", "stage", "match_key"})
        }
)
public class TournamentMatchLineup {
    @Id
    private String id;

    @Column(name = "tournament_id", nullable = false)
    private String tournamentId;

    @Column(nullable = false)
    private String stage;

    @Column(name = "group_name")
    private String groupName;

    @Column(name = "match_key", nullable = false)
    private String matchKey;

    @Column(name = "lineup_json", columnDefinition = "TEXT")
    private String lineupJson;

    @Column(name = "sub_matches_json", columnDefinition = "TEXT")
    private String subMatchesJson;

    @Column(nullable = false)
    private Long version = 0L;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @Column(name = "updated_by")
    private String updatedBy;
}
