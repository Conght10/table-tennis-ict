package com.evnict.tabletennis.entity;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "tournament_draw_revisions")
public class TournamentDrawRevision {
    @Id
    private String id;

    @Column(name = "tournament_id", nullable = false)
    private String tournamentId;

    @Column(name = "revision_no", nullable = false)
    private Integer revisionNo;

    @Column(nullable = false)
    private String status; // committed, dirty

    @Column(nullable = false, length = 500)
    private String reason;

    @Column(name = "actor_id", nullable = false)
    private String actorId;

    @Column(name = "created_at")
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "rule_config_json", columnDefinition = "TEXT")
    private String ruleConfigJson;

    @Column(name = "objective_score", nullable = false)
    private Double objectiveScore = 0.0;

    @Column(name = "based_on_registration_version", nullable = false)
    private Long basedOnRegistrationVersion = 0L;
}
