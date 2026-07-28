package com.evnict.tabletennis.entity;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "challenge_requests")
public class ChallengeRequest {
    @Id
    private String id;
    
    @Column(name = "challenger_id", nullable = false)
    private String challengerId;
    
    @Column(name = "opponent_id", nullable = false)
    private String opponentId;
    
    @Column(name = "requested_at", nullable = false)
    private LocalDateTime requestedAt;
    
    @Column(name = "preferred_time")
    private LocalDateTime preferredTime;
    
    @Column(name = "best_of", nullable = false)
    private Integer bestOf;
    
    private String note;
    
    @Column(nullable = false)
    private String status; // pending, accepted, declined, expired, completed, canceled
}
