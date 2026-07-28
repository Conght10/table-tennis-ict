package com.evnict.tabletennis.repository;

import com.evnict.tabletennis.entity.TournamentState;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TournamentStateRepository extends JpaRepository<TournamentState, String> {
}
