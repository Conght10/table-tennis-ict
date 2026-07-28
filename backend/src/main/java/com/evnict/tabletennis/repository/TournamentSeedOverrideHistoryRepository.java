package com.evnict.tabletennis.repository;

import com.evnict.tabletennis.entity.TournamentSeedOverrideHistory;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface TournamentSeedOverrideHistoryRepository extends JpaRepository<TournamentSeedOverrideHistory, String> {
    List<TournamentSeedOverrideHistory> findByTournamentIdOrderByOverriddenAtDesc(String tournamentId);
}
