package com.evnict.tabletennis.repository;

import com.evnict.tabletennis.entity.TournamentDrawRevisionTeamMember;
import com.evnict.tabletennis.entity.TournamentDrawRevisionTeamMemberId;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface TournamentDrawRevisionTeamMemberRepository extends JpaRepository<TournamentDrawRevisionTeamMember, TournamentDrawRevisionTeamMemberId> {
    List<TournamentDrawRevisionTeamMember> findByRevisionId(String revisionId);
    List<TournamentDrawRevisionTeamMember> findByRevisionIdAndTeamId(String revisionId, String teamId);
}
