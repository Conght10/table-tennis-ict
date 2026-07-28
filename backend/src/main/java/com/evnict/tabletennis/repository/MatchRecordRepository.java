package com.evnict.tabletennis.repository;

import com.evnict.tabletennis.entity.MatchRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface MatchRecordRepository extends JpaRepository<MatchRecord, String> {
    List<MatchRecord> findByHomePlayerIdOrAwayPlayerIdOrderByPlayedAtDesc(String homePlayerId, String awayPlayerId);
}
