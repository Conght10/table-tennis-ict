package com.evnict.tabletennis.entity;

import java.io.Serializable;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class TournamentRegistrationId implements Serializable {
    private String tournamentId;
    private String memberId;
}
