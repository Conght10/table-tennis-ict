package com.evnict.tabletennis.entity;

import jakarta.persistence.*;
import lombok.Data;

@Data
@Entity
@Table(name = "tournament_draw_revision_groups")
@IdClass(TournamentDrawRevisionGroupId.class)
public class TournamentDrawRevisionGroup {
    @Id
    @Column(name = "revision_id")
    private String revisionId;

    @Id
    @Column(name = "group_name")
    private String groupName;

    @Id
    @Column(name = "competitor_id")
    private String competitorId;
}
