package com.evnict.tabletennis.controller;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.evnict.tabletennis.entity.MatchRecord;
import com.evnict.tabletennis.entity.Tournament;
import com.evnict.tabletennis.entity.TournamentMatchEvent;
import com.evnict.tabletennis.entity.TournamentMatchLineup;
import com.evnict.tabletennis.entity.TournamentMatchState;
import com.evnict.tabletennis.entity.TournamentState;
import com.evnict.tabletennis.repository.MatchRecordRepository;
import com.evnict.tabletennis.repository.TournamentMatchEventRepository;
import com.evnict.tabletennis.repository.TournamentMatchLineupRepository;
import com.evnict.tabletennis.repository.TournamentMatchStateRepository;
import com.evnict.tabletennis.repository.TournamentRepository;
import com.evnict.tabletennis.repository.TournamentStateRepository;
import com.evnict.tabletennis.entity.*;
import com.evnict.tabletennis.repository.*;
import com.evnict.tabletennis.service.DrawCalculationService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@CrossOrigin(origins = "*")
@RestController
@RequestMapping("/api/tournaments")
public class TournamentController {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    @Autowired
    private TournamentRepository tournamentRepository;

    @Autowired
    private MatchRecordRepository matchRecordRepository;

    @Autowired
    private TournamentMatchStateRepository tournamentMatchStateRepository;

    @Autowired
    private TournamentMatchLineupRepository tournamentMatchLineupRepository;

    @Autowired
    private TournamentMatchEventRepository tournamentMatchEventRepository;

    @Autowired
    private TournamentStateRepository tournamentStateRepository;

    @Autowired
    private TournamentRegistrationRepository tournamentRegistrationRepository;

    @Autowired
    private AuditLogRepository auditLogRepository;

    @Autowired
    private MemberRepository memberRepository;

    @Autowired
    private TournamentSeedOverrideHistoryRepository tournamentSeedOverrideHistoryRepository;

    @Autowired
    private TournamentDrawRevisionRepository tournamentDrawRevisionRepository;

    @Autowired
    private TournamentDrawRevisionTeamRepository tournamentDrawRevisionTeamRepository;

    @Autowired
    private TournamentDrawRevisionTeamMemberRepository tournamentDrawRevisionTeamMemberRepository;

    @Autowired
    private TournamentDrawRevisionGroupRepository tournamentDrawRevisionGroupRepository;

    @Autowired
    private DrawCalculationService drawCalculationService;

    @GetMapping
    public List<Tournament> getTournaments() {
        List<Tournament> tournaments = tournamentRepository.findAll();
        hydrateTournamentStates(tournaments);
        return tournaments;
    }

    @GetMapping("/{id}")
    public ResponseEntity<Tournament> getTournamentById(@PathVariable String id) {
        Optional<Tournament> tournamentOpt = findTournamentByIdHydrated(id);
        return tournamentOpt.map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @GetMapping("/{id}/state/matches")
    public ResponseEntity<List<TournamentMatchState>> getTournamentMatchStates(@PathVariable String id) {
        if (!tournamentRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(tournamentMatchStateRepository.findByTournamentIdOrderByStageAscMatchKeyAsc(id));
    }

    @GetMapping("/{id}/state/standings")
    public ResponseEntity<List<Object>> getTournamentStandingProjections(@PathVariable String id) {
        Optional<Tournament> tournamentOpt = findTournamentByIdHydrated(id);
        if (tournamentOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        Tournament tournament = tournamentOpt.get();
        return ResponseEntity.ok(computeStandingsFromScores(tournament.getGroups(), tournament.getScores()));
    }

    @GetMapping("/{id}/state/lineups")
    public ResponseEntity<List<TournamentMatchLineup>> getTournamentMatchLineups(@PathVariable String id) {
        if (!tournamentRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(tournamentMatchLineupRepository.findByTournamentIdOrderByStageAscMatchKeyAsc(id));
    }

    @Transactional
    @PostMapping
    public ResponseEntity<?> createTournament(@RequestBody Tournament tournament) {
        if (tournament.getId() == null || tournament.getId().isEmpty()) {
            tournament.setId("t" + UUID.randomUUID().toString().substring(0, 8));
        }
        if (tournament.getStartedAt() == null) {
            tournament.setStartedAt(LocalDate.now());
        }
        if (tournament.getStatus() == null) {
            tournament.setStatus("draft");
        }
        if (tournament.getStage() == null) {
            tournament.setStage("group");
        }
        if (tournament.getFormat() == null) {
            tournament.setFormat("group");
        }
        if (tournament.getMetadataVersion() == null) {
            tournament.setMetadataVersion(0L);
        }
        if (tournament.getCompetitionVersion() == null) {
            tournament.setCompetitionVersion(0L);
        }
        Tournament saved = tournamentRepository.save(tournament);
        persistTournamentState(saved);
        syncNormalizedReadModels(saved, "SYSTEM");
        return ResponseEntity.ok(saved);
    }

    @Transactional
    @PutMapping("/{id}")
    public ResponseEntity<?> updateTournament(@PathVariable String id, @RequestBody Tournament updatedData) {
        Optional<Tournament> tournamentOpt = findTournamentByIdForUpdateHydrated(id);
        if (tournamentOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        Tournament tournament = tournamentOpt.get();

        tournament.setName(updatedData.getName());
        tournament.setType(updatedData.getType());
        tournament.setStartedAt(updatedData.getStartedAt());
        tournament.setFinishedAt(updatedData.getFinishedAt());
        tournament.setStatus(updatedData.getStatus());
        tournament.setGroupSize(updatedData.getGroupSize());
        tournament.setTeamSize(updatedData.getTeamSize());
        tournament.setStage(updatedData.getStage());
        tournament.setLocation(updatedData.getLocation());
        tournament.setPrizes(updatedData.getPrizes());
        tournament.setFormat(updatedData.getFormat());

        // Synchronize participants and registrations if provided in the request
        if (updatedData.getParticipants() != null) {
            List<TournamentRegistration> existingRegs = tournamentRegistrationRepository.findByTournamentId(id);
            List<String> updatedPids = updatedData.getParticipants();
            
            // Delete registrations that are no longer in the participants list
            for (TournamentRegistration reg : existingRegs) {
                if (!updatedPids.contains(reg.getMemberId())) {
                    tournamentRegistrationRepository.delete(reg);
                }
            }
            
            // Add registrations for new participants
            int seed = 1;
            for (TournamentRegistration reg : existingRegs) {
                if (reg.getSeed() != null && reg.getSeed() >= seed) {
                    seed = reg.getSeed() + 1;
                }
            }
            
            for (String pid : updatedPids) {
                boolean exists = existingRegs.stream().anyMatch(r -> r.getMemberId().equals(pid));
                if (!exists) {
                    Member member = memberRepository.findById(pid).orElse(null);
                    if (member != null) {
                        TournamentRegistration reg = new TournamentRegistration();
                        reg.setTournamentId(id);
                        reg.setMemberId(pid);
                        reg.setSeed(seed++);
                        reg.setSeedSource("auto");
                        reg.setRankSnapshot(member.getRankTier());
                        reg.setEloSnapshot(member.getElo());
                        reg.setGenderSnapshot(member.getGender());
                        reg.setDepartmentSnapshot(member.getDepartment());
                        reg.setIsCaptain(false);
                        reg.setStatus("active");
                        reg.setRegisteredAt(LocalDateTime.now());
                        tournamentRegistrationRepository.save(reg);
                    }
                }
            }
            
            tournament.setParticipants(new ArrayList<>(updatedPids));
            // Trigger registration version update
            tournament.setRegistrationVersion(tournament.getRegistrationVersion() + 1);
        }

        // Synchronize registrations (seeds, seedSource, isCaptain, etc.) if provided in the request
        if (updatedData.getRegistrations() != null && !updatedData.getRegistrations().isEmpty()) {
            List<TournamentRegistration> existingRegs = tournamentRegistrationRepository.findByTournamentId(id);
            if (!existingRegs.isEmpty()) {
                // Step 1: Temporarily set negative seeds and flush to avoid uk_tournament_seed unique constraint conflict during reordering
                for (int i = 0; i < existingRegs.size(); i++) {
                    existingRegs.get(i).setSeed(-1000 - i);
                }
                tournamentRegistrationRepository.saveAllAndFlush(existingRegs);

                // Step 2: Map incoming registration changes by memberId
                Map<String, TournamentRegistration> existingRegMap = existingRegs.stream()
                        .collect(Collectors.toMap(TournamentRegistration::getMemberId, r -> r, (r1, r2) -> r1));

                for (Object regObj : updatedData.getRegistrations()) {
                    if (regObj instanceof Map<?, ?> regMap) {
                        Object memberIdObj = regMap.get("memberId");
                        if (memberIdObj != null) {
                            String memberId = memberIdObj.toString();
                            TournamentRegistration existing = existingRegMap.get(memberId);
                            if (existing != null) {
                                Object seedObj = regMap.get("seed");
                                if (seedObj instanceof Number num) {
                                    existing.setSeed(num.intValue());
                                } else if (seedObj != null) {
                                    try {
                                        existing.setSeed(Integer.parseInt(seedObj.toString()));
                                    } catch (NumberFormatException ignored) {}
                                }

                                Object seedSourceObj = regMap.get("seedSource");
                                if (seedSourceObj != null) {
                                    existing.setSeedSource(seedSourceObj.toString());
                                }

                                Object isCaptainObj = regMap.get("isCaptain");
                                if (isCaptainObj instanceof Boolean b) {
                                    existing.setIsCaptain(b);
                                } else if (isCaptainObj != null) {
                                    existing.setIsCaptain(Boolean.parseBoolean(isCaptainObj.toString()));
                                }
                            }
                        }
                    }
                }

                // Step 3: Ensure any registration that still has a negative seed gets a valid positive seed
                int fallbackSeed = 1;
                for (TournamentRegistration reg : existingRegs) {
                    if (reg.getSeed() == null || reg.getSeed() < 0) {
                        while (isSeedUsed(existingRegs, fallbackSeed)) {
                            fallbackSeed++;
                        }
                        reg.setSeed(fallbackSeed++);
                    }
                }

                tournamentRegistrationRepository.saveAll(existingRegs);
            }
        }

        // Copy transient configurations if provided
        if (updatedData.getTeams() != null) {
            tournament.setTeams(updatedData.getTeams());
        }
        if (updatedData.getCaptains() != null) {
            tournament.setCaptains(updatedData.getCaptains());
        }
        if (updatedData.getGroups() != null) {
            tournament.setGroups(updatedData.getGroups());
        }
        if (updatedData.getScores() != null) {
            tournament.setScores(updatedData.getScores());
        }
        if (updatedData.getKnockoutMatches() != null) {
            tournament.setKnockoutMatches(updatedData.getKnockoutMatches());
        }
        if (updatedData.getDrawRevisionCurrent() != null) {
            tournament.setDrawRevisionCurrent(updatedData.getDrawRevisionCurrent());
        }

        if (updatedData.getDrawRevisions() != null) {
            List<TournamentDrawRevision> existingRevs = tournamentDrawRevisionRepository.findByTournamentIdOrderByRevisionNoDesc(id);
            Set<Integer> existingNos = existingRevs.stream()
                .map(TournamentDrawRevision::getRevisionNo)
                .collect(Collectors.toSet());

            for (Object obj : updatedData.getDrawRevisions()) {
                if (obj instanceof Map<?, ?> map) {
                    Object revisionNoObj = map.get("revisionNo");
                    if (revisionNoObj instanceof Number num) {
                        int revNo = num.intValue();
                        if (!existingNos.contains(revNo)) {
                            // This is a new revision, save it!
                            TournamentDrawRevision newRev = new TournamentDrawRevision();
                            newRev.setId("dr" + UUID.randomUUID().toString().substring(0, 10));
                            newRev.setTournamentId(id);
                            newRev.setRevisionNo(revNo);
                            newRev.setStatus(map.get("status") != null ? map.get("status").toString() : "committed");
                            newRev.setReason(map.get("reason") != null ? map.get("reason").toString() : "");
                            newRev.setActorId(map.get("actorId") != null ? map.get("actorId").toString() : "system");
                            
                            Object createdAtObj = map.get("createdAt");
                            if (createdAtObj != null) {
                                try {
                                    newRev.setCreatedAt(LocalDateTime.parse(createdAtObj.toString().substring(0, 19)));
                                } catch (Exception e) {
                                    newRev.setCreatedAt(LocalDateTime.now());
                                }
                            } else {
                                newRev.setCreatedAt(LocalDateTime.now());
                            }
                            
                            Object basedOnVersionObj = map.get("basedOnRegistrationVersion");
                            if (basedOnVersionObj instanceof Number bNum) {
                                newRev.setBasedOnRegistrationVersion(bNum.longValue());
                            } else {
                                newRev.setBasedOnRegistrationVersion(tournament.getRegistrationVersion());
                            }

                            tournamentDrawRevisionRepository.save(newRev);

                            // Save teams
                            Object teamsObj = map.get("teams");
                            if (teamsObj instanceof List<?> teamsList) {
                                for (Object tObj : teamsList) {
                                    if (tObj instanceof Map<?, ?> teamMap) {
                                        TournamentDrawRevisionTeam revTeam = new TournamentDrawRevisionTeam();
                                        revTeam.setRevisionId(newRev.getId());
                                        
                                        Object teamIdObj = teamMap.get("teamId");
                                        revTeam.setTeamId(teamIdObj != null ? teamIdObj.toString() : "");
                                        
                                        Object teamNameObj = teamMap.get("teamName");
                                        revTeam.setTeamName(teamNameObj != null ? teamNameObj.toString() : "");
                                        
                                        Object seedTotalObj = teamMap.get("seedTotal");
                                        if (seedTotalObj instanceof Number sNum) {
                                            revTeam.setSeedTotal(sNum.intValue());
                                        }

                                        tournamentDrawRevisionTeamRepository.save(revTeam);

                                        // Save team members
                                        Object memberIdsObj = teamMap.get("memberIds");
                                        if (memberIdsObj instanceof List<?> memberIdsList) {
                                            for (Object mIdObj : memberIdsList) {
                                                if (mIdObj != null) {
                                                    TournamentDrawRevisionTeamMember revMember = new TournamentDrawRevisionTeamMember();
                                                    revMember.setRevisionId(newRev.getId());
                                                    revMember.setTeamId(revTeam.getTeamId());
                                                    revMember.setMemberId(mIdObj.toString());
                                                    tournamentDrawRevisionTeamMemberRepository.save(revMember);
                                                }
                                            }
                                        }
                                    }
                                }
                            }

                            // Save groups
                            Object groupsObj = map.get("groups");
                            if (groupsObj instanceof List<?> groupsList) {
                                for (Object gObj : groupsList) {
                                    if (gObj instanceof Map<?, ?> groupMap) {
                                        Object groupNameObj = groupMap.get("groupName");
                                        String groupName = groupNameObj != null ? groupNameObj.toString() : "";
                                        
                                        Object competitorIdsObj = groupMap.get("competitorIds");
                                        if (competitorIdsObj instanceof List<?> competitorIdsList) {
                                            for (Object cIdObj : competitorIdsList) {
                                                if (cIdObj != null) {
                                                    TournamentDrawRevisionGroup revGroup = new TournamentDrawRevisionGroup();
                                                    revGroup.setRevisionId(newRev.getId());
                                                    revGroup.setGroupName(groupName);
                                                    revGroup.setCompetitorId(cIdObj.toString());
                                                    tournamentDrawRevisionGroupRepository.save(revGroup);
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        touchMetadataVersion(tournament);

        Tournament saved = tournamentRepository.save(tournament);
        persistTournamentState(saved);
        hydrateTournamentState(saved); // Hydrate transient fields back to response
        syncNormalizedReadModels(saved, "SYSTEM");
        return ResponseEntity.ok(saved);
    }

    @Transactional
    @PostMapping("/{id}/matches/group/result")
    public ResponseEntity<?> updateGroupMatchResult(@PathVariable String id, @RequestBody GroupMatchUpdateRequest request) {
        if (request == null || isBlank(request.groupName) || isBlank(request.homeCompetitorId)
                || isBlank(request.awayCompetitorId) || request.homeScore == null || request.awayScore == null) {
            return ResponseEntity.badRequest().body("Thiếu thông tin cập nhật kết quả trận vòng bảng.");
        }

        Optional<Tournament> tournamentOpt = findTournamentByIdForUpdateHydrated(id);
        if (tournamentOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        Tournament tournament = tournamentOpt.get();
        ResponseEntity<?> staleMetadataWrite = validateExpectedMetadataVersion(
                tournament,
                firstNonNull(request.expectedMetadataVersion, request.expectedTournamentVersion)
        );
        if (staleMetadataWrite != null) {
            return staleMetadataWrite;
        }
        ResponseEntity<?> staleCompetitionWrite = validateExpectedCompetitionVersion(
                tournament,
                firstNonNull(request.expectedCompetitionVersion, request.expectedTournamentVersion)
        );
        if (staleCompetitionWrite != null) {
            return staleCompetitionWrite;
        }
        if (tournament.getScores() == null) {
            return ResponseEntity.badRequest().body("Giải đấu chưa có danh sách trận vòng bảng.");
        }

        Map<String, Object> target = null;
        for (Object scoreObj : tournament.getScores()) {
            Map<String, Object> score = toObjectMap(scoreObj);
            if (request.groupName.equals(asString(score.get("groupName")))
                    && request.homeCompetitorId.equals(asString(score.get("homeCompetitorId")))
                    && request.awayCompetitorId.equals(asString(score.get("awayCompetitorId")))) {
                target = score;
                break;
            }
        }

        if (target == null) {
            return ResponseEntity.badRequest().body("Không tìm thấy trận vòng bảng cần cập nhật.");
        }

        target.put("homeScore", request.homeScore);
        target.put("awayScore", request.awayScore);
        target.put("completed", true);
        if (request.setScores != null) {
            target.put("setScores", toSetScoreObjects(request.setScores));
        }

        touchCompetitionVersion(tournament);
        Tournament saved = tournamentRepository.save(tournament);
        persistTournamentState(saved);
        syncNormalizedReadModels(saved, request.recordedById);

        String matchId = request.groupName + "-" + request.homeCompetitorId + "-" + request.awayCompetitorId;
        recordTournamentMatchEvent(
                saved.getId(),
                "group",
                request.groupName,
                matchId,
                null,
                request.homeCompetitorId,
                request.awayCompetitorId,
                request.homeScore,
                request.awayScore,
                request.recordedById,
                request.requestId
        );

            return ResponseEntity.ok(buildMatchWriteResponse(saved, target, null, true, false));
    }

    @Transactional
    @PostMapping("/{id}/matches/team-sub/result")
    public ResponseEntity<?> updateTeamSubMatchResult(@PathVariable String id, @RequestBody TeamSubMatchUpdateRequest request) {
        if (request == null || isBlank(request.matchId) || request.subMatchIdx == null
                || request.homeScore == null || request.awayScore == null) {
            return ResponseEntity.badRequest().body("Thiếu thông tin cập nhật trận con.");
        }

        Optional<Tournament> tournamentOpt = findTournamentByIdForUpdateHydrated(id);
        if (tournamentOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        Tournament tournament = tournamentOpt.get();
        ResponseEntity<?> staleMetadataWrite = validateExpectedMetadataVersion(
                tournament,
                firstNonNull(request.expectedMetadataVersion, request.expectedTournamentVersion)
        );
        if (staleMetadataWrite != null) {
            return staleMetadataWrite;
        }
        ResponseEntity<?> staleCompetitionWrite = validateExpectedCompetitionVersion(
                tournament,
                firstNonNull(request.expectedCompetitionVersion, request.expectedTournamentVersion)
        );
        if (staleCompetitionWrite != null) {
            return staleCompetitionWrite;
        }
        boolean knockout = Boolean.TRUE.equals(request.knockout);
        List<Object> matchList = knockout ? tournament.getKnockoutMatches() : tournament.getScores();
        if (matchList == null) {
            return ResponseEntity.badRequest().body("Không tìm thấy danh sách trận đấu tương ứng.");
        }

        Map<String, Object> targetMatch = findMatchById(matchList, request.matchId, knockout);
        if (targetMatch == null) {
            return ResponseEntity.badRequest().body("Không tìm thấy trận đấu cần cập nhật trận con.");
        }

        String stage = knockout ? "knockout" : "group";
        TournamentMatchLineup lineupModel = tournamentMatchLineupRepository
            .findByTournamentIdAndStageAndMatchKey(id, stage, request.matchId)
            .orElse(null);
        Map<String, Object> lineup = lineupModel == null
            ? toObjectMap(targetMatch.get("lineup"))
            : parseObjectMapJson(lineupModel.getLineupJson());
        List<Map<String, Object>> subMatches = lineupModel == null
            ? toObjectMapList(targetMatch.get("subMatches"))
            : parseObjectMapListJson(lineupModel.getSubMatchesJson());
        if (request.subMatchIdx < 0 || request.subMatchIdx >= subMatches.size()) {
            return ResponseEntity.badRequest().body("Chỉ số trận con không hợp lệ.");
        }

        Map<String, Object> targetSub = subMatches.get(request.subMatchIdx);
        targetSub.put("homeScore", request.homeScore);
        targetSub.put("awayScore", request.awayScore);
        targetSub.put("completed", true);
        if (request.setScores != null) {
            targetSub.put("setScores", toSetScoreObjects(request.setScores));
        }

        int homeWins = 0;
        int awayWins = 0;
        for (Map<String, Object> sub : subMatches) {
            if (!asBoolean(sub.get("completed"))) {
                continue;
            }
            int subHome = asInt(sub.get("homeScore"));
            int subAway = asInt(sub.get("awayScore"));
            if (subHome > subAway) {
                homeWins += 1;
            } else if (subAway > subHome) {
                awayWins += 1;
            }
        }

        targetMatch.put("homeScore", homeWins);
        targetMatch.put("awayScore", awayWins);
        targetMatch.put("completed", homeWins >= 3 || awayWins >= 3);
        targetMatch.put("lineup", lineup);
        targetMatch.put("subMatches", subMatches);

        if (knockout) {
            if (homeWins >= 3) {
                targetMatch.put("winnerId", asString(targetMatch.get("homeCompetitorId")));
            } else if (awayWins >= 3) {
                targetMatch.put("winnerId", asString(targetMatch.get("awayCompetitorId")));
            } else {
                targetMatch.put("winnerId", null);
            }
            ensureFinalAndBronzeMatches(tournament);
        }

        touchCompetitionVersion(tournament);
        Tournament saved = tournamentRepository.save(tournament);
        persistTournamentState(saved);
        upsertMatchLineup(
            saved,
            stage,
            asString(targetMatch.get("groupName")),
            request.matchId,
            lineup,
            subMatches,
            request.recordedById
        );
        syncNormalizedReadModels(saved, request.recordedById);

        String groupName = knockout ? "" : asString(targetMatch.get("groupName"));
        recordTournamentMatchEvent(
                saved.getId(),
                knockout ? "knockout_sub" : "group_sub",
                groupName,
                request.matchId,
                request.subMatchIdx,
                asString(targetMatch.get("homeCompetitorId")),
                asString(targetMatch.get("awayCompetitorId")),
                request.homeScore,
                request.awayScore,
                request.recordedById,
                request.requestId
        );

        if (knockout) {
            return ResponseEntity.ok(buildMatchWriteResponse(saved, null, targetMatch, false, true));
        }

        return ResponseEntity.ok(buildMatchWriteResponse(saved, targetMatch, null, true, false));
    }

    @Transactional
    @PostMapping("/{id}/matches/team-lineup/result")
    public ResponseEntity<?> updateTeamMatchLineup(@PathVariable String id, @RequestBody TeamLineupUpdateRequest request) {
        if (request == null || isBlank(request.matchId) || request.lineup == null) {
            return ResponseEntity.badRequest().body("Thiếu thông tin đội hình cần cập nhật.");
        }

        Optional<Tournament> tournamentOpt = findTournamentByIdForUpdateHydrated(id);
        if (tournamentOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        Tournament tournament = tournamentOpt.get();
        ResponseEntity<?> staleMetadataWrite = validateExpectedMetadataVersion(
                tournament,
                firstNonNull(request.expectedMetadataVersion, request.expectedTournamentVersion)
        );
        if (staleMetadataWrite != null) {
            return staleMetadataWrite;
        }
        ResponseEntity<?> staleCompetitionWrite = validateExpectedCompetitionVersion(
                tournament,
                firstNonNull(request.expectedCompetitionVersion, request.expectedTournamentVersion)
        );
        if (staleCompetitionWrite != null) {
            return staleCompetitionWrite;
        }
        boolean knockout = Boolean.TRUE.equals(request.knockout);
        List<Object> matchList = knockout ? tournament.getKnockoutMatches() : tournament.getScores();
        if (matchList == null) {
            return ResponseEntity.badRequest().body("Không tìm thấy danh sách trận đấu tương ứng.");
        }

        Map<String, Object> targetMatch = findMatchById(matchList, request.matchId, knockout);
        if (targetMatch == null) {
            return ResponseEntity.badRequest().body("Không tìm thấy trận đấu cần cập nhật đội hình.");
        }

        String stage = knockout ? "knockout" : "group";
        Map<String, Object> lineup = toLineupObject(request.lineup);
        List<Map<String, Object>> subMatches = toSubMatchObjects(request.subMatches);

        targetMatch.put("lineup", lineup);
        targetMatch.put("subMatches", subMatches);

        // A lineup change invalidates old match result and winner inference.
        targetMatch.put("homeScore", 0);
        targetMatch.put("awayScore", 0);
        targetMatch.put("completed", false);
        targetMatch.put("setScores", new ArrayList<>());
        if (knockout) {
            targetMatch.put("winnerId", null);
            removeDependentMatches(tournament, request.matchId);
        }

        touchCompetitionVersion(tournament);
        Tournament saved = tournamentRepository.save(tournament);
        persistTournamentState(saved);
        upsertMatchLineup(
            saved,
            stage,
            asString(targetMatch.get("groupName")),
            request.matchId,
            lineup,
            subMatches,
            request.recordedById
        );
        syncNormalizedReadModels(saved, request.recordedById);

        recordTournamentMatchEvent(
                saved.getId(),
                knockout ? "knockout_lineup" : "group_lineup",
                knockout ? "" : asString(targetMatch.get("groupName")),
                request.matchId,
                null,
                asString(targetMatch.get("homeCompetitorId")),
                asString(targetMatch.get("awayCompetitorId")),
                0,
                0,
                request.recordedById,
                request.requestId
        );

        if (knockout) {
            return ResponseEntity.ok(buildMatchWriteResponse(saved, null, targetMatch, false, true));
        }

        return ResponseEntity.ok(buildMatchWriteResponse(saved, targetMatch, null, true, false));
    }

    @Transactional
    @PostMapping("/{id}/matches/knockout/result")
    public ResponseEntity<?> updateKnockoutMatchResult(@PathVariable String id, @RequestBody KnockoutMatchUpdateRequest request) {
        if (request == null || isBlank(request.matchId) || request.homeScore == null || request.awayScore == null) {
            return ResponseEntity.badRequest().body("Thiếu thông tin cập nhật trận knockout.");
        }

        Optional<Tournament> tournamentOpt = findTournamentByIdForUpdateHydrated(id);
        if (tournamentOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        Tournament tournament = tournamentOpt.get();
        ResponseEntity<?> staleMetadataWrite = validateExpectedMetadataVersion(
                tournament,
                firstNonNull(request.expectedMetadataVersion, request.expectedTournamentVersion)
        );
        if (staleMetadataWrite != null) {
            return staleMetadataWrite;
        }
        ResponseEntity<?> staleCompetitionWrite = validateExpectedCompetitionVersion(
                tournament,
                firstNonNull(request.expectedCompetitionVersion, request.expectedTournamentVersion)
        );
        if (staleCompetitionWrite != null) {
            return staleCompetitionWrite;
        }
        if (tournament.getKnockoutMatches() == null) {
            return ResponseEntity.badRequest().body("Giải đấu chưa có nhánh đấu knockout.");
        }

        Map<String, Object> target = findMatchById(tournament.getKnockoutMatches(), request.matchId, true);
        if (target == null) {
            return ResponseEntity.badRequest().body("Không tìm thấy trận knockout cần cập nhật.");
        }

        target.put("homeScore", request.homeScore);
        target.put("awayScore", request.awayScore);
        target.put("completed", true);
        if (request.setScores != null) {
            target.put("setScores", toSetScoreObjects(request.setScores));
        }

        if (request.homeScore > request.awayScore) {
            target.put("winnerId", asString(target.get("homeCompetitorId")));
        } else if (request.awayScore > request.homeScore) {
            target.put("winnerId", asString(target.get("awayCompetitorId")));
        } else {
            target.put("winnerId", null);
        }

        ensureFinalAndBronzeMatches(tournament);
        touchCompetitionVersion(tournament);
        Tournament saved = tournamentRepository.save(tournament);
        persistTournamentState(saved);
        syncNormalizedReadModels(saved, request.recordedById);

        recordTournamentMatchEvent(
                saved.getId(),
                "knockout",
                "",
                request.matchId,
                null,
                asString(target.get("homeCompetitorId")),
                asString(target.get("awayCompetitorId")),
                request.homeScore,
                request.awayScore,
                request.recordedById,
                request.requestId
        );

            return ResponseEntity.ok(buildMatchWriteResponse(saved, null, target, false, true));
    }

    @Transactional
    @PostMapping("/{id}/matches/group/clear")
    public ResponseEntity<?> clearGroupMatchResult(@PathVariable String id, @RequestBody GroupMatchClearRequest request) {
        if (request == null || isBlank(request.groupName) || isBlank(request.homeCompetitorId) || isBlank(request.awayCompetitorId)) {
            return ResponseEntity.badRequest().body("Thiếu thông tin xóa kết quả trận vòng bảng.");
        }

        Optional<Tournament> tournamentOpt = findTournamentByIdForUpdateHydrated(id);
        if (tournamentOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        Tournament tournament = tournamentOpt.get();
        ResponseEntity<?> staleMetadataWrite = validateExpectedMetadataVersion(
                tournament,
                firstNonNull(request.expectedMetadataVersion, request.expectedTournamentVersion)
        );
        if (staleMetadataWrite != null) {
            return staleMetadataWrite;
        }
        ResponseEntity<?> staleCompetitionWrite = validateExpectedCompetitionVersion(
                tournament,
                firstNonNull(request.expectedCompetitionVersion, request.expectedTournamentVersion)
        );
        if (staleCompetitionWrite != null) {
            return staleCompetitionWrite;
        }
        if (tournament.getScores() == null) {
            return ResponseEntity.badRequest().body("Giải đấu chưa có danh sách trận vòng bảng.");
        }

        Map<String, Object> target = null;
        for (Object scoreObj : tournament.getScores()) {
            Map<String, Object> score = toObjectMap(scoreObj);
            if (request.groupName.equals(asString(score.get("groupName")))
                    && request.homeCompetitorId.equals(asString(score.get("homeCompetitorId")))
                    && request.awayCompetitorId.equals(asString(score.get("awayCompetitorId")))) {
                target = score;
                break;
            }
        }

        if (target == null) {
            return ResponseEntity.badRequest().body("Không tìm thấy trận vòng bảng cần xóa kết quả.");
        }

        target.put("homeScore", 0);
        target.put("awayScore", 0);
        target.put("completed", false);
        target.put("setScores", new ArrayList<>());

        touchCompetitionVersion(tournament);
        Tournament saved = tournamentRepository.save(tournament);
        persistTournamentState(saved);
        syncNormalizedReadModels(saved, request.recordedById);

        String matchId = request.groupName + "-" + request.homeCompetitorId + "-" + request.awayCompetitorId;
        recordTournamentMatchEvent(
                saved.getId(),
                "group_clear",
                request.groupName,
                matchId,
                null,
                request.homeCompetitorId,
                request.awayCompetitorId,
                0,
                0,
                request.recordedById,
                request.requestId
        );

            return ResponseEntity.ok(buildMatchWriteResponse(saved, target, null, true, false));
    }

    @Transactional
    @PostMapping("/{id}/matches/team-sub/clear")
    public ResponseEntity<?> clearTeamSubMatchResult(@PathVariable String id, @RequestBody TeamSubMatchClearRequest request) {
        if (request == null || isBlank(request.matchId) || request.subMatchIdx == null) {
            return ResponseEntity.badRequest().body("Thiếu thông tin xóa kết quả trận con.");
        }

        Optional<Tournament> tournamentOpt = findTournamentByIdForUpdateHydrated(id);
        if (tournamentOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        Tournament tournament = tournamentOpt.get();
        ResponseEntity<?> staleMetadataWrite = validateExpectedMetadataVersion(
                tournament,
                firstNonNull(request.expectedMetadataVersion, request.expectedTournamentVersion)
        );
        if (staleMetadataWrite != null) {
            return staleMetadataWrite;
        }
        ResponseEntity<?> staleCompetitionWrite = validateExpectedCompetitionVersion(
                tournament,
                firstNonNull(request.expectedCompetitionVersion, request.expectedTournamentVersion)
        );
        if (staleCompetitionWrite != null) {
            return staleCompetitionWrite;
        }
        boolean knockout = Boolean.TRUE.equals(request.knockout);
        List<Object> matchList = knockout ? tournament.getKnockoutMatches() : tournament.getScores();
        if (matchList == null) {
            return ResponseEntity.badRequest().body("Không tìm thấy danh sách trận đấu tương ứng.");
        }

        Map<String, Object> targetMatch = findMatchById(matchList, request.matchId, knockout);
        if (targetMatch == null) {
            return ResponseEntity.badRequest().body("Không tìm thấy trận đấu cần xóa kết quả trận con.");
        }

        String stage = knockout ? "knockout" : "group";
        TournamentMatchLineup lineupModel = tournamentMatchLineupRepository
            .findByTournamentIdAndStageAndMatchKey(id, stage, request.matchId)
            .orElse(null);
        Map<String, Object> lineup = lineupModel == null
            ? toObjectMap(targetMatch.get("lineup"))
            : parseObjectMapJson(lineupModel.getLineupJson());
        List<Map<String, Object>> subMatches = lineupModel == null
            ? toObjectMapList(targetMatch.get("subMatches"))
            : parseObjectMapListJson(lineupModel.getSubMatchesJson());
        if (request.subMatchIdx < 0 || request.subMatchIdx >= subMatches.size()) {
            return ResponseEntity.badRequest().body("Chỉ số trận con không hợp lệ.");
        }

        Map<String, Object> targetSub = subMatches.get(request.subMatchIdx);
        targetSub.put("homeScore", 0);
        targetSub.put("awayScore", 0);
        targetSub.put("completed", false);
        targetSub.put("setScores", new ArrayList<>());

        int homeWins = 0;
        int awayWins = 0;
        for (Map<String, Object> sub : subMatches) {
            if (!asBoolean(sub.get("completed"))) {
                continue;
            }
            int subHome = asInt(sub.get("homeScore"));
            int subAway = asInt(sub.get("awayScore"));
            if (subHome > subAway) {
                homeWins += 1;
            } else if (subAway > subHome) {
                awayWins += 1;
            }
        }

        targetMatch.put("homeScore", homeWins);
        targetMatch.put("awayScore", awayWins);
        boolean completed = homeWins >= 3 || awayWins >= 3;
        targetMatch.put("completed", completed);
        targetMatch.put("lineup", lineup);
        targetMatch.put("subMatches", subMatches);

        if (knockout) {
            if (completed) {
                targetMatch.put("winnerId", homeWins >= 3
                        ? asString(targetMatch.get("homeCompetitorId"))
                        : asString(targetMatch.get("awayCompetitorId")));
            } else {
                targetMatch.put("winnerId", null);
                removeDependentMatches(tournament, request.matchId);
            }
            ensureFinalAndBronzeMatches(tournament);
        }

        touchCompetitionVersion(tournament);
        Tournament saved = tournamentRepository.save(tournament);
        persistTournamentState(saved);
        upsertMatchLineup(
            saved,
            stage,
            asString(targetMatch.get("groupName")),
            request.matchId,
            lineup,
            subMatches,
            request.recordedById
        );
        syncNormalizedReadModels(saved, request.recordedById);

        recordTournamentMatchEvent(
                saved.getId(),
                knockout ? "knockout_sub_clear" : "group_sub_clear",
                knockout ? "" : asString(targetMatch.get("groupName")),
                request.matchId,
                request.subMatchIdx,
                asString(targetMatch.get("homeCompetitorId")),
                asString(targetMatch.get("awayCompetitorId")),
                0,
                0,
                request.recordedById,
                request.requestId
        );

        if (knockout) {
            return ResponseEntity.ok(buildMatchWriteResponse(saved, null, targetMatch, false, true));
        }

        return ResponseEntity.ok(buildMatchWriteResponse(saved, targetMatch, null, true, false));
    }

    @Transactional
    @PostMapping("/{id}/matches/knockout/clear")
    public ResponseEntity<?> clearKnockoutMatchResult(@PathVariable String id, @RequestBody KnockoutMatchClearRequest request) {
        if (request == null || isBlank(request.matchId)) {
            return ResponseEntity.badRequest().body("Thiếu thông tin xóa kết quả trận knockout.");
        }

        Optional<Tournament> tournamentOpt = findTournamentByIdForUpdateHydrated(id);
        if (tournamentOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        Tournament tournament = tournamentOpt.get();
        ResponseEntity<?> staleMetadataWrite = validateExpectedMetadataVersion(
                tournament,
                firstNonNull(request.expectedMetadataVersion, request.expectedTournamentVersion)
        );
        if (staleMetadataWrite != null) {
            return staleMetadataWrite;
        }
        ResponseEntity<?> staleCompetitionWrite = validateExpectedCompetitionVersion(
                tournament,
                firstNonNull(request.expectedCompetitionVersion, request.expectedTournamentVersion)
        );
        if (staleCompetitionWrite != null) {
            return staleCompetitionWrite;
        }
        if (tournament.getKnockoutMatches() == null) {
            return ResponseEntity.badRequest().body("Giải đấu chưa có nhánh knockout.");
        }

        Map<String, Object> target = findMatchById(tournament.getKnockoutMatches(), request.matchId, true);
        if (target == null) {
            return ResponseEntity.badRequest().body("Không tìm thấy trận knockout cần xóa kết quả.");
        }

        target.put("homeScore", 0);
        target.put("awayScore", 0);
        target.put("completed", false);
        target.put("winnerId", null);
        target.put("setScores", new ArrayList<>());

        removeDependentMatches(tournament, request.matchId);

        touchCompetitionVersion(tournament);
        Tournament saved = tournamentRepository.save(tournament);
        persistTournamentState(saved);
        syncNormalizedReadModels(saved, request.recordedById);
        recordTournamentMatchEvent(
                saved.getId(),
                "knockout_clear",
                "",
                request.matchId,
                null,
                asString(target.get("homeCompetitorId")),
                asString(target.get("awayCompetitorId")),
                0,
                0,
                request.recordedById,
                request.requestId
        );

            return ResponseEntity.ok(buildMatchWriteResponse(saved, null, target, false, true));
    }

    @Transactional
    @PostMapping("/{id}/participants/withdraw")
    public ResponseEntity<?> withdrawParticipant(@PathVariable String id, @RequestBody ParticipantWithdrawRequest request) {
        if (request == null || isBlank(request.memberId)) {
            return ResponseEntity.badRequest().body("Thiếu memberId cần rút khỏi giải đấu.");
        }

        Optional<Tournament> tournamentOpt = findTournamentByIdForUpdateHydrated(id);
        if (tournamentOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        Tournament tournament = tournamentOpt.get();
        ResponseEntity<?> staleWrite = validateExpectedMetadataVersion(
            tournament,
            firstNonNull(request.expectedMetadataVersion, request.expectedTournamentVersion)
        );
        if (staleWrite != null) {
            return staleWrite;
        }
        if (!"ongoing".equalsIgnoreCase(asString(tournament.getStatus()))) {
            return ResponseEntity.badRequest().body("Chỉ được rút vận động viên khi giải đang diễn ra.");
        }

        List<String> participants = tournament.getParticipants() == null
                ? new ArrayList<>()
                : new ArrayList<>(tournament.getParticipants());
        boolean removed = participants.removeIf(memberId -> request.memberId.equals(memberId));
        if (!removed) {
            return ResponseEntity.badRequest().body("Vận động viên không tồn tại trong danh sách tham gia giải.");
        }
        tournament.setParticipants(participants);

        // Delete from tournament registrations as well
        tournamentRegistrationRepository.findByTournamentIdAndMemberId(id, request.memberId)
                .ifPresent(reg -> tournamentRegistrationRepository.delete(reg));

        List<String> captains = tournament.getCaptains() == null
                ? new ArrayList<>()
                : new ArrayList<>(tournament.getCaptains());
        captains.removeIf(memberId -> request.memberId.equals(memberId));
        tournament.setCaptains(captains);

        List<Map<String, Object>> teams = toObjectMapList(tournament.getTeams());
        Set<String> touchedTeamIds = new HashSet<>();
        for (Map<String, Object> team : teams) {
            List<Map<String, Object>> players = toObjectMapList(team.get("players"));
            int before = players.size();
            players.removeIf(player -> request.memberId.equals(asString(player.get("id"))));
            if (players.size() != before) {
                touchedTeamIds.add(asString(team.get("id")));
            }
            team.put("players", new ArrayList<>(players));
        }
        List<Object> teamObjectsAfterWithdraw = new ArrayList<>();
        teamObjectsAfterWithdraw.addAll(teams);
        tournament.setTeams(teamObjectsAfterWithdraw);

        invalidateTournamentMatchesByCompetitors(tournament, touchedTeamIds);
        touchMetadataVersion(tournament);

        Tournament saved = tournamentRepository.save(tournament);
        persistTournamentState(saved);
        syncNormalizedReadModels(saved, request.recordedById);
        return ResponseEntity.ok(saved);
    }

    @GetMapping("/{id}/registrations")
    public ResponseEntity<?> getRegistrations(@PathVariable String id) {
        if (!tournamentRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        List<TournamentRegistration> registrations = tournamentRegistrationRepository.findByTournamentId(id);
        return ResponseEntity.ok(registrations);
    }

    @Transactional
    @PostMapping("/{id}/registrations/import")
    public ResponseEntity<?> importRegistrations(@PathVariable String id, @RequestBody List<RegistrationImportItem> items) {
        Optional<Tournament> tournamentOpt = findTournamentByIdForUpdateHydrated(id);
        if (tournamentOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        Tournament tournament = tournamentOpt.get();

        if (!"draft".equalsIgnoreCase(tournament.getStatus())) {
            return ResponseEntity.badRequest().body("Chỉ cho phép import đăng ký khi giải đấu ở trạng thái Nháp (Draft).");
        }

        Set<Integer> seedsInImport = new HashSet<>();
        for (RegistrationImportItem item : items) {
            if (item.seed != null) {
                if (seedsInImport.contains(item.seed)) {
                    return ResponseEntity.badRequest().body("Trùng hạt giống trong danh sách import: " + item.seed);
                }
                seedsInImport.add(item.seed);
            }
        }

        List<TournamentRegistration> existingRegs = tournamentRegistrationRepository.findByTournamentId(id);
        tournamentRegistrationRepository.deleteAll(existingRegs);

        List<TournamentRegistration> newRegs = new ArrayList<>();
        List<String> participantIds = new ArrayList<>();
        for (RegistrationImportItem item : items) {
            Optional<Member> memberOpt = memberRepository.findById(item.memberId);
            if (memberOpt.isEmpty()) {
                return ResponseEntity.badRequest().body("Thành viên không tồn tại: " + item.memberId);
            }
            Member member = memberOpt.get();

            TournamentRegistration reg = new TournamentRegistration();
            reg.setTournamentId(id);
            reg.setMemberId(item.memberId);
            reg.setSeed(item.seed);
            reg.setSeedSource("imported");
            reg.setRankSnapshot(member.getRankTier());
            reg.setEloSnapshot(member.getElo());
            reg.setGenderSnapshot(member.getGender());
            reg.setDepartmentSnapshot(member.getDepartment());
            reg.setIsCaptain(false);
            reg.setStatus("active");
            reg.setRegisteredAt(LocalDateTime.now());

            newRegs.add(reg);
            participantIds.add(item.memberId);
        }

        tournamentRegistrationRepository.saveAll(newRegs);

        tournament.setParticipants(participantIds);
        tournament.setRegistrationVersion(tournament.getRegistrationVersion() + 1);
        touchMetadataVersion(tournament);

        Tournament saved = tournamentRepository.save(tournament);
        persistTournamentState(saved);

        return ResponseEntity.ok(newRegs);
    }

    @Transactional
    @PatchMapping("/{id}/registrations/{memberId}/seed")
    public ResponseEntity<?> overrideSeed(
            @PathVariable String id,
            @PathVariable String memberId,
            @RequestBody SeedOverrideRequest request
    ) {
        Optional<Tournament> tournamentOpt = findTournamentByIdForUpdateHydrated(id);
        if (tournamentOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        Tournament tournament = tournamentOpt.get();

        if (request.expectedRegistrationVersion != null && !request.expectedRegistrationVersion.equals(tournament.getRegistrationVersion())) {
            return ResponseEntity.status(409).body("Phiên bản đăng ký đã thay đổi. Vui lòng tải lại trang.");
        }

        Optional<TournamentRegistration> regOpt = tournamentRegistrationRepository.findByTournamentIdAndMemberId(id, memberId);
        if (regOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        TournamentRegistration reg = regOpt.get();

        if (request.newSeed != null) {
            List<TournamentRegistration> regs = tournamentRegistrationRepository.findByTournamentId(id);
            for (TournamentRegistration r : regs) {
                if (!r.getMemberId().equals(memberId) && request.newSeed.equals(r.getSeed())) {
                    return ResponseEntity.badRequest().body("Hạt giống " + request.newSeed + " đã được phân cho VĐV khác.");
                }
            }
        }

        Integer oldSeed = reg.getSeed();
        if (Objects.equals(oldSeed, request.newSeed)) {
            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("message", "Hạt giống không thay đổi.");
            return ResponseEntity.ok(response);
        }

        reg.setSeed(request.newSeed);
        reg.setSeedSource("manual");
        tournamentRegistrationRepository.save(reg);

        Integer revisionBefore = tournament.getDrawRevisionCurrent();
        Integer revisionAfter = revisionBefore;
        boolean drawDirty = false;

        if (revisionBefore > 0) {
            drawDirty = true;
            revisionAfter = revisionBefore + 1;
            tournament.setDrawRevisionCurrent(revisionAfter);

            TournamentDrawRevision dirtyRev = new TournamentDrawRevision();
            dirtyRev.setId("dr" + UUID.randomUUID().toString().substring(0, 10));
            dirtyRev.setTournamentId(id);
            dirtyRev.setRevisionNo(revisionAfter);
            dirtyRev.setStatus("dirty");
            dirtyRev.setReason("Hạt giống thay đổi: " + oldSeed + " -> " + request.newSeed + ". Lý do: " + request.reason);
            dirtyRev.setActorId(request.actorId);
            dirtyRev.setCreatedAt(LocalDateTime.now());
            dirtyRev.setBasedOnRegistrationVersion(tournament.getRegistrationVersion() + 1);
            tournamentDrawRevisionRepository.save(dirtyRev);
        }

        TournamentSeedOverrideHistory history = new TournamentSeedOverrideHistory();
        history.setId("sh" + UUID.randomUUID().toString().substring(0, 10));
        history.setTournamentId(id);
        history.setMemberId(memberId);
        history.setOldSeed(oldSeed);
        history.setNewSeed(request.newSeed);
        history.setReason(request.reason);
        history.setActorId(request.actorId);
        history.setOverriddenAt(LocalDateTime.now());
        history.setDrawRevisionBefore(revisionBefore);
        history.setDrawRevisionAfter(revisionAfter);
        tournamentSeedOverrideHistoryRepository.save(history);

        // Write Admin Audit Log
        AuditLog log = new AuditLog();
        log.setId("a" + UUID.randomUUID().toString().substring(0, 10));
        log.setTimestamp(LocalDateTime.now());
        log.setActorId(request.actorId);
        log.setAction("Ghi đè hạt giống");
        log.setDetails("Thay đổi hạt giống của VĐV " + memberId + " từ " + oldSeed + " sang " + request.newSeed + " trong giải đấu " + id);
        log.setReason(request.reason);
        auditLogRepository.save(log);

        tournament.setRegistrationVersion(tournament.getRegistrationVersion() + 1);
        touchMetadataVersion(tournament);
        Tournament saved = tournamentRepository.save(tournament);
        persistTournamentState(saved);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("tournamentId", id);
        response.put("memberId", memberId);
        response.put("oldSeed", oldSeed);
        response.put("newSeed", request.newSeed);
        response.put("drawDirty", drawDirty);
        response.put("drawRevisionBefore", revisionBefore);
        response.put("drawRevisionAfter", revisionAfter);
        response.put("registrationVersion", saved.getRegistrationVersion());
        return ResponseEntity.ok(response);
    }

    @PostMapping("/{id}/draw/simulate")
    public ResponseEntity<?> simulateDraw(@PathVariable String id, @RequestBody DrawSimulateRequest request) {
        Optional<Tournament> tournamentOpt = findTournamentByIdHydrated(id);
        if (tournamentOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        Tournament tournament = tournamentOpt.get();

        List<TournamentRegistration> regs = tournamentRegistrationRepository.findByTournamentId(id);
        if (regs.isEmpty()) {
            return ResponseEntity.badRequest().body("Chưa có danh sách đăng ký VĐV.");
        }

        List<DrawCalculationService.SeededCompetitor> players = new ArrayList<>();
        for (TournamentRegistration r : regs) {
            Member member = memberRepository.findById(r.getMemberId()).orElse(null);
            players.add(new DrawCalculationService.SeededCompetitor(
                r.getMemberId(),
                member != null ? member.getFullName() : r.getMemberId(),
                r.getSeed() != null ? r.getSeed() : 999,
                r.getGenderSnapshot()
            ));
        }

        List<DrawCalculationService.PotRange> potRanges = new ArrayList<>();
        if (request.rules != null && request.rules.seededPotRanges != null) {
            for (SeededPotRangePayload range : request.rules.seededPotRanges) {
                potRanges.add(new DrawCalculationService.PotRange(range.min, range.max));
            }
        }

        int teamSize = (request.rules != null && request.rules.teamSize != null) ? request.rules.teamSize : 3;
        int maxFemale = (request.rules != null && request.rules.maxFemalePerTeam != null) ? request.rules.maxFemalePerTeam : 1;
        int topN = request.topN != null ? request.topN : 5;

        List<DrawCalculationService.DrawCandidate> candidates = drawCalculationService.simulateDraw(
            players,
            teamSize,
            potRanges,
            maxFemale,
            topN
        );

        Map<String, Object> res = new HashMap<>();
        res.put("candidates", candidates);
        return ResponseEntity.ok(res);
    }

    @Transactional
    @PostMapping("/{id}/draw/commit")
    public ResponseEntity<?> commitDraw(@PathVariable String id, @RequestBody DrawCommitRequest request) {
        Optional<Tournament> tournamentOpt = findTournamentByIdForUpdateHydrated(id);
        if (tournamentOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        Tournament tournament = tournamentOpt.get();

        if (!isBlank(request.requestId)
                && tournamentMatchEventRepository.existsByTournamentIdAndRequestId(id, request.requestId)) {
            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("tournamentId", id);
            response.put("drawRevisionCurrent", tournament.getDrawRevisionCurrent());
            response.put("competitionVersion", tournament.getCompetitionVersion());
            response.put("status", tournament.getStatus());
            return ResponseEntity.ok(response);
        }

        if (request.expectedCompetitionVersion != null && !request.expectedCompetitionVersion.equals(tournament.getCompetitionVersion())) {
            return ResponseEntity.status(409).body("Phiên bản bốc thăm đã thay đổi. Vui lòng tải lại trang.");
        }

        List<TournamentRegistration> regs = tournamentRegistrationRepository.findByTournamentId(id);
        if (regs.isEmpty()) {
            return ResponseEntity.badRequest().body("Chưa có danh sách đăng ký VĐV.");
        }

        List<DrawCalculationService.SeededCompetitor> players = new ArrayList<>();
        for (TournamentRegistration r : regs) {
            Member member = memberRepository.findById(r.getMemberId()).orElse(null);
            players.add(new DrawCalculationService.SeededCompetitor(
                r.getMemberId(),
                member != null ? member.getFullName() : r.getMemberId(),
                r.getSeed() != null ? r.getSeed() : 999,
                r.getGenderSnapshot()
            ));
        }

        String suffix = request.candidateId.replace("cand-", "");
        int middleShift = Integer.parseInt(suffix.substring(0, 2));
        int weakShift = Integer.parseInt(suffix.substring(2, 4));

        List<DrawCalculationService.PotRange> potRanges = new ArrayList<>();
        int teamSize = 3;
        int maxFemale = 1;
        if (request.rules != null) {
            teamSize = request.rules.teamSize != null ? request.rules.teamSize : 3;
            maxFemale = request.rules.maxFemalePerTeam != null ? request.rules.maxFemalePerTeam : 1;
            if (request.rules.seededPotRanges != null) {
                for (SeededPotRangePayload pr : request.rules.seededPotRanges) {
                    potRanges.add(new DrawCalculationService.PotRange(pr.min, pr.max));
                }
            }
        }
        if (potRanges.isEmpty()) {
            potRanges.add(new DrawCalculationService.PotRange(1, 7));
            potRanges.add(new DrawCalculationService.PotRange(8, 14));
            potRanges.add(new DrawCalculationService.PotRange(15, 21));
        }

        List<List<DrawCalculationService.SeededCompetitor>> pots = new ArrayList<>();
        for (DrawCalculationService.PotRange range : potRanges) {
            List<DrawCalculationService.SeededCompetitor> pot = players.stream()
                .filter(p -> p.seed != null && p.seed >= range.min && p.seed <= range.max)
                .sorted(Comparator.comparingInt(p -> p.seed))
                .collect(Collectors.toList());
            pots.add(pot);
        }

        int teamCount = pots.get(0).size();
        List<DrawCalculationService.Team> generatedTeams = new ArrayList<>();
        for (int i = 0; i < teamCount; i++) {
            DrawCalculationService.Team team = new DrawCalculationService.Team();
            team.id = "team-" + (i + 1);
            team.name = "Đội " + (i + 1);
            team.players.add(pots.get(0).get(i));
            team.players.add(pots.get(1).get((i + middleShift) % teamCount));
            team.players.add(pots.get(2).get((i + weakShift) % teamCount));
            generatedTeams.add(team);
        }

        List<Object> stateTeams = new ArrayList<>();
        for (DrawCalculationService.Team t : generatedTeams) {
            Map<String, Object> teamMap = new HashMap<>();
            teamMap.put("id", t.id);
            teamMap.put("name", t.name);
            List<Map<String, String>> playersList = new ArrayList<>();
            for (DrawCalculationService.Competitor p : t.players) {
                playersList.add(Map.of("id", p.id, "name", p.name));
            }
            teamMap.put("players", playersList);
            stateTeams.add(teamMap);
        }

        List<DrawCalculationService.Competitor> competitors = new ArrayList<>();
        Map<String, Integer> strengthMap = new HashMap<>();
        for (DrawCalculationService.Team t : generatedTeams) {
            competitors.add(new DrawCalculationService.Competitor(t.id, t.name));
            int seedTotal = 0;
            for (DrawCalculationService.Competitor p : t.players) {
                TournamentRegistration reg = regs.stream().filter(r -> r.getMemberId().equals(p.id)).findFirst().orElse(null);
                seedTotal += (reg != null && reg.getSeed() != null) ? reg.getSeed() : 0;
            }
            strengthMap.put(t.id, seedTotal);
        }
        List<DrawCalculationService.GroupAssignment> groups = drawCalculationService.generateBalancedGroups(competitors, tournament.getGroupSize() != null ? tournament.getGroupSize() : 4, strengthMap);

        List<DrawCalculationService.GroupMatchScore> scores = new ArrayList<>();
        for (DrawCalculationService.GroupAssignment group : groups) {
            scores.addAll(drawCalculationService.buildRoundRobinScores(group));
        }

        List<Object> stateGroups = new ArrayList<>();
        for (DrawCalculationService.GroupAssignment g : groups) {
            Map<String, Object> gMap = new HashMap<>();
            gMap.put("groupName", g.groupName);
            List<Map<String, String>> comps = g.competitors.stream()
                .map(c -> Map.of("id", c.id, "name", c.name))
                .collect(Collectors.toList());
            gMap.put("competitors", comps);
            stateGroups.add(gMap);
        }

        List<Object> stateScores = new ArrayList<>();
        for (DrawCalculationService.GroupMatchScore sc : scores) {
            Map<String, Object> scMap = new HashMap<>();
            scMap.put("groupName", sc.groupName);
            scMap.put("homeCompetitorId", sc.homeCompetitorId);
            scMap.put("awayCompetitorId", sc.awayCompetitorId);
            scMap.put("homeScore", 0);
            scMap.put("awayScore", 0);
            scMap.put("completed", false);
            scMap.put("subMatches", new ArrayList<>());
            scMap.put("isWalkover", false);
            scMap.put("walkoverWinnerId", null);
            scMap.put("setScores", new ArrayList<>());
            stateScores.add(scMap);
        }

        TournamentState state = tournamentStateRepository.findById(id).orElseGet(() -> {
            TournamentState s = new TournamentState();
            s.setTournamentId(id);
            return s;
        });
        state.setTeams(stateTeams);
        state.setGroups(stateGroups);
        state.setScores(stateScores);
        state.setKnockoutMatches(new ArrayList<>());
        tournamentStateRepository.save(state);

        int newRevision = tournament.getDrawRevisionCurrent() + 1;
        TournamentDrawRevision revision = new TournamentDrawRevision();
        revision.setId("dr" + UUID.randomUUID().toString().substring(0, 10));
        revision.setTournamentId(id);
        revision.setRevisionNo(newRevision);
        revision.setStatus("committed");
        revision.setReason(request.reason);
        revision.setActorId(request.actorId);
        revision.setCreatedAt(LocalDateTime.now());
        revision.setBasedOnRegistrationVersion(tournament.getRegistrationVersion());
        tournamentDrawRevisionRepository.save(revision);

        for (DrawCalculationService.Team t : generatedTeams) {
            TournamentDrawRevisionTeam revTeam = new TournamentDrawRevisionTeam();
            revTeam.setRevisionId(revision.getId());
            revTeam.setTeamId(t.id);
            revTeam.setTeamName(t.name);

            int seedTotal = 0;
            for (DrawCalculationService.Competitor p : t.players) {
                TournamentRegistration reg = regs.stream().filter(r -> r.getMemberId().equals(p.id)).findFirst().orElse(null);
                seedTotal += (reg != null && reg.getSeed() != null) ? reg.getSeed() : 0;

                TournamentDrawRevisionTeamMember revMember = new TournamentDrawRevisionTeamMember();
                revMember.setRevisionId(revision.getId());
                revMember.setTeamId(t.id);
                revMember.setMemberId(p.id);
                tournamentDrawRevisionTeamMemberRepository.save(revMember);
            }
            revTeam.setSeedTotal(seedTotal);
            tournamentDrawRevisionTeamRepository.save(revTeam);
        }

        for (DrawCalculationService.GroupAssignment g : groups) {
            for (DrawCalculationService.Competitor c : g.competitors) {
                TournamentDrawRevisionGroup revGroup = new TournamentDrawRevisionGroup();
                revGroup.setRevisionId(revision.getId());
                revGroup.setGroupName(g.groupName);
                revGroup.setCompetitorId(c.id);
                tournamentDrawRevisionGroupRepository.save(revGroup);
            }
        }

        tournament.setDrawRevisionCurrent(newRevision);
        tournament.setStatus("ongoing");
        tournament.setStage("group");
        touchMetadataVersion(tournament);
        tournamentRepository.save(tournament);

        TournamentMatchEvent event = new TournamentMatchEvent();
        event.setId("e" + UUID.randomUUID().toString().substring(0, 10));
        event.setTournamentId(id);
        event.setMatchKey("draw-commit");
        event.setActionType("CHOT_BOC_THAM");
        event.setPayloadJson(request.candidateId != null ? request.candidateId : "");
        event.setActorId(isBlank(request.actorId) ? "SYSTEM" : request.actorId);
        event.setRequestId(request.requestId);
        event.setCreatedAt(LocalDateTime.now());
        tournamentMatchEventRepository.save(event);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("tournamentId", id);
        response.put("drawRevisionCurrent", newRevision);
        response.put("competitionVersion", tournament.getCompetitionVersion());
        response.put("status", "ongoing");
        return ResponseEntity.ok(response);
    }

    @Transactional
    @PostMapping("/{id}/draw/rebuild")
    public ResponseEntity<?> rebuildDraw(@PathVariable String id, @RequestBody DrawRebuildRequest request) {
        Optional<Tournament> tournamentOpt = findTournamentByIdForUpdateHydrated(id);
        if (tournamentOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        Tournament tournament = tournamentOpt.get();

        if (!isBlank(request.requestId)
                && tournamentMatchEventRepository.existsByTournamentIdAndRequestId(id, request.requestId)) {
            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("drawRevisionCurrent", tournament.getDrawRevisionCurrent());
            response.put("drawDirty", false);
            response.put("message", "Draw rebuilt from latest tournament registrations");
            return ResponseEntity.ok(response);
        }

        TournamentState state = tournamentStateRepository.findById(id).orElse(null);
        if (state != null && state.getScores() != null) {
            boolean hasCompleted = toObjectMapList(state.getScores()).stream()
                .anyMatch(m -> asBoolean(m.get("completed")));
            if (hasCompleted && !Boolean.TRUE.equals(request.allowIfCompletedMatches)) {
                return ResponseEntity.badRequest().body("Không thể bốc thăm lại vì đã có trận đấu kết thúc.");
            }
        }

        List<TournamentRegistration> regs = tournamentRegistrationRepository.findByTournamentId(id);
        if (regs.isEmpty()) {
            return ResponseEntity.badRequest().body("Không thể bốc thăm giải đấu không có VĐV đăng ký.");
        }

        List<DrawCalculationService.SeededCompetitor> players = new ArrayList<>();
        for (TournamentRegistration r : regs) {
            Member member = memberRepository.findById(r.getMemberId()).orElse(null);
            players.add(new DrawCalculationService.SeededCompetitor(
                r.getMemberId(),
                member != null ? member.getFullName() : r.getMemberId(),
                r.getSeed() != null ? r.getSeed() : 999,
                r.getGenderSnapshot()
            ));
        }

        List<DrawCalculationService.PotRange> potRanges = List.of(
            new DrawCalculationService.PotRange(1, 7),
            new DrawCalculationService.PotRange(8, 14),
            new DrawCalculationService.PotRange(15, 21)
        );

        List<DrawCalculationService.DrawCandidate> candidates = drawCalculationService.simulateDraw(
            players, 3, potRanges, 1, 1
        );

        String candidateId = "cand-0000";
        if (!candidates.isEmpty()) {
            candidateId = candidates.get(0).candidateId;
        }

        String suffix = candidateId.replace("cand-", "");
        int middleShift = Integer.parseInt(suffix.substring(0, 2));
        int weakShift = Integer.parseInt(suffix.substring(2, 4));

        List<DrawCalculationService.Team> generatedTeams = new ArrayList<>();
        List<List<DrawCalculationService.SeededCompetitor>> pots = new ArrayList<>();
        for (DrawCalculationService.PotRange range : potRanges) {
            List<DrawCalculationService.SeededCompetitor> pot = players.stream()
                .filter(p -> p.seed != null && p.seed >= range.min && p.seed <= range.max)
                .sorted(Comparator.comparingInt(p -> p.seed))
                .collect(Collectors.toList());
            pots.add(pot);
        }

        int teamCount = pots.get(0).size();
        for (int i = 0; i < teamCount; i++) {
            DrawCalculationService.Team team = new DrawCalculationService.Team();
            team.id = "team-" + (i + 1);
            team.name = "Đội " + (i + 1);
            team.players.add(pots.get(0).get(i));
            team.players.add(pots.get(1).get((i + middleShift) % teamCount));
            team.players.add(pots.get(2).get((i + weakShift) % teamCount));
            generatedTeams.add(team);
        }

        List<Object> stateTeams = new ArrayList<>();
        for (DrawCalculationService.Team t : generatedTeams) {
            Map<String, Object> teamMap = new HashMap<>();
            teamMap.put("id", t.id);
            teamMap.put("name", t.name);
            List<Map<String, String>> playersList = new ArrayList<>();
            for (DrawCalculationService.Competitor p : t.players) {
                playersList.add(Map.of("id", p.id, "name", p.name));
            }
            teamMap.put("players", playersList);
            stateTeams.add(teamMap);
        }

        List<DrawCalculationService.Competitor> competitors = new ArrayList<>();
        Map<String, Integer> strengthMap = new HashMap<>();
        for (DrawCalculationService.Team t : generatedTeams) {
            competitors.add(new DrawCalculationService.Competitor(t.id, t.name));
            int seedTotal = 0;
            for (DrawCalculationService.Competitor p : t.players) {
                TournamentRegistration reg = regs.stream().filter(r -> r.getMemberId().equals(p.id)).findFirst().orElse(null);
                seedTotal += (reg != null && reg.getSeed() != null) ? reg.getSeed() : 0;
            }
            strengthMap.put(t.id, seedTotal);
        }
        List<DrawCalculationService.GroupAssignment> groups = drawCalculationService.generateBalancedGroups(competitors, tournament.getGroupSize() != null ? tournament.getGroupSize() : 4, strengthMap);

        List<DrawCalculationService.GroupMatchScore> scores = new ArrayList<>();
        for (DrawCalculationService.GroupAssignment group : groups) {
            scores.addAll(drawCalculationService.buildRoundRobinScores(group));
        }

        List<Object> stateGroups = new ArrayList<>();
        for (DrawCalculationService.GroupAssignment g : groups) {
            Map<String, Object> gMap = new HashMap<>();
            gMap.put("groupName", g.groupName);
            List<Map<String, String>> comps = g.competitors.stream()
                .map(c -> Map.of("id", c.id, "name", c.name))
                .collect(Collectors.toList());
            gMap.put("competitors", comps);
            stateGroups.add(gMap);
        }

        List<Object> stateScores = new ArrayList<>();
        for (DrawCalculationService.GroupMatchScore sc : scores) {
            Map<String, Object> scMap = new HashMap<>();
            scMap.put("groupName", sc.groupName);
            scMap.put("homeCompetitorId", sc.homeCompetitorId);
            scMap.put("awayCompetitorId", sc.awayCompetitorId);
            scMap.put("homeScore", 0);
            scMap.put("awayScore", 0);
            scMap.put("completed", false);
            scMap.put("subMatches", new ArrayList<>());
            scMap.put("isWalkover", false);
            scMap.put("walkoverWinnerId", null);
            scMap.put("setScores", new ArrayList<>());
            stateScores.add(scMap);
        }

        TournamentState stateToSave = state != null ? state : new TournamentState();
        stateToSave.setTournamentId(id);
        stateToSave.setTeams(stateTeams);
        stateToSave.setGroups(stateGroups);
        stateToSave.setScores(stateScores);
        stateToSave.setKnockoutMatches(new ArrayList<>());
        tournamentStateRepository.save(stateToSave);

        int newRevision = tournament.getDrawRevisionCurrent() + 1;
        TournamentDrawRevision revision = new TournamentDrawRevision();
        revision.setId("dr" + UUID.randomUUID().toString().substring(0, 10));
        revision.setTournamentId(id);
        revision.setRevisionNo(newRevision);
        revision.setStatus("committed");
        revision.setReason(request.reason);
        revision.setActorId(request.actorId);
        revision.setCreatedAt(LocalDateTime.now());
        revision.setBasedOnRegistrationVersion(tournament.getRegistrationVersion());
        tournamentDrawRevisionRepository.save(revision);

        for (DrawCalculationService.Team t : generatedTeams) {
            TournamentDrawRevisionTeam revTeam = new TournamentDrawRevisionTeam();
            revTeam.setRevisionId(revision.getId());
            revTeam.setTeamId(t.id);
            revTeam.setTeamName(t.name);

            int seedTotal = 0;
            for (DrawCalculationService.Competitor p : t.players) {
                TournamentRegistration reg = regs.stream().filter(r -> r.getMemberId().equals(p.id)).findFirst().orElse(null);
                seedTotal += (reg != null && reg.getSeed() != null) ? reg.getSeed() : 0;

                TournamentDrawRevisionTeamMember revMember = new TournamentDrawRevisionTeamMember();
                revMember.setRevisionId(revision.getId());
                revMember.setTeamId(t.id);
                revMember.setMemberId(p.id);
                tournamentDrawRevisionTeamMemberRepository.save(revMember);
            }
            revTeam.setSeedTotal(seedTotal);
            tournamentDrawRevisionTeamRepository.save(revTeam);
        }

        for (DrawCalculationService.GroupAssignment g : groups) {
            for (DrawCalculationService.Competitor c : g.competitors) {
                TournamentDrawRevisionGroup revGroup = new TournamentDrawRevisionGroup();
                revGroup.setRevisionId(revision.getId());
                revGroup.setGroupName(g.groupName);
                revGroup.setCompetitorId(c.id);
                tournamentDrawRevisionGroupRepository.save(revGroup);
            }
        }

        tournament.setDrawRevisionCurrent(newRevision);
        tournament.setStatus("ongoing");
        tournament.setStage("group");
        touchMetadataVersion(tournament);
        tournamentRepository.save(tournament);

        TournamentMatchEvent event = new TournamentMatchEvent();
        event.setId("e" + UUID.randomUUID().toString().substring(0, 10));
        event.setTournamentId(id);
        event.setMatchKey("draw-rebuild");
        event.setActionType("TAI_BOC_THAM");
        event.setPayloadJson("rebuild");
        event.setActorId(isBlank(request.actorId) ? "SYSTEM" : request.actorId);
        event.setRequestId(request.requestId);
        event.setCreatedAt(LocalDateTime.now());
        tournamentMatchEventRepository.save(event);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("drawRevisionCurrent", newRevision);
        response.put("drawDirty", false);
        response.put("message", "Draw rebuilt from latest tournament registrations");
        return ResponseEntity.ok(response);
    }

    @PostMapping("/{id}/draw/assess-seed-impact")
    public ResponseEntity<?> assessSeedImpact(@PathVariable String id, @RequestBody AssessSeedImpactRequest request) {
        Optional<Tournament> tournamentOpt = findTournamentByIdHydrated(id);
        if (tournamentOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        Tournament tournament = tournamentOpt.get();

        List<TournamentRegistration> regs = tournamentRegistrationRepository.findByTournamentId(id);
        if (regs.isEmpty()) {
            return ResponseEntity.ok(Map.of("impactedTeams", new ArrayList<>()));
        }

        List<DrawCalculationService.SeededCompetitor> playersBefore = new ArrayList<>();
        for (TournamentRegistration r : regs) {
            Member member = memberRepository.findById(r.getMemberId()).orElse(null);
            playersBefore.add(new DrawCalculationService.SeededCompetitor(
                r.getMemberId(),
                member != null ? member.getFullName() : r.getMemberId(),
                r.getSeed() != null ? r.getSeed() : 999,
                r.getGenderSnapshot()
            ));
        }

        List<DrawCalculationService.PotRange> potRanges = List.of(
            new DrawCalculationService.PotRange(1, 7),
            new DrawCalculationService.PotRange(8, 14),
            new DrawCalculationService.PotRange(15, 21)
        );

        List<DrawCalculationService.Team> teamsBefore = drawCalculationService.generateTeamsBySeedPots(playersBefore, 3, potRanges, 1);

        List<DrawCalculationService.SeededCompetitor> playersAfter = new ArrayList<>();
        for (TournamentRegistration r : regs) {
            Member member = memberRepository.findById(r.getMemberId()).orElse(null);
            int seed = r.getSeed() != null ? r.getSeed() : 999;
            if (r.getMemberId().equals(request.memberId)) {
                seed = request.newSeed;
            }
            playersAfter.add(new DrawCalculationService.SeededCompetitor(
                r.getMemberId(),
                member != null ? member.getFullName() : r.getMemberId(),
                seed,
                r.getGenderSnapshot()
            ));
        }

        List<DrawCalculationService.Team> teamsAfter = drawCalculationService.generateTeamsBySeedPots(playersAfter, 3, potRanges, 1);

        List<Map<String, Object>> impactedTeams = new ArrayList<>();
        if (teamsBefore != null && teamsAfter != null) {
            for (int i = 0; i < Math.min(teamsBefore.size(), teamsAfter.size()); i++) {
                DrawCalculationService.Team tb = teamsBefore.get(i);
                DrawCalculationService.Team ta = teamsAfter.get(i);

                Set<String> pb = tb.players.stream().map(p -> p.id).collect(Collectors.toSet());
                Set<String> pa = ta.players.stream().map(p -> p.id).collect(Collectors.toSet());

                if (!pb.equals(pa)) {
                    Map<String, Object> impact = new HashMap<>();
                    impact.put("teamId", tb.id);
                    impact.put("teamName", tb.name);
                    impact.put("oldPlayers", tb.players.stream().map(p -> p.name).collect(Collectors.toList()));
                    impact.put("newPlayers", ta.players.stream().map(p -> p.name).collect(Collectors.toList()));
                    impactedTeams.add(impact);
                }
            }
        }

        Map<String, Object> response = new HashMap<>();
        response.put("impactedTeams", impactedTeams);
        return ResponseEntity.ok(response);
    }

    @Transactional
    @PostMapping("/{id}/teams/move-player")
    public ResponseEntity<?> movePlayerBetweenTeams(@PathVariable String id, @RequestBody TeamMovePlayerRequest request) {
        if (request == null || isBlank(request.fromTeamId) || isBlank(request.toTeamId) || isBlank(request.playerId)) {
            return ResponseEntity.badRequest().body("Thiếu dữ liệu chuyển vận động viên giữa các đội.");
        }

        if (request.fromTeamId.equals(request.toTeamId)) {
            return ResponseEntity.badRequest().body("Đội nguồn và đội đích phải khác nhau.");
        }

        Optional<Tournament> tournamentOpt = findTournamentByIdForUpdateHydrated(id);
        if (tournamentOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        Tournament tournament = tournamentOpt.get();
        ResponseEntity<?> staleWrite = validateExpectedMetadataVersion(
            tournament,
            firstNonNull(request.expectedMetadataVersion, request.expectedTournamentVersion)
        );
        if (staleWrite != null) {
            return staleWrite;
        }
        if (!"team".equalsIgnoreCase(asString(tournament.getType()))) {
            return ResponseEntity.badRequest().body("Chỉ giải đấu đồng đội mới hỗ trợ chuyển vận động viên giữa các đội.");
        }

        List<Map<String, Object>> teams = toObjectMapList(tournament.getTeams());
        Map<String, Object> fromTeam = findTeamById(teams, request.fromTeamId);
        Map<String, Object> toTeam = findTeamById(teams, request.toTeamId);
        if (fromTeam == null || toTeam == null) {
            return ResponseEntity.badRequest().body("Không tìm thấy đội nguồn hoặc đội đích.");
        }

        List<Map<String, Object>> fromPlayers = toObjectMapList(fromTeam.get("players"));
        List<Map<String, Object>> toPlayers = toObjectMapList(toTeam.get("players"));
        if (toPlayers.stream().anyMatch(player -> request.playerId.equals(asString(player.get("id"))))) {
            return ResponseEntity.badRequest().body("Vận động viên đã tồn tại ở đội đích.");
        }

        int teamSize = tournament.getTeamSize() == null ? 3 : tournament.getTeamSize();
        if (toPlayers.size() >= teamSize) {
            return ResponseEntity.badRequest().body("Đội đích đã đủ số lượng vận động viên.");
        }

        Map<String, Object> movedPlayer = null;
        List<Map<String, Object>> nextFromPlayers = new ArrayList<>();
        for (Map<String, Object> player : fromPlayers) {
            if (request.playerId.equals(asString(player.get("id")))) {
                movedPlayer = new LinkedHashMap<>(player);
                continue;
            }
            nextFromPlayers.add(player);
        }

        if (movedPlayer == null) {
            return ResponseEntity.badRequest().body("Không tìm thấy vận động viên trong đội nguồn.");
        }

        toPlayers.add(movedPlayer);
        fromTeam.put("players", new ArrayList<>(nextFromPlayers));
        toTeam.put("players", new ArrayList<>(toPlayers));
        List<Object> teamObjectsAfterMove = new ArrayList<>();
        teamObjectsAfterMove.addAll(teams);
        tournament.setTeams(teamObjectsAfterMove);

        Set<String> touchedTeamIds = new HashSet<>();
        touchedTeamIds.add(request.fromTeamId);
        touchedTeamIds.add(request.toTeamId);
        invalidateTournamentMatchesByCompetitors(tournament, touchedTeamIds);
        touchMetadataVersion(tournament);

        Tournament saved = tournamentRepository.save(tournament);
        persistTournamentState(saved);
        syncNormalizedReadModels(saved, request.recordedById);
        return ResponseEntity.ok(saved);
    }

    @Transactional
    @PostMapping("/{id}/groups/move-competitor")
    public ResponseEntity<?> moveCompetitorBetweenGroups(@PathVariable String id, @RequestBody GroupMoveCompetitorRequest request) {
        if (request == null || isBlank(request.fromGroupName) || isBlank(request.toGroupName) || isBlank(request.competitorId)) {
            return ResponseEntity.badRequest().body("Thiếu dữ liệu chuyển đội/đấu thủ giữa các bảng.");
        }

        if (request.fromGroupName.equals(request.toGroupName)) {
            return ResponseEntity.badRequest().body("Bảng nguồn và bảng đích phải khác nhau.");
        }

        Optional<Tournament> tournamentOpt = findTournamentByIdForUpdateHydrated(id);
        if (tournamentOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        Tournament tournament = tournamentOpt.get();
        ResponseEntity<?> staleWrite = validateExpectedMetadataVersion(
            tournament,
            firstNonNull(request.expectedMetadataVersion, request.expectedTournamentVersion)
        );
        if (staleWrite != null) {
            return staleWrite;
        }
        List<Map<String, Object>> groups = toObjectMapList(tournament.getGroups());
        Map<String, Object> fromGroup = findGroupByName(groups, request.fromGroupName);
        Map<String, Object> toGroup = findGroupByName(groups, request.toGroupName);
        if (fromGroup == null || toGroup == null) {
            return ResponseEntity.badRequest().body("Không tìm thấy bảng nguồn hoặc bảng đích.");
        }

        List<Map<String, Object>> fromCompetitors = toObjectMapList(fromGroup.get("competitors"));
        List<Map<String, Object>> toCompetitors = toObjectMapList(toGroup.get("competitors"));
        if (toCompetitors.stream().anyMatch(item -> request.competitorId.equals(asString(item.get("id"))))) {
            return ResponseEntity.badRequest().body("Đối tượng thi đấu đã tồn tại ở bảng đích.");
        }

        Map<String, Object> movedCompetitor = null;
        List<Map<String, Object>> nextFromCompetitors = new ArrayList<>();
        for (Map<String, Object> competitor : fromCompetitors) {
            if (request.competitorId.equals(asString(competitor.get("id")))) {
                movedCompetitor = new LinkedHashMap<>(competitor);
                continue;
            }
            nextFromCompetitors.add(competitor);
        }

        if (movedCompetitor == null) {
            return ResponseEntity.badRequest().body("Không tìm thấy đối tượng thi đấu trong bảng nguồn.");
        }

        toCompetitors.add(movedCompetitor);
        fromGroup.put("competitors", new ArrayList<>(nextFromCompetitors));
        toGroup.put("competitors", new ArrayList<>(toCompetitors));

        rebuildTournamentScheduleFromGroups(tournament, groups);
        touchMetadataVersion(tournament);

        Tournament saved = tournamentRepository.save(tournament);
        persistTournamentState(saved);
        syncNormalizedReadModels(saved, request.recordedById);
        return ResponseEntity.ok(saved);
    }

    @Transactional
    @PostMapping("/{id}/teams/rebalance-deficit")
    public ResponseEntity<?> rebalanceDeficitTeams(@PathVariable String id, @RequestBody TeamRebalanceRequest request) {
        Optional<Tournament> tournamentOpt = findTournamentByIdForUpdateHydrated(id);
        if (tournamentOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        Tournament tournament = tournamentOpt.get();
        Long expectedVersion = request == null
            ? null
            : firstNonNull(request.expectedMetadataVersion, request.expectedTournamentVersion);
        ResponseEntity<?> staleWrite = validateExpectedMetadataVersion(tournament, expectedVersion);
        if (staleWrite != null) {
            return staleWrite;
        }
        if (!"team".equalsIgnoreCase(asString(tournament.getType()))) {
            return ResponseEntity.badRequest().body("Chỉ hỗ trợ tái cấu trúc đội cho giải đồng đội.");
        }

        int teamSize = tournament.getTeamSize() == null ? 3 : tournament.getTeamSize();
        List<Map<String, Object>> teams = toObjectMapList(tournament.getTeams());
        if (teams.isEmpty()) {
            return ResponseEntity.badRequest().body("Giải đấu chưa có dữ liệu đội để tái cấu trúc.");
        }

        List<Map<String, Object>> deficitTeams = new ArrayList<>();
        List<Map<String, Object>> stableTeams = new ArrayList<>();
        for (Map<String, Object> team : teams) {
            List<Map<String, Object>> players = toObjectMapList(team.get("players"));
            if (players.size() < teamSize) {
                deficitTeams.add(team);
            } else {
                stableTeams.add(team);
            }
        }

        if (deficitTeams.isEmpty()) {
            return ResponseEntity.ok(tournament);
        }

        List<Map<String, Object>> poolPlayers = new ArrayList<>();
        for (Map<String, Object> team : deficitTeams) {
            poolPlayers.addAll(toObjectMapList(team.get("players")));
        }

        int numNewTeams = poolPlayers.size() / teamSize;
        List<Map<String, Object>> rebuiltTeams = new ArrayList<>(stableTeams);
        for (int i = 0; i < numNewTeams; i += 1) {
            List<Object> players = new ArrayList<>();
            for (int j = 0; j < teamSize; j += 1) {
                players.add(poolPlayers.get(i * teamSize + j));
            }

            Map<String, Object> newTeam = new LinkedHashMap<>();
            newTeam.put("id", "team-reformed-" + UUID.randomUUID().toString().substring(0, 8));
            newTeam.put("name", "Đội Tái Cấu Trúc " + (i + 1));
            newTeam.put("players", players);
            rebuiltTeams.add(newTeam);
        }

        List<Object> teamObjects = new ArrayList<>();
        teamObjects.addAll(rebuiltTeams);
        tournament.setTeams(teamObjects);

        List<Map<String, Object>> allCompetitors = new ArrayList<>();
        for (Map<String, Object> team : rebuiltTeams) {
            Map<String, Object> competitor = new LinkedHashMap<>();
            competitor.put("id", asString(team.get("id")));
            competitor.put("name", asString(team.get("name")));
            allCompetitors.add(competitor);
        }

        List<Map<String, Object>> groups;
        if ("round_robin".equalsIgnoreCase(asString(tournament.getFormat()))) {
            Map<String, Object> onlyGroup = new LinkedHashMap<>();
            onlyGroup.put("groupName", "Vòng tròn");
            onlyGroup.put("competitors", new ArrayList<>(allCompetitors));
            groups = new ArrayList<>();
            groups.add(onlyGroup);
        } else {
            groups = buildGroupsDeterministic(allCompetitors, tournament.getGroupSize() == null ? 4 : tournament.getGroupSize());
        }

        rebuildTournamentScheduleFromGroups(tournament, groups);

        touchMetadataVersion(tournament);
        Tournament saved = tournamentRepository.save(tournament);
        persistTournamentState(saved);
        syncNormalizedReadModels(saved, request == null ? null : request.recordedById);
        return ResponseEntity.ok(saved);
    }

    @Transactional
    @PostMapping("/{id}/groups/rebuild-schedule")
    public ResponseEntity<?> rebuildGroupSchedule(@PathVariable String id, @RequestBody GroupScheduleRebuildRequest request) {
        Optional<Tournament> tournamentOpt = findTournamentByIdForUpdateHydrated(id);
        if (tournamentOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        Tournament tournament = tournamentOpt.get();
        Long expectedVersion = request == null
            ? null
            : firstNonNull(request.expectedMetadataVersion, request.expectedTournamentVersion);
        ResponseEntity<?> staleWrite = validateExpectedMetadataVersion(tournament, expectedVersion);
        if (staleWrite != null) {
            return staleWrite;
        }
        List<Map<String, Object>> groups = toObjectMapList(tournament.getGroups());
        if (groups.isEmpty()) {
            return ResponseEntity.badRequest().body("Giải đấu chưa có bảng để dựng lịch.");
        }

        rebuildTournamentScheduleFromGroups(tournament, groups);

        touchMetadataVersion(tournament);
        Tournament saved = tournamentRepository.save(tournament);
        persistTournamentState(saved);
        syncNormalizedReadModels(saved, request == null ? null : request.recordedById);
        return ResponseEntity.ok(saved);
    }

    @Transactional
    @PostMapping("/{id}/stage/knockout/start")
    public ResponseEntity<?> startKnockoutStage(@PathVariable String id, @RequestBody KnockoutStartRequest request) {
        Optional<Tournament> tournamentOpt = findTournamentByIdForUpdateHydrated(id);
        if (tournamentOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        Tournament tournament = tournamentOpt.get();
        Long expectedVersion = request == null
                ? null
                : firstNonNull(request.expectedMetadataVersion, request.expectedTournamentVersion);
        ResponseEntity<?> staleWrite = validateExpectedMetadataVersion(tournament, expectedVersion);
        if (staleWrite != null) {
            return staleWrite;
        }
        if (tournament.getScores() == null || tournament.getScores().isEmpty()) {
            return ResponseEntity.badRequest().body("Chưa có trận đấu vòng bảng nào.");
        }
        boolean allCompleted = tournament.getScores().stream()
                .allMatch(score -> isScoreCompletedForStanding(toObjectMap(score)));
        if (!allCompleted) {
            return ResponseEntity.badRequest().body("Chưa hoàn thành tất cả các trận đấu vòng bảng trước khi bốc thăm nhánh đấu trực tiếp.");
        }

        List<Object> standings = computeStandingsFromScores(tournament.getGroups(), tournament.getScores());
        List<Object> knockoutMatches = buildInitialKnockoutMatches(standings);
        if (knockoutMatches.isEmpty()) {
            return ResponseEntity.badRequest().body("Không đủ dữ liệu xếp hạng để bốc thăm nhánh đấu trực tiếp.");
        }

        tournament.setKnockoutMatches(knockoutMatches);
        tournament.setStage("knockout");
        touchMetadataVersion(tournament);

        Tournament saved = tournamentRepository.save(tournament);
        persistTournamentState(saved);
        syncNormalizedReadModels(saved, request == null ? null : request.recordedById);
        return ResponseEntity.ok(saved);
    }

    @Transactional
    @PostMapping("/{id}/status/finish")
    public ResponseEntity<?> finishTournament(@PathVariable String id, @RequestBody TournamentFinishRequest request) {
        Optional<Tournament> tournamentOpt = findTournamentByIdForUpdateHydrated(id);
        if (tournamentOpt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        Tournament tournament = tournamentOpt.get();
        Long expectedVersion = request == null
            ? null
            : firstNonNull(request.expectedMetadataVersion, request.expectedTournamentVersion);
        ResponseEntity<?> staleWrite = validateExpectedMetadataVersion(tournament, expectedVersion);
        if (staleWrite != null) {
            return staleWrite;
        }
        tournament.setStatus("finished");
        tournament.setFinishedAt(LocalDate.now());
        touchMetadataVersion(tournament);

        Tournament saved = tournamentRepository.save(tournament);
        persistTournamentState(saved);
        syncNormalizedReadModels(saved, request == null ? null : request.recordedById);
        return ResponseEntity.ok(saved);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteTournament(@PathVariable String id) {
        if (!tournamentRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        tournamentRepository.deleteById(id);
        return ResponseEntity.ok().build();
    }

    private boolean isSeedUsed(List<TournamentRegistration> list, int seed) {
        return list.stream().anyMatch(r -> r.getSeed() != null && r.getSeed() == seed);
    }

    private Optional<Tournament> findTournamentByIdHydrated(String id) {
        Optional<Tournament> tournamentOpt = tournamentRepository.findById(id);
        tournamentOpt.ifPresent(this::hydrateTournamentState);
        return tournamentOpt;
    }

    private Optional<Tournament> findTournamentByIdForUpdateHydrated(String id) {
        Optional<Tournament> tournamentOpt = tournamentRepository.findByIdForUpdate(id);
        tournamentOpt.ifPresent(this::hydrateTournamentState);
        return tournamentOpt;
    }

    private void hydrateTournamentStates(List<Tournament> tournaments) {
        if (tournaments == null || tournaments.isEmpty()) {
            return;
        }
        for (Tournament tournament : tournaments) {
            hydrateTournamentState(tournament);
        }
    }

    private void hydrateTournamentState(Tournament tournament) {
        if (tournament == null || isBlank(tournament.getId())) {
            return;
        }

        TournamentState state = tournamentStateRepository.findById(tournament.getId()).orElse(null);
        if (state == null) {
            tournament.setParticipants(new ArrayList<>());
            tournament.setGroups(new ArrayList<>());
            tournament.setScores(new ArrayList<>());
            tournament.setKnockoutMatches(new ArrayList<>());
            tournament.setTeams(new ArrayList<>());
            tournament.setCaptains(new ArrayList<>());
            tournament.setDrawRules(new HashMap<>());
            tournament.setManualTeamSlots(new ArrayList<>());
        } else {
            tournament.setParticipants(copyStringList(state.getParticipants()));
            tournament.setGroups(copyObjectList(state.getGroups()));
            tournament.setScores(copyObjectList(state.getScores()));
            tournament.setKnockoutMatches(copyObjectList(state.getKnockoutMatches()));
            tournament.setTeams(copyObjectList(state.getTeams()));
            tournament.setCaptains(copyStringList(state.getCaptains()));
            tournament.setDrawRules(state.getDrawRules());
            tournament.setManualTeamSlots(copyObjectList(state.getManualTeamSlots()));
        }

        // Hydrate Registrations & Auto Backfill if registrations are empty
        List<TournamentRegistration> regs = tournamentRegistrationRepository.findByTournamentIdOrderBySeedAsc(tournament.getId());
        List<String> participants = tournament.getParticipants();
        if (regs.isEmpty() && participants != null && !participants.isEmpty()) {
            regs = new ArrayList<>();
            int seed = 1;
            for (String pid : participants) {
                Member member = memberRepository.findById(pid).orElse(null);
                if (member != null) {
                    TournamentRegistration reg = new TournamentRegistration();
                    reg.setTournamentId(tournament.getId());
                    reg.setMemberId(pid);
                    reg.setSeed(seed++);
                    reg.setSeedSource("auto");
                    reg.setRankSnapshot(member.getRankTier());
                    reg.setEloSnapshot(member.getElo());
                    reg.setGenderSnapshot(member.getGender());
                    reg.setDepartmentSnapshot(member.getDepartment());
                    reg.setIsCaptain(false);
                    reg.setStatus("active");
                    reg.setRegisteredAt(LocalDateTime.now());
                    tournamentRegistrationRepository.save(reg);
                    regs.add(reg);
                }
            }
            tournament.setRegistrationVersion(tournament.getRegistrationVersion() + 1);
            tournamentRepository.save(tournament);
        }
        tournament.setRegistrations(new ArrayList<>(regs));

        // Hydrate Seed Override History
        List<TournamentSeedOverrideHistory> history = tournamentSeedOverrideHistoryRepository.findByTournamentIdOrderByOverriddenAtDesc(tournament.getId());
        tournament.setSeedOverrideHistory(new ArrayList<>(history));

        // Hydrate Draw Revisions
        List<TournamentDrawRevision> drawRevs = tournamentDrawRevisionRepository.findByTournamentIdOrderByRevisionNoDesc(tournament.getId());
        List<Map<String, Object>> mappedRevisions = new ArrayList<>();
        for (TournamentDrawRevision rev : drawRevs) {
            Map<String, Object> map = new HashMap<>();
            map.put("revisionNo", rev.getRevisionNo());
            map.put("createdAt", rev.getCreatedAt().toString());
            map.put("reason", rev.getReason());
            map.put("actorId", rev.getActorId());
            map.put("status", rev.getStatus());
            map.put("objectiveScore", rev.getObjectiveScore());
            map.put("basedOnRegistrationVersion", rev.getBasedOnRegistrationVersion());
            
            // Load teams
            List<TournamentDrawRevisionTeam> teams = tournamentDrawRevisionTeamRepository.findByRevisionId(rev.getId());
            List<Map<String, Object>> mappedTeams = new ArrayList<>();
            for (TournamentDrawRevisionTeam team : teams) {
                Map<String, Object> teamMap = new HashMap<>();
                teamMap.put("teamId", team.getTeamId());
                teamMap.put("teamName", team.getTeamName());
                teamMap.put("seedTotal", team.getSeedTotal());
                
                List<String> memberIds = tournamentDrawRevisionTeamMemberRepository.findByRevisionIdAndTeamId(rev.getId(), team.getTeamId())
                    .stream().map(m -> m.getMemberId()).collect(Collectors.toList());
                teamMap.put("memberIds", memberIds);
                mappedTeams.add(teamMap);
            }
            map.put("teams", mappedTeams);
            
            // Load groups
            List<TournamentDrawRevisionGroup> groups = tournamentDrawRevisionGroupRepository.findByRevisionId(rev.getId());
            Map<String, List<String>> groupCompetitorsMap = new LinkedHashMap<>();
            for (TournamentDrawRevisionGroup group : groups) {
                groupCompetitorsMap.computeIfAbsent(group.getGroupName(), k -> new ArrayList<>()).add(group.getCompetitorId());
            }
            List<Map<String, Object>> mappedGroups = new ArrayList<>();
            for (Map.Entry<String, List<String>> entry : groupCompetitorsMap.entrySet()) {
                Map<String, Object> groupMap = new HashMap<>();
                groupMap.put("groupName", entry.getKey());
                groupMap.put("competitorIds", entry.getValue());
                mappedGroups.add(groupMap);
            }
            map.put("groups", mappedGroups);
            
            mappedRevisions.add(map);
        }
        tournament.setDrawRevisions(new ArrayList<>(mappedRevisions));
    }

    private void persistTournamentState(Tournament tournament) {
        if (tournament == null || isBlank(tournament.getId())) {
            return;
        }

        TournamentState state = tournamentStateRepository.findById(tournament.getId())
                .orElseGet(() -> {
                    TournamentState created = new TournamentState();
                    created.setTournamentId(tournament.getId());
                    return created;
                });

        state.setParticipants(copyStringList(tournament.getParticipants()));
        state.setGroups(copyObjectList(tournament.getGroups()));
        state.setScores(copyObjectList(tournament.getScores()));
        state.setKnockoutMatches(copyObjectList(tournament.getKnockoutMatches()));
        state.setTeams(copyObjectList(tournament.getTeams()));
        state.setCaptains(copyStringList(tournament.getCaptains()));
        state.setDrawRules(tournament.getDrawRules());
        state.setManualTeamSlots(copyObjectList(tournament.getManualTeamSlots()));
        tournamentStateRepository.save(state);
    }

    private List<String> copyStringList(List<String> source) {
        return source == null ? new ArrayList<>() : new ArrayList<>(source);
    }

    private List<Object> copyObjectList(List<Object> source) {
        return source == null ? new ArrayList<>() : new ArrayList<>(source);
    }

    private ResponseEntity<Map<String, Object>> buildConflictResponse(Tournament latest, String message) {
        hydrateTournamentState(latest);
        Map<String, Object> body = new HashMap<>();
        body.put("error", "TOURNAMENT_VERSION_CONFLICT");
        body.put("message", message);
        body.put("latestTournament", latest);
        return ResponseEntity.status(409).body(body);
    }

    private ResponseEntity<?> validateExpectedMetadataVersion(Tournament tournament, Long expectedVersion) {
        if (expectedVersion == null || tournament == null || tournament.getMetadataVersion() == null) {
            return null;
        }

        // Soft-check mode: server serializes writes under row lock and applies on latest state.
        // We do not reject stale versions here to avoid forcing end users to retry manually.

        return null;
    }

    private ResponseEntity<?> validateExpectedCompetitionVersion(Tournament tournament, Long expectedVersion) {
        if (expectedVersion == null || tournament == null || tournament.getCompetitionVersion() == null) {
            return null;
        }

        // Soft-check mode: server serializes writes under row lock and applies on latest state.
        // We do not reject stale versions here to avoid forcing end users to retry manually.

        return null;
    }

    private Long firstNonNull(Long preferred, Long fallback) {
        return preferred != null ? preferred : fallback;
    }

    private long safeMetadataVersion(Tournament tournament) {
        return tournament == null || tournament.getMetadataVersion() == null ? 0L : tournament.getMetadataVersion();
    }

    private long safeCompetitionVersion(Tournament tournament) {
        return tournament == null || tournament.getCompetitionVersion() == null ? 0L : tournament.getCompetitionVersion();
    }

    private void touchMetadataVersion(Tournament tournament) {
        tournament.setMetadataVersion(safeMetadataVersion(tournament) + 1L);
    }

    private void touchCompetitionVersion(Tournament tournament) {
        tournament.setCompetitionVersion(safeCompetitionVersion(tournament) + 1L);
    }

    private void ensureFinalAndBronzeMatches(Tournament tournament) {
        if (tournament.getKnockoutMatches() == null || tournament.getKnockoutMatches().isEmpty()) {
            return;
        }

        Map<String, Object> sf1 = findMatchById(tournament.getKnockoutMatches(), "sf-1", true);
        Map<String, Object> sf2 = findMatchById(tournament.getKnockoutMatches(), "sf-2", true);
        if (sf1 == null || sf2 == null) {
            return;
        }

        String sf1Winner = asString(sf1.get("winnerId"));
        String sf2Winner = asString(sf2.get("winnerId"));
        if (sf1Winner.isEmpty() || sf2Winner.isEmpty()) {
            return;
        }

        Map<String, Object> finalMatch = findMatchById(tournament.getKnockoutMatches(), "f-1", true);
        if (finalMatch == null) {
            finalMatch = new LinkedHashMap<>();
            finalMatch.put("id", "f-1");
            finalMatch.put("roundName", "Finals");
            finalMatch.put("homeCompetitorId", sf1Winner);
            finalMatch.put("awayCompetitorId", sf2Winner);
            finalMatch.put("homeScore", 0);
            finalMatch.put("awayScore", 0);
            tournament.getKnockoutMatches().add(finalMatch);
        } else if (!sf1Winner.equals(asString(finalMatch.get("homeCompetitorId")))
                || !sf2Winner.equals(asString(finalMatch.get("awayCompetitorId")))) {
            finalMatch.put("homeCompetitorId", sf1Winner);
            finalMatch.put("awayCompetitorId", sf2Winner);
            finalMatch.put("homeScore", 0);
            finalMatch.put("awayScore", 0);
            finalMatch.put("completed", false);
            finalMatch.put("winnerId", null);
            finalMatch.put("setScores", new ArrayList<>());
        }

        String sf1Loser = sf1Winner.equals(asString(sf1.get("homeCompetitorId")))
                ? asString(sf1.get("awayCompetitorId"))
                : asString(sf1.get("homeCompetitorId"));
        String sf2Loser = sf2Winner.equals(asString(sf2.get("homeCompetitorId")))
                ? asString(sf2.get("awayCompetitorId"))
                : asString(sf2.get("homeCompetitorId"));

        Map<String, Object> bronzeMatch = findMatchById(tournament.getKnockoutMatches(), "3rd-1", true);
        if (bronzeMatch == null) {
            bronzeMatch = new LinkedHashMap<>();
            bronzeMatch.put("id", "3rd-1");
            bronzeMatch.put("roundName", "Bronze");
            bronzeMatch.put("homeCompetitorId", sf1Loser);
            bronzeMatch.put("awayCompetitorId", sf2Loser);
            bronzeMatch.put("homeScore", 0);
            bronzeMatch.put("awayScore", 0);
            tournament.getKnockoutMatches().add(bronzeMatch);
        } else if (!sf1Loser.equals(asString(bronzeMatch.get("homeCompetitorId")))
                || !sf2Loser.equals(asString(bronzeMatch.get("awayCompetitorId")))) {
            bronzeMatch.put("homeCompetitorId", sf1Loser);
            bronzeMatch.put("awayCompetitorId", sf2Loser);
            bronzeMatch.put("homeScore", 0);
            bronzeMatch.put("awayScore", 0);
            bronzeMatch.put("completed", false);
            bronzeMatch.put("winnerId", null);
            bronzeMatch.put("setScores", new ArrayList<>());
        }
    }

    private void removeDependentMatches(Tournament tournament, String changedMatchId) {
        if (tournament.getKnockoutMatches() == null || tournament.getKnockoutMatches().isEmpty()) {
            return;
        }

        if (!"sf-1".equals(changedMatchId) && !"sf-2".equals(changedMatchId)) {
            return;
        }

        tournament.getKnockoutMatches().removeIf(matchObj -> {
            Map<String, Object> match = toObjectMap(matchObj);
            String id = asString(match.get("id"));
            return "f-1".equals(id) || "3rd-1".equals(id);
        });
    }

    private Map<String, Object> findTeamById(List<Map<String, Object>> teams, String teamId) {
        if (teams == null || isBlank(teamId)) {
            return null;
        }
        for (Map<String, Object> team : teams) {
            if (teamId.equals(asString(team.get("id")))) {
                return team;
            }
        }
        return null;
    }

    private Map<String, Object> findGroupByName(List<Map<String, Object>> groups, String groupName) {
        if (groups == null || isBlank(groupName)) {
            return null;
        }
        for (Map<String, Object> group : groups) {
            if (groupName.equals(asString(group.get("groupName")))) {
                return group;
            }
        }
        return null;
    }

    private void invalidateTournamentMatchesByCompetitors(Tournament tournament, Set<String> competitorIds) {
        if (tournament == null || competitorIds == null || competitorIds.isEmpty()) {
            return;
        }

        if (tournament.getScores() != null) {
            for (Object scoreObj : tournament.getScores()) {
                Map<String, Object> score = toObjectMap(scoreObj);
                String homeId = asString(score.get("homeCompetitorId"));
                String awayId = asString(score.get("awayCompetitorId"));
                if (!competitorIds.contains(homeId) && !competitorIds.contains(awayId)) {
                    continue;
                }
                clearMatchForTopologyChange(score, false);
            }
        }

        if (tournament.getKnockoutMatches() != null) {
            List<String> changedKnockoutIds = new ArrayList<>();
            for (Object knockoutObj : tournament.getKnockoutMatches()) {
                Map<String, Object> match = toObjectMap(knockoutObj);
                String homeId = asString(match.get("homeCompetitorId"));
                String awayId = asString(match.get("awayCompetitorId"));
                if (!competitorIds.contains(homeId) && !competitorIds.contains(awayId)) {
                    continue;
                }
                clearMatchForTopologyChange(match, true);
                String id = asString(match.get("id"));
                if (!id.isEmpty()) {
                    changedKnockoutIds.add(id);
                }
            }

            for (String changedId : changedKnockoutIds) {
                removeDependentMatches(tournament, changedId);
            }
        }
    }

    private void clearMatchForTopologyChange(Map<String, Object> match, boolean knockout) {
        match.put("lineup", new LinkedHashMap<>());
        match.put("subMatches", new ArrayList<>());
        match.put("homeScore", 0);
        match.put("awayScore", 0);
        match.put("completed", false);
        match.put("setScores", new ArrayList<>());
        if (knockout) {
            match.put("winnerId", null);
        }
    }

    private void rebuildTournamentScheduleFromGroups(Tournament tournament, List<Map<String, Object>> groups) {
        List<Object> groupObjects = new ArrayList<>();
        groupObjects.addAll(groups);
        tournament.setGroups(groupObjects);

        List<Object> scores = new ArrayList<>();
        for (Map<String, Object> group : groups) {
            String groupName = asString(group.get("groupName"));
            List<Map<String, Object>> competitors = toObjectMapList(group.get("competitors"));
            for (int i = 0; i < competitors.size(); i += 1) {
                for (int j = i + 1; j < competitors.size(); j += 1) {
                    Map<String, Object> score = new LinkedHashMap<>();
                    score.put("groupName", groupName);
                    score.put("homeCompetitorId", asString(competitors.get(i).get("id")));
                    score.put("awayCompetitorId", asString(competitors.get(j).get("id")));
                    score.put("homeScore", 0);
                    score.put("awayScore", 0);
                    score.put("completed", false);
                    score.put("setScores", new ArrayList<>());
                    score.put("lineup", new LinkedHashMap<>());
                    score.put("subMatches", new ArrayList<>());
                    scores.add(score);
                }
            }
        }

        tournament.setScores(scores);
        tournament.setStage("group");
        tournament.setKnockoutMatches(new ArrayList<>());
    }

    private List<Map<String, Object>> buildGroupsDeterministic(List<Map<String, Object>> competitors, int groupSize) {
        List<Map<String, Object>> groups = new ArrayList<>();
        int effectiveGroupSize = Math.max(groupSize, 2);

        int groupIndex = 0;
        for (int i = 0; i < competitors.size(); i += effectiveGroupSize) {
            Map<String, Object> group = new LinkedHashMap<>();
            group.put("groupName", String.valueOf((char) ('A' + groupIndex)));

            List<Object> groupCompetitors = new ArrayList<>();
            for (int j = i; j < Math.min(i + effectiveGroupSize, competitors.size()); j += 1) {
                groupCompetitors.add(competitors.get(j));
            }
            group.put("competitors", groupCompetitors);
            groups.add(group);
            groupIndex += 1;
        }

        return groups;
    }

    private List<Object> buildInitialKnockoutMatches(List<Object> standings) {
        List<Map<String, Object>> qualified = pickQualifiedRows(standings, 2);
        List<Object> knockoutMatches = new ArrayList<>();

        if (qualified.size() == 2) {
            knockoutMatches.add(buildKnockoutMatch("f-1", "Finals", qualified.get(0), qualified.get(1)));
            return knockoutMatches;
        }

        if (qualified.size() < 4) {
            return knockoutMatches;
        }

        Map<String, Object> groupA = null;
        Map<String, Object> groupB = null;
        for (Map<String, Object> standing : toObjectMapList(standings)) {
            String groupName = asString(standing.get("groupName"));
            if ("A".equalsIgnoreCase(groupName)) {
                groupA = standing;
            } else if ("B".equalsIgnoreCase(groupName)) {
                groupB = standing;
            }
        }

        if (groupA != null && groupB != null) {
            Map<String, Object> a1 = findStandingRowByRank(toObjectMapList(groupA.get("rows")), 1);
            Map<String, Object> a2 = findStandingRowByRank(toObjectMapList(groupA.get("rows")), 2);
            Map<String, Object> b1 = findStandingRowByRank(toObjectMapList(groupB.get("rows")), 1);
            Map<String, Object> b2 = findStandingRowByRank(toObjectMapList(groupB.get("rows")), 2);

            if (a1 != null && a2 != null && b1 != null && b2 != null) {
                knockoutMatches.add(buildKnockoutMatch("sf-1", "Semifinals", a1, b2));
                knockoutMatches.add(buildKnockoutMatch("sf-2", "Semifinals", b1, a2));
                return knockoutMatches;
            }
        }

        knockoutMatches.add(buildKnockoutMatch("sf-1", "Semifinals", qualified.get(0), qualified.get(3)));
        knockoutMatches.add(buildKnockoutMatch("sf-2", "Semifinals", qualified.get(1), qualified.get(2)));
        return knockoutMatches;
    }

    private List<Map<String, Object>> pickQualifiedRows(List<Object> standings, int qualifyPerGroup) {
        List<Map<String, Object>> qualified = new ArrayList<>();
        for (Map<String, Object> standing : toObjectMapList(standings)) {
            List<Map<String, Object>> rows = toObjectMapList(standing.get("rows"));
            for (Map<String, Object> row : rows) {
                if (asInt(row.get("rank")) <= qualifyPerGroup) {
                    qualified.add(row);
                }
            }
        }
        return qualified;
    }

    private Map<String, Object> findStandingRowByRank(List<Map<String, Object>> rows, int rank) {
        for (Map<String, Object> row : rows) {
            if (asInt(row.get("rank")) == rank) {
                return row;
            }
        }
        return null;
    }

    private Map<String, Object> buildKnockoutMatch(String id, String roundName, Map<String, Object> homeRow, Map<String, Object> awayRow) {
        String homeId = asString(toObjectMap(homeRow.get("competitor")).get("id"));
        String awayId = asString(toObjectMap(awayRow.get("competitor")).get("id"));

        Map<String, Object> match = new LinkedHashMap<>();
        match.put("id", id);
        match.put("roundName", roundName);
        match.put("homeCompetitorId", homeId);
        match.put("awayCompetitorId", awayId);
        match.put("homeScore", 0);
        match.put("awayScore", 0);
        match.put("completed", false);
        match.put("winnerId", null);
        match.put("setScores", new ArrayList<>());
        match.put("lineup", new LinkedHashMap<>());
        match.put("subMatches", new ArrayList<>());
        return match;
    }

    private Map<String, Object> findMatchById(List<Object> matches, String matchId, boolean knockout) {
        if (matches == null || isBlank(matchId)) {
            return null;
        }

        for (Object matchObj : matches) {
            Map<String, Object> match = toObjectMap(matchObj);
            if (knockout) {
                if (matchId.equals(asString(match.get("id")))) {
                    return match;
                }
                continue;
            }

            String key = asString(match.get("groupName")) + "-"
                    + asString(match.get("homeCompetitorId")) + "-"
                    + asString(match.get("awayCompetitorId"));
            if (matchId.equals(key)) {
                return match;
            }
        }

        return null;
    }

    private void recordTournamentMatchEvent(
            String tournamentId,
            String stage,
            String groupName,
            String matchId,
            Integer subMatchIdx,
            String homeCompetitorId,
            String awayCompetitorId,
            Integer homeScore,
            Integer awayScore,
            String recordedById,
            String requestId
    ) {
        String normalizedActor = isBlank(recordedById) ? "SYSTEM" : recordedById;

        if (!isBlank(requestId)
                && tournamentMatchEventRepository.existsByTournamentIdAndRequestId(tournamentId, requestId)) {
            return;
        }

        MatchRecord record = new MatchRecord();
        record.setId("m" + UUID.randomUUID().toString().substring(0, 8));
        record.setPlayedAt(LocalDateTime.now());
        record.setSource("tournament");
        record.setHomePlayerId(null);
        record.setAwayPlayerId(null);
        record.setHomeScore(homeScore == null ? 0 : homeScore);
        record.setAwayScore(awayScore == null ? 0 : awayScore);
        record.setHomeEloBefore(0);
        record.setAwayEloBefore(0);
        record.setHomeEloAfter(0);
        record.setAwayEloAfter(0);
        record.setStatus("confirmed");
        record.setRecordedById(normalizedActor);
        record.setTournamentId(tournamentId);
        record.setTournamentMatchKey(matchId);
        record.setTournamentStage(stage);
        record.setTournamentGroupName(groupName);
        record.setTournamentSubMatchIdx(subMatchIdx);
        record.setActionType(stage);
        record.setRequestId(requestId);
        record.setNotes(String.format(
                "TOURNAMENT_RESULT|tournamentId=%s|stage=%s|group=%s|matchId=%s|subMatchIdx=%s|homeCompetitorId=%s|awayCompetitorId=%s",
                safeNotePart(tournamentId),
                safeNotePart(stage),
                safeNotePart(groupName),
                safeNotePart(matchId),
                subMatchIdx == null ? "" : String.valueOf(subMatchIdx),
                safeNotePart(homeCompetitorId),
                safeNotePart(awayCompetitorId)
        ));
        matchRecordRepository.save(record);

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("tournamentId", tournamentId);
        payload.put("stage", stage);
        payload.put("groupName", groupName);
        payload.put("matchId", matchId);
        payload.put("subMatchIdx", subMatchIdx);
        payload.put("homeCompetitorId", homeCompetitorId);
        payload.put("awayCompetitorId", awayCompetitorId);
        payload.put("homeScore", homeScore == null ? 0 : homeScore);
        payload.put("awayScore", awayScore == null ? 0 : awayScore);

        TournamentMatchEvent event = new TournamentMatchEvent();
        event.setId("e" + UUID.randomUUID().toString().substring(0, 10));
        event.setTournamentId(tournamentId);
        event.setMatchKey(matchId);
        event.setActionType(stage);
        event.setPayloadJson(toJsonString(payload));
        event.setActorId(normalizedActor);
        event.setRequestId(requestId);
        event.setCreatedAt(LocalDateTime.now());
        tournamentMatchEventRepository.save(event);
    }

    private Map<String, Object> buildMatchWriteResponse(
            Tournament saved,
            Map<String, Object> updatedGroupMatch,
            Map<String, Object> updatedKnockoutMatch,
            boolean includeStandings,
            boolean includeKnockoutMatches
    ) {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("tournamentId", saved.getId());
        response.put("metadataVersion", safeMetadataVersion(saved));
        response.put("competitionVersion", safeCompetitionVersion(saved));
        response.put("version", safeCompetitionVersion(saved));
        response.put("stage", saved.getStage());
        response.put("status", saved.getStatus());

        if (updatedGroupMatch != null) {
            response.put("updatedGroupMatch", updatedGroupMatch);
        }
        if (updatedKnockoutMatch != null) {
            response.put("updatedKnockoutMatch", updatedKnockoutMatch);
        }
        if (includeStandings) {
            response.put("standings", computeStandingsFromScores(saved.getGroups(), saved.getScores()));
        }
        if (includeKnockoutMatches) {
            response.put("knockoutMatches", saved.getKnockoutMatches() == null ? List.of() : saved.getKnockoutMatches());
        }

        return response;
    }

    private void syncNormalizedReadModels(Tournament tournament, String updatedBy) {
        syncMatchLineupsFromTournament(tournament, updatedBy);
        syncMatchStatesFromTournament(tournament, updatedBy);
    }

    private void syncMatchLineupsFromTournament(Tournament tournament, String updatedBy) {
        String tournamentId = tournament.getId();
        if (isBlank(tournamentId)) {
            return;
        }

        tournamentMatchLineupRepository.deleteByTournamentId(tournamentId);

        List<TournamentMatchLineup> lineups = new ArrayList<>();
        collectMatchLineups(lineups, tournament, "group", tournament.getScores(), false, updatedBy);
        collectMatchLineups(lineups, tournament, "knockout", tournament.getKnockoutMatches(), true, updatedBy);

        if (!lineups.isEmpty()) {
            tournamentMatchLineupRepository.saveAll(lineups);
        }
    }

    private void collectMatchLineups(
            List<TournamentMatchLineup> sink,
            Tournament tournament,
            String stage,
            List<Object> matches,
            boolean knockout,
            String updatedBy
    ) {
        if (matches == null || matches.isEmpty()) {
            return;
        }

        for (Object matchObj : matches) {
            Map<String, Object> match = toObjectMap(matchObj);
            Map<String, Object> lineup = toObjectMap(match.get("lineup"));
            List<Map<String, Object>> subMatches = toObjectMapList(match.get("subMatches"));
            if (lineup.isEmpty() && subMatches.isEmpty()) {
                continue;
            }

            String rawMatchKey = extractRawMatchKey(match, knockout);
            if (isBlank(rawMatchKey)) {
                continue;
            }

            TournamentMatchLineup model = new TournamentMatchLineup();
            model.setId("ml" + UUID.randomUUID().toString().substring(0, 10));
            model.setTournamentId(tournament.getId());
            model.setStage(stage);
            model.setGroupName(asString(match.get("groupName")));
            model.setMatchKey(rawMatchKey);
            model.setLineupJson(toJsonString(lineup));
            model.setSubMatchesJson(toJsonString(subMatches));
            model.setVersion(safeCompetitionVersion(tournament));
            model.setUpdatedAt(LocalDateTime.now());
            model.setUpdatedBy(isBlank(updatedBy) ? "SYSTEM" : updatedBy);
            sink.add(model);
        }
    }

    private void syncMatchStatesFromTournament(Tournament tournament, String updatedBy) {
        String tournamentId = tournament.getId();
        if (isBlank(tournamentId)) {
            return;
        }

        tournamentMatchStateRepository.deleteByTournamentId(tournamentId);

        Map<String, TournamentMatchState> statesByMatchKey = new LinkedHashMap<>();
        collectMatchStates(statesByMatchKey, tournament, "group", tournament.getScores(), false, updatedBy);
        collectMatchStates(statesByMatchKey, tournament, "knockout", tournament.getKnockoutMatches(), true, updatedBy);

        if (!statesByMatchKey.isEmpty()) {
            tournamentMatchStateRepository.saveAll(new ArrayList<>(statesByMatchKey.values()));
        }
    }

    private void collectMatchStates(
            Map<String, TournamentMatchState> sink,
            Tournament tournament,
            String stage,
            List<Object> matches,
            boolean knockout,
            String updatedBy
    ) {
        if (matches == null || matches.isEmpty()) {
            return;
        }

        for (Object matchObj : matches) {
            Map<String, Object> match = toObjectMap(matchObj);
            String rawMatchKey = extractRawMatchKey(match, knockout);

            if (isBlank(rawMatchKey)) {
                continue;
            }

            String matchKey = stage + ":" + rawMatchKey;

            TournamentMatchState parentState = new TournamentMatchState();
            parentState.setId("ms" + UUID.randomUUID().toString().substring(0, 10));
            parentState.setTournamentId(tournament.getId());
            parentState.setStage(stage);
            parentState.setGroupName(asString(match.get("groupName")));
            parentState.setMatchKey(matchKey);
            parentState.setParentMatchKey(null);
            parentState.setSubMatchIndex(null);
            parentState.setHomeCompetitorId(asString(match.get("homeCompetitorId")));
            parentState.setAwayCompetitorId(asString(match.get("awayCompetitorId")));
            parentState.setHomeScore(asInt(match.get("homeScore")));
            parentState.setAwayScore(asInt(match.get("awayScore")));
            parentState.setCompleted(asBoolean(match.get("completed")));
            parentState.setWinnerId(resolveWinnerId(match, knockout));
            parentState.setSetScores(toObjectList(match.get("setScores")));
            parentState.setVersion(safeCompetitionVersion(tournament));
            parentState.setUpdatedAt(LocalDateTime.now());
            parentState.setUpdatedBy(isBlank(updatedBy) ? "SYSTEM" : updatedBy);
            sink.put(parentState.getMatchKey(), parentState);

            List<Map<String, Object>> subMatches = toObjectMapList(match.get("subMatches"));
            for (int i = 0; i < subMatches.size(); i += 1) {
                Map<String, Object> sub = subMatches.get(i);
                TournamentMatchState subState = new TournamentMatchState();
                subState.setId("ms" + UUID.randomUUID().toString().substring(0, 10));
                subState.setTournamentId(tournament.getId());
                subState.setStage(stage + "_sub");
                subState.setGroupName(asString(match.get("groupName")));
                subState.setMatchKey(matchKey + "#" + i);
                subState.setParentMatchKey(matchKey);
                subState.setSubMatchIndex(i);
                subState.setHomeCompetitorId(firstPlayerId(sub.get("homePlayers")));
                subState.setAwayCompetitorId(firstPlayerId(sub.get("awayPlayers")));
                subState.setHomeScore(asInt(sub.get("homeScore")));
                subState.setAwayScore(asInt(sub.get("awayScore")));
                subState.setCompleted(asBoolean(sub.get("completed")));
                subState.setWinnerId(resolveWinnerId(sub, false));
                subState.setSetScores(toObjectList(sub.get("setScores")));
                subState.setVersion(safeCompetitionVersion(tournament));
                subState.setUpdatedAt(LocalDateTime.now());
                subState.setUpdatedBy(isBlank(updatedBy) ? "SYSTEM" : updatedBy);
                sink.put(subState.getMatchKey(), subState);
            }
        }
    }

    private String resolveWinnerId(Map<String, Object> match, boolean knockout) {
        String winnerId = asString(match.get("winnerId"));
        if (!winnerId.isEmpty()) {
            return winnerId;
        }
        if (!asBoolean(match.get("completed"))) {
            return "";
        }

        int home = asInt(match.get("homeScore"));
        int away = asInt(match.get("awayScore"));
        if (home == away) {
            return "";
        }

        if (home > away) {
            return asString(match.get("homeCompetitorId"));
        }

        return asString(match.get("awayCompetitorId"));
    }

    private String firstPlayerId(Object playersObj) {
        if (!(playersObj instanceof List<?> players) || players.isEmpty()) {
            return "";
        }
        Object first = players.get(0);
        return first == null ? "" : String.valueOf(first);
    }

    private List<Object> toObjectList(Object value) {
        if (!(value instanceof List<?> list)) {
            return new ArrayList<>();
        }
        return new ArrayList<>(list);
    }

    private String extractRawMatchKey(Map<String, Object> match, boolean knockout) {
        if (knockout) {
            return asString(match.get("id"));
        }

        return asString(match.get("groupName")) + "-"
                + asString(match.get("homeCompetitorId")) + "-"
                + asString(match.get("awayCompetitorId"));
    }

    private void upsertMatchLineup(
            Tournament tournament,
            String stage,
            String groupName,
            String rawMatchKey,
            Map<String, Object> lineup,
            List<Map<String, Object>> subMatches,
            String updatedBy
    ) {
        if (tournament == null || isBlank(tournament.getId()) || isBlank(stage) || isBlank(rawMatchKey)) {
            return;
        }

        TournamentMatchLineup model = tournamentMatchLineupRepository
                .findByTournamentIdAndStageAndMatchKey(tournament.getId(), stage, rawMatchKey)
                .orElseGet(() -> {
                    TournamentMatchLineup created = new TournamentMatchLineup();
                    created.setId("ml" + UUID.randomUUID().toString().substring(0, 10));
                    created.setTournamentId(tournament.getId());
                    created.setStage(stage);
                    created.setMatchKey(rawMatchKey);
                    return created;
                });

        model.setGroupName(groupName);
        model.setLineupJson(toJsonString(lineup == null ? new LinkedHashMap<>() : lineup));
        model.setSubMatchesJson(toJsonString(subMatches == null ? new ArrayList<>() : subMatches));
        model.setVersion(safeCompetitionVersion(tournament));
        model.setUpdatedAt(LocalDateTime.now());
        model.setUpdatedBy(isBlank(updatedBy) ? "SYSTEM" : updatedBy);
        tournamentMatchLineupRepository.save(model);
    }

    private Map<String, Object> parseObjectMapJson(String json) {
        if (isBlank(json)) {
            return new LinkedHashMap<>();
        }

        try {
            Object parsed = OBJECT_MAPPER.readValue(json, Object.class);
            if (parsed instanceof Map<?, ?> map) {
                @SuppressWarnings("unchecked")
                Map<String, Object> casted = (Map<String, Object>) map;
                return casted;
            }
        } catch (JsonProcessingException ignored) {
        }

        return new LinkedHashMap<>();
    }

    private List<Map<String, Object>> parseObjectMapListJson(String json) {
        if (isBlank(json)) {
            return new ArrayList<>();
        }

        try {
            Object parsed = OBJECT_MAPPER.readValue(json, Object.class);
            if (!(parsed instanceof List<?> list)) {
                return new ArrayList<>();
            }

            List<Map<String, Object>> converted = new ArrayList<>();
            for (Object item : list) {
                if (item instanceof Map<?, ?> map) {
                    @SuppressWarnings("unchecked")
                    Map<String, Object> casted = (Map<String, Object>) map;
                    converted.add(casted);
                }
            }
            return converted;
        } catch (JsonProcessingException ignored) {
            return new ArrayList<>();
        }
    }

    private Map<String, Object> toLineupObject(TeamLineupPayload payload) {
        Map<String, Object> lineup = new LinkedHashMap<>();
        lineup.put("aPlayerId", asString(payload.aPlayerId));
        lineup.put("bPlayerId", asString(payload.bPlayerId));
        lineup.put("cPlayerId", asString(payload.cPlayerId));
        lineup.put("xPlayerId", asString(payload.xPlayerId));
        lineup.put("yPlayerId", asString(payload.yPlayerId));
        lineup.put("zPlayerId", asString(payload.zPlayerId));
        lineup.put("isHomeABC", payload.isHomeABC == null || payload.isHomeABC);
        return lineup;
    }

    private List<Map<String, Object>> toSubMatchObjects(List<SubMatchPayload> payloads) {
        if (payloads == null || payloads.isEmpty()) {
            return new ArrayList<>();
        }

        List<Map<String, Object>> subMatches = new ArrayList<>();
        for (SubMatchPayload payload : payloads) {
            if (payload == null) {
                continue;
            }

            Map<String, Object> item = new LinkedHashMap<>();
            item.put("matchType", asString(payload.matchType));
            item.put("label", asString(payload.label));
            item.put("homePlayers", payload.homePlayers == null ? new ArrayList<>() : new ArrayList<>(payload.homePlayers));
            item.put("awayPlayers", payload.awayPlayers == null ? new ArrayList<>() : new ArrayList<>(payload.awayPlayers));
            item.put("homeScore", payload.homeScore == null ? 0 : payload.homeScore);
            item.put("awayScore", payload.awayScore == null ? 0 : payload.awayScore);
            item.put("completed", payload.completed != null && payload.completed);
            item.put("handicapText", asString(payload.handicapText));
            item.put("setScores", payload.setScores == null ? new ArrayList<>() : toSetScoreObjects(payload.setScores));
            subMatches.add(item);
        }

        return subMatches;
    }

    private String toJsonString(Object payload) {
        try {
            return OBJECT_MAPPER.writeValueAsString(payload);
        } catch (JsonProcessingException ex) {
            return "{}";
        }
    }

    private List<Map<String, Object>> toSetScoreObjects(List<SetScorePayload> setScores) {
        List<Map<String, Object>> mapped = new ArrayList<>();
        if (setScores == null) {
            return mapped;
        }

        for (SetScorePayload set : setScores) {
            Map<String, Object> score = new LinkedHashMap<>();
            score.put("home", set == null || set.home == null ? 0 : set.home);
            score.put("away", set == null || set.away == null ? 0 : set.away);
            mapped.add(score);
        }
        return mapped;
    }

    private boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }

    private String safeNotePart(String value) {
        if (value == null) {
            return "";
        }
        return value.replace("|", " ").trim();
    }

    private ResponseEntity<?> tryMergeConflictAndSave(String id, Tournament current, Tournament incoming, String conflictMessage) {
        boolean merged = applyConcurrentScoreMerge(current, incoming);
        if (!merged) {
            return buildConflictResponse(current, conflictMessage);
        }

        try {
            Tournament saved = tournamentRepository.save(current);
        persistTournamentState(saved);
            syncNormalizedReadModels(saved, "SYSTEM");
            return ResponseEntity.ok(saved);
        } catch (OptimisticLockingFailureException ex) {
            Tournament latest = findTournamentByIdHydrated(id).orElse(null);
            if (latest == null) {
                return ResponseEntity.notFound().build();
            }

            boolean mergedLatest = applyConcurrentScoreMerge(latest, incoming);
            if (!mergedLatest) {
                return buildConflictResponse(latest, conflictMessage);
            }

            try {
                Tournament savedLatest = tournamentRepository.save(latest);
                persistTournamentState(savedLatest);
                syncNormalizedReadModels(savedLatest, "SYSTEM");
                return ResponseEntity.ok(savedLatest);
            } catch (OptimisticLockingFailureException ignored) {
                Tournament newest = findTournamentByIdHydrated(id).orElse(latest);
                return buildConflictResponse(newest, "Xung đột cập nhật liên tiếp. Vui lòng tải lại và thử lại.");
            }
        }
    }

    private boolean applyConcurrentScoreMerge(Tournament current, Tournament incoming) {
        List<Object> mergedScores = mergeScoresPreferProgress(current.getScores(), incoming.getScores());
        List<Object> mergedKnockout = mergeKnockoutPreferProgress(current.getKnockoutMatches(), incoming.getKnockoutMatches());

        boolean scoresChanged = !Objects.equals(mergedScores, current.getScores());
        boolean knockoutChanged = !Objects.equals(mergedKnockout, current.getKnockoutMatches());

        if (!scoresChanged && !knockoutChanged) {
            return false;
        }

        if (scoresChanged) {
            current.setScores(mergedScores);
        }

        if (knockoutChanged) {
            current.setKnockoutMatches(mergedKnockout);
        }

        return true;
    }

    private List<Object> mergeScoresPreferProgress(List<Object> currentScores, List<Object> incomingScores) {
        List<Object> merged = currentScores == null ? new ArrayList<>() : new ArrayList<>(currentScores);
        if (incomingScores == null || incomingScores.isEmpty()) {
            return merged;
        }

        Map<String, Integer> indexByKey = new LinkedHashMap<>();
        for (int i = 0; i < merged.size(); i += 1) {
            Map<String, Object> existing = toObjectMap(merged.get(i));
            indexByKey.put(scoreKey(existing), i);
        }

        for (Object incomingObj : incomingScores) {
            Map<String, Object> incoming = toObjectMap(incomingObj);
            String key = scoreKey(incoming);
            Integer existingIndex = indexByKey.get(key);

            if (existingIndex == null) {
                merged.add(incomingObj);
                indexByKey.put(key, merged.size() - 1);
                continue;
            }

            Map<String, Object> existing = toObjectMap(merged.get(existingIndex));
            if (progressScore(incoming) > progressScore(existing)) {
                merged.set(existingIndex, incomingObj);
            }
        }

        return merged;
    }

    private List<Object> mergeKnockoutPreferProgress(List<Object> currentMatches, List<Object> incomingMatches) {
        List<Object> merged = currentMatches == null ? new ArrayList<>() : new ArrayList<>(currentMatches);
        if (incomingMatches == null || incomingMatches.isEmpty()) {
            return merged;
        }

        Map<String, Integer> indexByKey = new LinkedHashMap<>();
        for (int i = 0; i < merged.size(); i += 1) {
            Map<String, Object> existing = toObjectMap(merged.get(i));
            indexByKey.put(knockoutKey(existing), i);
        }

        for (Object incomingObj : incomingMatches) {
            Map<String, Object> incoming = toObjectMap(incomingObj);
            String key = knockoutKey(incoming);
            Integer existingIndex = indexByKey.get(key);

            if (existingIndex == null) {
                merged.add(incomingObj);
                indexByKey.put(key, merged.size() - 1);
                continue;
            }

            Map<String, Object> existing = toObjectMap(merged.get(existingIndex));
            if (progressKnockout(incoming) > progressKnockout(existing)) {
                merged.set(existingIndex, incomingObj);
            }
        }

        return merged;
    }

    private List<Object> computeStandingsFromScores(List<Object> groups, List<Object> scores) {
        List<Object> standings = new ArrayList<>();
        if (groups == null || groups.isEmpty()) {
            return standings;
        }

        List<Object> safeScores = scores == null ? List.of() : scores;

        for (Object groupObj : groups) {
            Map<String, Object> group = toObjectMap(groupObj);
            String groupName = asString(group.get("groupName"));
            List<Map<String, Object>> competitors = toObjectMapList(group.get("competitors"));

            Map<String, Map<String, Object>> rowByCompetitor = new LinkedHashMap<>();
            for (Map<String, Object> competitor : competitors) {
                String competitorId = asString(competitor.get("id"));
                Map<String, Object> row = new LinkedHashMap<>();
                row.put("competitor", competitor);
                row.put("played", 0);
                row.put("won", 0);
                row.put("lost", 0);
                row.put("pointsFor", 0);
                row.put("pointsAgainst", 0);
                row.put("matchPoints", 0);
                row.put("setsFor", 0);
                row.put("setsAgainst", 0);
                rowByCompetitor.put(competitorId, row);
            }

            List<Map<String, Object>> groupScores = new ArrayList<>();
            for (Object scoreObj : safeScores) {
                Map<String, Object> score = toObjectMap(scoreObj);
                if (!groupName.equals(asString(score.get("groupName")))) {
                    continue;
                }
                if (!isScoreCompletedForStanding(score)) {
                    continue;
                }
                groupScores.add(score);

                String homeId = asString(score.get("homeCompetitorId"));
                String awayId = asString(score.get("awayCompetitorId"));
                int homeScore = asInt(score.get("homeScore"));
                int awayScore = asInt(score.get("awayScore"));

                Map<String, Object> homeRow = rowByCompetitor.get(homeId);
                Map<String, Object> awayRow = rowByCompetitor.get(awayId);
                if (homeRow == null || awayRow == null) {
                    continue;
                }

                inc(homeRow, "played", 1);
                inc(awayRow, "played", 1);
                inc(homeRow, "pointsFor", homeScore);
                inc(homeRow, "pointsAgainst", awayScore);
                inc(awayRow, "pointsFor", awayScore);
                inc(awayRow, "pointsAgainst", homeScore);

                List<Map<String, Object>> subMatches = toObjectMapList(score.get("subMatches"));
                if (!subMatches.isEmpty()) {
                    for (Map<String, Object> sub : subMatches) {
                        int subHome = asInt(sub.get("homeScore"));
                        int subAway = asInt(sub.get("awayScore"));
                        inc(homeRow, "setsFor", subHome);
                        inc(homeRow, "setsAgainst", subAway);
                        inc(awayRow, "setsFor", subAway);
                        inc(awayRow, "setsAgainst", subHome);
                    }
                } else {
                    inc(homeRow, "setsFor", homeScore);
                    inc(homeRow, "setsAgainst", awayScore);
                    inc(awayRow, "setsFor", awayScore);
                    inc(awayRow, "setsAgainst", homeScore);
                }

                boolean isWalkover = asBoolean(score.get("isWalkover"));
                if (isWalkover) {
                    String walkoverWinnerId = asString(score.get("walkoverWinnerId"));
                    boolean homeWon = homeId.equals(walkoverWinnerId);
                    if (homeWon) {
                        inc(homeRow, "won", 1);
                        inc(awayRow, "lost", 1);
                        inc(homeRow, "matchPoints", 2);
                        inc(awayRow, "matchPoints", 0);
                    } else {
                        inc(awayRow, "won", 1);
                        inc(homeRow, "lost", 1);
                        inc(awayRow, "matchPoints", 2);
                        inc(homeRow, "matchPoints", 0);
                    }
                } else {
                    if (homeScore > awayScore) {
                        inc(homeRow, "won", 1);
                        inc(awayRow, "lost", 1);
                        inc(homeRow, "matchPoints", 2);
                        inc(awayRow, "matchPoints", 1);
                    } else {
                        inc(awayRow, "won", 1);
                        inc(homeRow, "lost", 1);
                        inc(awayRow, "matchPoints", 2);
                        inc(homeRow, "matchPoints", 1);
                    }
                }
            }

            List<Map<String, Object>> rows = new ArrayList<>(rowByCompetitor.values());
            rows.sort((left, right) -> compareStandingRows(left, right, groupScores, rows));
            for (int i = 0; i < rows.size(); i += 1) {
                rows.get(i).put("rank", i + 1);
            }

            Map<String, Object> standing = new LinkedHashMap<>();
            standing.put("groupName", groupName);
            standing.put("rows", rows);
            standings.add(standing);
        }

        return standings;
    }

    private static class ControllerTiedStats {
        int subMatchesDiff = 0;
        int setsDiff = 0;
        int pointsDiff = 0;
    }

    private ControllerTiedStats computeControllerTiedStats(String competitorId, List<Map<String, Object>> scores) {
        ControllerTiedStats stats = new ControllerTiedStats();
        for (Map<String, Object> score : scores) {
            String homeId = asString(score.get("homeCompetitorId"));
            String awayId = asString(score.get("awayCompetitorId"));
            boolean isHome = homeId.equals(competitorId);
            boolean isAway = awayId.equals(competitorId);
            if (!isHome && !isAway) continue;

            int homeScore = asInt(score.get("homeScore"));
            int awayScore = asInt(score.get("awayScore"));

            stats.subMatchesDiff += isHome ? (homeScore - awayScore) : (awayScore - homeScore);

            List<Map<String, Object>> subMatches = toObjectMapList(score.get("subMatches"));
            if (!subMatches.isEmpty()) {
                for (Map<String, Object> sub : subMatches) {
                    int subHome = asInt(sub.get("homeScore"));
                    int subAway = asInt(sub.get("awayScore"));
                    stats.setsDiff += isHome ? (subHome - subAway) : (subAway - subHome);

                    List<Map<String, Object>> setScores = toObjectMapList(sub.get("setScores"));
                    if (!setScores.isEmpty()) {
                        for (Map<String, Object> set : setScores) {
                            int setHome = asInt(set.get("home"));
                            int setAway = asInt(set.get("away"));
                            stats.pointsDiff += isHome ? (setHome - setAway) : (setAway - setHome);
                        }
                    }
                }
            } else {
                stats.setsDiff += isHome ? (homeScore - awayScore) : (awayScore - homeScore);

                List<Map<String, Object>> setScores = toObjectMapList(score.get("setScores"));
                if (!setScores.isEmpty()) {
                    for (Map<String, Object> set : setScores) {
                        int setHome = asInt(set.get("home"));
                        int setAway = asInt(set.get("away"));
                        stats.pointsDiff += isHome ? (setHome - setAway) : (setAway - setHome);
                    }
                }
            }
        }
        return stats;
    }

    private int compareStandingRows(Map<String, Object> left, Map<String, Object> right, List<Map<String, Object>> groupScores, List<Map<String, Object>> allRows) {
        int leftMatchPoints = asInt(left.get("matchPoints"));
        int rightMatchPoints = asInt(right.get("matchPoints"));
        if (rightMatchPoints != leftMatchPoints) {
            return rightMatchPoints - leftMatchPoints;
        }

        List<String> tiedIds = new ArrayList<>();
        for (Map<String, Object> row : allRows) {
            if (asInt(row.get("matchPoints")) == leftMatchPoints) {
                tiedIds.add(asString(toObjectMap(row.get("competitor")).get("id")));
            }
        }

        if (tiedIds.size() >= 2) {
            List<Map<String, Object>> tiedScores = new ArrayList<>();
            for (Map<String, Object> score : groupScores) {
                String homeId = asString(score.get("homeCompetitorId"));
                String awayId = asString(score.get("awayCompetitorId"));
                if (tiedIds.contains(homeId) && tiedIds.contains(awayId)) {
                    tiedScores.add(score);
                }
            }

            String leftId = asString(toObjectMap(left.get("competitor")).get("id"));
            String rightId = asString(toObjectMap(right.get("competitor")).get("id"));

            ControllerTiedStats leftStats = computeControllerTiedStats(leftId, tiedScores);
            ControllerTiedStats rightStats = computeControllerTiedStats(rightId, tiedScores);

            if (rightStats.subMatchesDiff != leftStats.subMatchesDiff) {
                return rightStats.subMatchesDiff - leftStats.subMatchesDiff;
            }

            if (rightStats.setsDiff != leftStats.setsDiff) {
                return rightStats.setsDiff - leftStats.setsDiff;
            }

            if (rightStats.pointsDiff != leftStats.pointsDiff) {
                return rightStats.pointsDiff - leftStats.pointsDiff;
            }
        }

        Object leftLot = left.get("tieBreakLot");
        Object rightLot = right.get("tieBreakLot");
        if (leftLot != null && rightLot != null) {
            int lotDiff = asInt(leftLot) - asInt(rightLot);
            if (lotDiff != 0) return lotDiff;
        }

        String leftName = asString(toObjectMap(left.get("competitor")).get("name"));
        String rightName = asString(toObjectMap(right.get("competitor")).get("name"));
        return leftName.compareToIgnoreCase(rightName);
    }

    private boolean isScoreCompletedForStanding(Map<String, Object> score) {
        List<Map<String, Object>> subMatches = toObjectMapList(score.get("subMatches"));
        if (!subMatches.isEmpty()) {
            return asBoolean(score.get("completed")) || asInt(score.get("homeScore")) >= 3 || asInt(score.get("awayScore")) >= 3;
        }

        return asBoolean(score.get("completed")) || asInt(score.get("homeScore")) > 0 || asInt(score.get("awayScore")) > 0;
    }

    private int progressScore(Map<String, Object> match) {
        int score = 0;
        if (asBoolean(match.get("completed"))) {
            score += 100;
        }

        score += Math.abs(asInt(match.get("homeScore"))) + Math.abs(asInt(match.get("awayScore")));
        if (!toObjectMapList(match.get("setScores")).isEmpty()) {
            score += 20;
        }

        List<Map<String, Object>> subMatches = toObjectMapList(match.get("subMatches"));
        if (!subMatches.isEmpty()) {
            score += 30;
            for (Map<String, Object> sub : subMatches) {
                if (asBoolean(sub.get("completed"))) {
                    score += 10;
                }
                score += Math.abs(asInt(sub.get("homeScore"))) + Math.abs(asInt(sub.get("awayScore")));
            }
        }

        if (!toObjectMap(match.get("lineup")).isEmpty()) {
            score += 5;
        }

        return score;
    }

    private int progressKnockout(Map<String, Object> match) {
        int score = 0;
        if (asBoolean(match.get("completed"))) {
            score += 100;
        }
        if (!asString(match.get("winnerId")).isEmpty()) {
            score += 50;
        }
        score += Math.abs(asInt(match.get("homeScore"))) + Math.abs(asInt(match.get("awayScore")));
        if (!toObjectMapList(match.get("setScores")).isEmpty()) {
            score += 20;
        }
        return score;
    }

    private String scoreKey(Map<String, Object> match) {
        return asString(match.get("groupName")) + "|"
                + asString(match.get("homeCompetitorId")) + "|"
                + asString(match.get("awayCompetitorId"));
    }

    private String knockoutKey(Map<String, Object> match) {
        String id = asString(match.get("id"));
        if (!id.isEmpty()) {
            return id;
        }

        return asString(match.get("roundName")) + "|"
                + asString(match.get("homeCompetitorId")) + "|"
                + asString(match.get("awayCompetitorId"));
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> toObjectMap(Object value) {
        if (value instanceof Map<?, ?> map) {
            return (Map<String, Object>) map;
        }
        return new LinkedHashMap<>();
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> toObjectMapList(Object value) {
        if (!(value instanceof List<?> list)) {
            return new ArrayList<>();
        }

        List<Map<String, Object>> converted = new ArrayList<>();
        for (Object item : list) {
            if (item instanceof Map<?, ?> map) {
                converted.add((Map<String, Object>) map);
            }
        }
        return converted;
    }

    private String asString(Object value) {
        return value == null ? "" : String.valueOf(value);
    }

    private boolean asBoolean(Object value) {
        if (value instanceof Boolean boolValue) {
            return boolValue;
        }
        if (value == null) {
            return false;
        }
        return "true".equalsIgnoreCase(String.valueOf(value));
    }

    private int asInt(Object value) {
        if (value instanceof Number numberValue) {
            return numberValue.intValue();
        }
        if (value == null) {
            return 0;
        }
        try {
            return Integer.parseInt(String.valueOf(value));
        } catch (NumberFormatException ex) {
            return 0;
        }
    }

    private void inc(Map<String, Object> row, String key, int delta) {
        row.put(key, asInt(row.get(key)) + delta);
    }

    static class GroupMatchUpdateRequest {
        public String groupName;
        public String homeCompetitorId;
        public String awayCompetitorId;
        public Integer homeScore;
        public Integer awayScore;
        public List<SetScorePayload> setScores;
        public String recordedById;
        public String requestId;
        public Long expectedMetadataVersion;
        public Long expectedCompetitionVersion;
        public Long expectedTournamentVersion;
    }

    static class TeamSubMatchUpdateRequest {
        public Boolean knockout;
        public String matchId;
        public Integer subMatchIdx;
        public Integer homeScore;
        public Integer awayScore;
        public List<SetScorePayload> setScores;
        public String recordedById;
        public String requestId;
        public Long expectedMetadataVersion;
        public Long expectedCompetitionVersion;
        public Long expectedTournamentVersion;
    }

    static class TeamLineupUpdateRequest {
        public Boolean knockout;
        public String matchId;
        public TeamLineupPayload lineup;
        public List<SubMatchPayload> subMatches;
        public String recordedById;
        public String requestId;
        public Long expectedMetadataVersion;
        public Long expectedCompetitionVersion;
        public Long expectedTournamentVersion;
    }

    static class TeamLineupPayload {
        public String aPlayerId;
        public String bPlayerId;
        public String cPlayerId;
        public String xPlayerId;
        public String yPlayerId;
        public String zPlayerId;
        public Boolean isHomeABC;
    }

    static class SubMatchPayload {
        public String matchType;
        public String label;
        public List<String> homePlayers;
        public List<String> awayPlayers;
        public Integer homeScore;
        public Integer awayScore;
        public Boolean completed;
        public String handicapText;
        public List<SetScorePayload> setScores;
    }

    static class ParticipantWithdrawRequest {
        public String memberId;
        public String recordedById;
        public String requestId;
        public Long expectedMetadataVersion;
        public Long expectedCompetitionVersion;
        public Long expectedTournamentVersion;
    }

    static class TeamMovePlayerRequest {
        public String fromTeamId;
        public String toTeamId;
        public String playerId;
        public String recordedById;
        public String requestId;
        public Long expectedMetadataVersion;
        public Long expectedCompetitionVersion;
        public Long expectedTournamentVersion;
    }

    static class GroupMoveCompetitorRequest {
        public String fromGroupName;
        public String toGroupName;
        public String competitorId;
        public String recordedById;
        public String requestId;
        public Long expectedMetadataVersion;
        public Long expectedCompetitionVersion;
        public Long expectedTournamentVersion;
    }

    static class GroupScheduleRebuildRequest {
        public String recordedById;
        public String requestId;
        public Long expectedMetadataVersion;
        public Long expectedCompetitionVersion;
        public Long expectedTournamentVersion;
    }

    static class TeamRebalanceRequest {
        public String recordedById;
        public String requestId;
        public Long expectedMetadataVersion;
        public Long expectedCompetitionVersion;
        public Long expectedTournamentVersion;
    }

    static class KnockoutStartRequest {
        public String recordedById;
        public String requestId;
        public Long expectedMetadataVersion;
        public Long expectedCompetitionVersion;
        public Long expectedTournamentVersion;
    }

    static class TournamentFinishRequest {
        public String recordedById;
        public String requestId;
        public Long expectedMetadataVersion;
        public Long expectedCompetitionVersion;
        public Long expectedTournamentVersion;
    }

    static class KnockoutMatchUpdateRequest {
        public String matchId;
        public Integer homeScore;
        public Integer awayScore;
        public List<SetScorePayload> setScores;
        public String recordedById;
        public String requestId;
        public Long expectedMetadataVersion;
        public Long expectedCompetitionVersion;
        public Long expectedTournamentVersion;
    }

    static class SetScorePayload {
        public Integer home;
        public Integer away;
    }

    static class GroupMatchClearRequest {
        public String groupName;
        public String homeCompetitorId;
        public String awayCompetitorId;
        public String recordedById;
        public String requestId;
        public Long expectedMetadataVersion;
        public Long expectedCompetitionVersion;
        public Long expectedTournamentVersion;
    }

    static class TeamSubMatchClearRequest {
        public Boolean knockout;
        public String matchId;
        public Integer subMatchIdx;
        public String recordedById;
        public String requestId;
        public Long expectedMetadataVersion;
        public Long expectedCompetitionVersion;
        public Long expectedTournamentVersion;
    }

    static class KnockoutMatchClearRequest {
        public String matchId;
        public String recordedById;
        public String requestId;
        public Long expectedMetadataVersion;
        public Long expectedCompetitionVersion;
        public Long expectedTournamentVersion;
    }

    static class RegistrationImportItem {
        public String memberId;
        public Integer seed;
    }

    static class SeedOverrideRequest {
        public Integer newSeed;
        public String reason;
        public String actorId;
        public Long expectedRegistrationVersion;
    }

    static class SeededPotRangePayload {
        public Integer min;
        public Integer max;
        public String label;
    }

    static class DrawRulesPayload {
        public Boolean useSeededDraw;
        public Boolean lockRankDuringTournament;
        public Integer maxFemalePerTeam;
        public Integer teamSize;
        public List<SeededPotRangePayload> seededPotRanges;
    }

    static class DrawSimulateRequest {
        public DrawRulesPayload rules;
        public Integer topN;
    }

    static class DrawCommitRequest {
        public String candidateId;
        public String reason;
        public String actorId;
        public DrawRulesPayload rules;
        public Long expectedCompetitionVersion;
        public String requestId;
    }

    static class DrawRebuildRequest {
        public String reason;
        public String actorId;
        public Boolean allowIfCompletedMatches;
        public String requestId;
    }

    static class AssessSeedImpactRequest {
        public String memberId;
        public Integer newSeed;
    }
}


