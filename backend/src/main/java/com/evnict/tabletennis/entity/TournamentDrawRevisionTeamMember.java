package com.evnict.tabletennis.entity;

import jakarta.persistence.*;
import lombok.Data;

@Data
@Entity
@Table(name = "tournament_draw_revision_team_members")
@IdClass(TournamentDrawRevisionTeamMemberId.class)
public class TournamentDrawRevisionTeamMember {
    @Id
    @Column(name = "revision_id")
    private String revisionId;

    @Id
    @Column(name = "team_id")
    private String teamId;

    @Id
    @Column(name = "member_id")
    private String memberId;
}
