package com.evnict.tabletennis.entity;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "audit_logs")
public class AuditLog {
    @Id
    private String id;
    
    @Column(nullable = false)
    private LocalDateTime timestamp;
    
    @Column(name = "actor_id", nullable = false)
    private String actorId;
    
    @Column(nullable = false)
    private String action;
    
    @Column(nullable = false, columnDefinition = "TEXT")
    private String details;
    
    @Column(nullable = false)
    private String reason;
}
