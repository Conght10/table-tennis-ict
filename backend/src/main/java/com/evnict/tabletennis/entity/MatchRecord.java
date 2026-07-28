package com.evnict.tabletennis.entity;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "matches")
public class MatchRecord {
    @Id
    private String id;
    
    @Column(name = "played_at", nullable = false)
    private LocalDateTime playedAt;
    
    @Column(nullable = false)
    private String source; // challenge, tournament
    
    @Column(name = "home_player_id")
    private String homePlayerId;
    
    @Column(name = "away_player_id")
    private String awayPlayerId;
    
    @Column(name = "home_score", nullable = false)
    private Integer homeScore;
    
    @Column(name = "away_score", nullable = false)
    private Integer awayScore;
    
    @Column(name = "home_elo_before", nullable = false)
    private Integer homeEloBefore;
    
    @Column(name = "away_elo_before", nullable = false)
    private Integer awayEloBefore;
    
    @Column(name = "home_elo_after", nullable = false)
    private Integer homeEloAfter;
    
    @Column(name = "away_elo_after", nullable = false)
    private Integer awayEloAfter;
    
    private String status = "confirmed"; // pending, confirmed, disputed, walkover, canceled
    
    @Column(name = "recorded_by_id")
    private String recordedById;

    @Column(name = "tournament_id")
    private String tournamentId;

    @Column(name = "tournament_match_key")
    private String tournamentMatchKey;

    @Column(name = "tournament_stage")
    private String tournamentStage;

    @Column(name = "tournament_group_name")
    private String tournamentGroupName;

    @Column(name = "tournament_sub_match_idx")
    private Integer tournamentSubMatchIdx;

    @Column(name = "action_type")
    private String actionType;

    @Column(name = "request_id")
    private String requestId;
    
    @Column(name = "confirmed_by_id")
    private String confirmedById;
    
    private String notes;
    
    @Column(name = "home_checked_in")
    private Boolean homeCheckedIn = false;
    
    @Column(name = "away_checked_in")
    private Boolean awayCheckedIn = false;
    
    @Column(name = "is_walkover")
    private Boolean isWalkover = false;
    
    @Column(name = "walkover_winner_id")
    private String walkoverWinnerId;
    
    @Column(name = "court_name")
    private String courtName;
    
    @Column(name = "time_slot")
    private String timeSlot;
}
