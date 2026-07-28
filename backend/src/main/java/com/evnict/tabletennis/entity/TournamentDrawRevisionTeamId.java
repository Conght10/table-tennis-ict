package com.evnict.tabletennis.entity;

import java.io.Serializable;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class TournamentDrawRevisionTeamId implements Serializable {
    private String revisionId;
    private String teamId;
}
