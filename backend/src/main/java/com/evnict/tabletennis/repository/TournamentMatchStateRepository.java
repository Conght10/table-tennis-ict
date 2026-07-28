package com.evnict.tabletennis.repository;

import com.evnict.tabletennis.entity.TournamentMatchState;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

public interface TournamentMatchStateRepository extends JpaRepository<TournamentMatchState, String> {
    List<TournamentMatchState> findByTournamentIdOrderByStageAscMatchKeyAsc(String tournamentId);

    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("delete from TournamentMatchState s where s.tournamentId = :tournamentId")
    @Transactional
    void deleteByTournamentId(@Param("tournamentId") String tournamentId);
}
