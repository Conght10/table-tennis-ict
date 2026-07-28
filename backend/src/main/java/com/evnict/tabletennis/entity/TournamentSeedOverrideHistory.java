package com.evnict.tabletennis.entity;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "tournament_seed_override_history")
public class TournamentSeedOverrideHistory {
    @Id
    private String id;

    @Column(name = "tournament_id", nullable = false)
    private String tournamentId;

    @Column(name = "member_id", nullable = false)
    private String memberId;

    @Column(name = "old_seed")
    private Integer oldSeed;

    @Column(name = "new_seed")
    private Integer newSeed;

    @Column(columnDefinition = "TEXT", nullable = false)
    private String reason;

    @Column(name = "actor_id", nullable = false)
    private String actorId;

    @Column(name = "overridden_at")
    private LocalDateTime overriddenAt = LocalDateTime.now();

    @Column(name = "draw_revision_before")
    private Integer drawRevisionBefore;

    @Column(name = "draw_revision_after")
    private Integer drawRevisionAfter;
}
