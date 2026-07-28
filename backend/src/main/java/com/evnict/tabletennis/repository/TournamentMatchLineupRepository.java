package com.evnict.tabletennis.repository;

import com.evnict.tabletennis.entity.TournamentMatchLineup;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

public interface TournamentMatchLineupRepository extends JpaRepository<TournamentMatchLineup, String> {
    Optional<TournamentMatchLineup> findByTournamentIdAndStageAndMatchKey(String tournamentId, String stage, String matchKey);

    List<TournamentMatchLineup> findByTournamentIdOrderByStageAscMatchKeyAsc(String tournamentId);

    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("delete from TournamentMatchLineup l where l.tournamentId = :tournamentId")
    @Transactional
    void deleteByTournamentId(@Param("tournamentId") String tournamentId);
}
