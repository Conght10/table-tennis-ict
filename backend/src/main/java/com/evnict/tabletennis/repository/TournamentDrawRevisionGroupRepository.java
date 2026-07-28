package com.evnict.tabletennis.repository;

import com.evnict.tabletennis.entity.TournamentDrawRevisionGroup;
import com.evnict.tabletennis.entity.TournamentDrawRevisionGroupId;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface TournamentDrawRevisionGroupRepository extends JpaRepository<TournamentDrawRevisionGroup, TournamentDrawRevisionGroupId> {
    List<TournamentDrawRevisionGroup> findByRevisionId(String revisionId);
}
