package com.evnict.tabletennis.entity;

import jakarta.persistence.*;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Entity
@Table(
        name = "tournament_match_events",
        uniqueConstraints = {
                @UniqueConstraint(name = "uk_tournament_match_events_request", columnNames = {"tournament_id", "request_id"})
        }
)
public class TournamentMatchEvent {
    @Id
    private String id;

    @Column(name = "tournament_id", nullable = false)
    private String tournamentId;

    @Column(name = "match_key")
    private String matchKey;

    @Column(name = "action_type", nullable = false)
    private String actionType;

    @Column(name = "payload_json", columnDefinition = "TEXT")
    private String payloadJson;

    @Column(name = "actor_id")
    private String actorId;

    @Column(name = "request_id")
    private String requestId;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;
}
