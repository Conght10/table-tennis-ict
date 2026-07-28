package com.evnict.tabletennis.repository;

import com.evnict.tabletennis.entity.TournamentMatchEvent;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TournamentMatchEventRepository extends JpaRepository<TournamentMatchEvent, String> {
	boolean existsByTournamentIdAndRequestId(String tournamentId, String requestId);
}
