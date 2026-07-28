package com.evnict.tabletennis.repository;

import com.evnict.tabletennis.entity.ChallengeRequest;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface ChallengeRequestRepository extends JpaRepository<ChallengeRequest, String> {
    List<ChallengeRequest> findByChallengerIdOrOpponentIdOrderByRequestedAtDesc(String challengerId, String opponentId);
}
