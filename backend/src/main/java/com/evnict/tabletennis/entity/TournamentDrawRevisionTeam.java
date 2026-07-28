package com.evnict.tabletennis.entity;

import jakarta.persistence.*;
import lombok.Data;

@Data
@Entity
@Table(name = "tournament_draw_revision_teams")
@IdClass(TournamentDrawRevisionTeamId.class)
public class TournamentDrawRevisionTeam {
    @Id
    @Column(name = "revision_id")
    private String revisionId;

    @Id
    @Column(name = "team_id")
    private String teamId;

    @Column(name = "team_name", nullable = false)
    private String teamName;

    @Column(name = "seed_total", nullable = false)
    private Integer seedTotal;
}
