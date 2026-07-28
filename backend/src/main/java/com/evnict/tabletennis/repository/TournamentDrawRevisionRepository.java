package com.evnict.tabletennis.repository;

import com.evnict.tabletennis.entity.TournamentDrawRevision;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface TournamentDrawRevisionRepository extends JpaRepository<TournamentDrawRevision, String> {
    List<TournamentDrawRevision> findByTournamentIdOrderByRevisionNoDesc(String tournamentId);
    Optional<TournamentDrawRevision> findByTournamentIdAndRevisionNo(String tournamentId, Integer revisionNo);
}
