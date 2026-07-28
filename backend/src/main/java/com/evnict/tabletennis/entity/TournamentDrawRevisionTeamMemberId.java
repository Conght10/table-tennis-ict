package com.evnict.tabletennis.entity;

import java.io.Serializable;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class TournamentDrawRevisionTeamMemberId implements Serializable {
    private String revisionId;
    private String teamId;
    private String memberId;
}
