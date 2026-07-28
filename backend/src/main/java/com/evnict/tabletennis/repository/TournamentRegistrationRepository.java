package com.evnict.tabletennis.repository;

import com.evnict.tabletennis.entity.TournamentRegistration;
import com.evnict.tabletennis.entity.TournamentRegistrationId;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface TournamentRegistrationRepository extends JpaRepository<TournamentRegistration, TournamentRegistrationId> {
    List<TournamentRegistration> findByTournamentId(String tournamentId);
    List<TournamentRegistration> findByTournamentIdOrderBySeedAsc(String tournamentId);
    Optional<TournamentRegistration> findByTournamentIdAndMemberId(String tournamentId, String memberId);
    boolean existsByTournamentIdAndSeed(String tournamentId, Integer seed);
}
