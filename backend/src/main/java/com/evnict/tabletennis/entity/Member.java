package com.evnict.tabletennis.entity;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDate;

@Data
@Entity
@Table(name = "members")
public class Member {
    @Id
    private String id;
    
    @Column(name = "full_name", nullable = false)
    private String fullName;
    
    @Column(nullable = false, unique = true)
    private String email;

    @Column(nullable = false, unique = true)
    private String username;
    
    private Integer elo = 1200;
    
    @Column(name = "rank_tier")
    private String rankTier = "A5";
    
    @Convert(converter = com.evnict.tabletennis.util.JsonConverters.StringListConverter.class)
    @Column(nullable = false)
    private java.util.List<String> roles;
    
    @Column(name = "joined_at", nullable = false)
    private LocalDate joinedAt;
    
    @Column(name = "is_active", nullable = false)
    private Boolean isActive = true;
    
    private String department;
    
    private String gender;
    
    private String phone;
    
    private String notes;
    
    @Column(nullable = false)
    private String password = "123456";
}
