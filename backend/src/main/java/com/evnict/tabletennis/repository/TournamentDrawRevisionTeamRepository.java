package com.evnict.tabletennis.repository;

import com.evnict.tabletennis.entity.TournamentDrawRevisionTeam;
import com.evnict.tabletennis.entity.TournamentDrawRevisionTeamId;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface TournamentDrawRevisionTeamRepository extends JpaRepository<TournamentDrawRevisionTeam, TournamentDrawRevisionTeamId> {
    List<TournamentDrawRevisionTeam> findByRevisionId(String revisionId);
}
