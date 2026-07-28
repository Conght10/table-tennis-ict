package com.evnict.tabletennis.entity;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "tournament_registrations")
@IdClass(TournamentRegistrationId.class)
public class TournamentRegistration {
    @Id
    @Column(name = "tournament_id")
    private String tournamentId;

    @Id
    @Column(name = "member_id")
    private String memberId;

    private Integer seed;

    @Column(name = "seed_source")
    private String seedSource = "auto";

    @Column(name = "rank_snapshot")
    private String rankSnapshot;

    @Column(name = "elo_snapshot")
    private Integer eloSnapshot;

    @Column(name = "gender_snapshot")
    private String genderSnapshot;

    @Column(name = "department_snapshot")
    private String departmentSnapshot;

    @Column(name = "is_captain")
    private Boolean isCaptain = false;

    private String status = "active";

    @Column(name = "registered_at")
    private LocalDateTime registeredAt = LocalDateTime.now();
}
