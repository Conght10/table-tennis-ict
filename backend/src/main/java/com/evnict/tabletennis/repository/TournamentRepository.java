package com.evnict.tabletennis.repository;

import com.evnict.tabletennis.entity.Tournament;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface TournamentRepository extends JpaRepository<Tournament, String> {
	@Lock(LockModeType.PESSIMISTIC_WRITE)
	@Query("select t from Tournament t where t.id = :id")
	Optional<Tournament> findByIdForUpdate(@Param("id") String id);
}
