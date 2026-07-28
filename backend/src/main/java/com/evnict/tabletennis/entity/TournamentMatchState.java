package com.evnict.tabletennis.entity;

import com.evnict.tabletennis.util.JsonConverters;
import jakarta.persistence.*;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

@Data
@Entity
@Table(
        name = "tournament_match_states",
        uniqueConstraints = {
                @UniqueConstraint(name = "uk_tournament_match_states_tournament_match_key", columnNames = {"tournament_id", "match_key"})
        }
)
public class TournamentMatchState {
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

    @Column(name = "parent_match_key")
    private String parentMatchKey;

    @Column(name = "sub_match_index")
    private Integer subMatchIndex;

    @Column(name = "home_competitor_id", nullable = false)
    private String homeCompetitorId;

    @Column(name = "away_competitor_id", nullable = false)
    private String awayCompetitorId;

    @Column(name = "home_score", nullable = false)
    private Integer homeScore = 0;

    @Column(name = "away_score", nullable = false)
    private Integer awayScore = 0;

    @Column(nullable = false)
    private Boolean completed = false;

    @Column(name = "winner_id")
    private String winnerId;

    @Convert(converter = JsonConverters.ObjectListConverter.class)
    @Column(name = "set_scores", columnDefinition = "TEXT")
    private List<Object> setScores;

    @Column(nullable = false)
    private Long version = 0L;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @Column(name = "updated_by")
    private String updatedBy;
}
