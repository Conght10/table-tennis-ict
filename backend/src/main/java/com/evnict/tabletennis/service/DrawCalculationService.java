package com.evnict.tabletennis.service;

import org.springframework.stereotype.Service;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class DrawCalculationService {

    private static final int WIN_POINTS = 3;
    private static final int LOSS_POINTS = 0;

    public static class Competitor {
        public String id;
        public String name;

        public Competitor() {}
        public Competitor(String id, String name) {
            this.id = id;
            this.name = name;
        }
    }

    public static class SeededCompetitor extends Competitor {
        public Integer seed;
        public String gender;

        public SeededCompetitor() {}
        public SeededCompetitor(String id, String name, Integer seed, String gender) {
            super(id, name);
            this.seed = seed;
            this.gender = gender;
        }
    }

    public static class PotRange {
        public Integer min;
        public Integer max;

        public PotRange() {}
        public PotRange(Integer min, Integer max) {
            this.min = min;
            this.max = max;
        }
    }

    public static class Team {
        public String id;
        public String name;
        public List<Competitor> players;

        public Team() {
            this.players = new ArrayList<>();
        }
    }

    public static class GroupAssignment {
        public String groupName;
        public List<Competitor> competitors;

        public GroupAssignment() {
            this.competitors = new ArrayList<>();
        }
        public GroupAssignment(String groupName, List<Competitor> competitors) {
            this.groupName = groupName;
            this.competitors = competitors;
        }
    }

    public static class GroupMatchScore {
        public String groupName;
        public String homeCompetitorId;
        public String awayCompetitorId;
        public int homeScore;
        public int awayScore;
        public boolean completed;
        public List<Map<String, Object>> subMatches;
    }

    public static class GroupStandingRow {
        public Competitor competitor;
        public int played;
        public int won;
        public int lost;
        public int pointsFor;
        public int pointsAgainst;
        public int matchPoints;
        public int setsFor;
        public int setsAgainst;
        public int rank;
    }

    public static class GroupStanding {
        public String groupName;
        public List<GroupStandingRow> rows;
    }

    public List<Team> generateRandomTeams(List<Competitor> players, int teamSize) {
        int effectiveTeamSize = Math.max(teamSize, 1);
        List<Competitor> shuffled = new ArrayList<>(players);
        Collections.shuffle(shuffled);
        List<Team> teams = new ArrayList<>();

        for (int i = 0; i < shuffled.size(); i += effectiveTeamSize) {
            int end = Math.min(i + effectiveTeamSize, shuffled.size());
            List<Competitor> members = shuffled.subList(i, end);
            if (members.isEmpty()) continue;

            Team team = new Team();
            team.id = "team-" + (teams.size() + 1);
            team.name = "Đội " + (teams.size() + 1);
            team.players = members.stream()
                .map(p -> new Competitor(p.id, p.name))
                .collect(Collectors.toList());
            teams.add(team);
        }
        return teams;
    }

    public List<Team> generateTeamsBySeedPots(
            List<SeededCompetitor> players,
            int teamSize,
            List<PotRange> potRanges,
            int maxFemalePerTeam
    ) {
        if (teamSize != 3 || potRanges.size() != 3) {
            return null;
        }

        List<List<SeededCompetitor>> pots = new ArrayList<>();
        for (PotRange range : potRanges) {
            List<SeededCompetitor> pot = players.stream()
                .filter(p -> p.seed != null && p.seed >= range.min && p.seed <= range.max)
                .sorted(Comparator.comparingInt(p -> p.seed))
                .collect(Collectors.toList());
            pots.add(pot);
        }

        int teamCount = pots.get(0).size();
        for (List<SeededCompetitor> pot : pots) {
            if (pot.size() != teamCount || teamCount == 0) {
                return null;
            }
        }

        List<List<SeededCompetitor>> bestTeams = null;
        double bestScore = Double.POSITIVE_INFINITY;

        List<SeededCompetitor> pot0 = new ArrayList<>(pots.get(0));
        List<List<SeededCompetitor>> pot1Variants = List.of(new ArrayList<>(pots.get(1)), reverseList(pots.get(1)));
        List<List<SeededCompetitor>> pot2Variants = List.of(new ArrayList<>(pots.get(2)), reverseList(pots.get(2)));

        for (List<SeededCompetitor> p1 : pot1Variants) {
            for (List<SeededCompetitor> p2 : pot2Variants) {
                for (int middleShift = 0; middleShift < teamCount; middleShift++) {
                    for (int weakShift = 0; weakShift < teamCount; weakShift++) {
                        List<List<SeededCompetitor>> candidateTeams = new ArrayList<>();
                        for (int i = 0; i < teamCount; i++) {
                            List<SeededCompetitor> teamPlayers = new ArrayList<>();
                            teamPlayers.add(pot0.get(i));
                            teamPlayers.add(p1.get((i + middleShift) % teamCount));
                            teamPlayers.add(p2.get((i + weakShift) % teamCount));
                            candidateTeams.add(teamPlayers);
                        }

                        double score = evaluateSeededTeams(candidateTeams, maxFemalePerTeam);
                        if (score < bestScore) {
                            bestScore = score;
                            bestTeams = candidateTeams;
                        }
                    }
                }
            }
        }

        if (bestTeams == null) {
            return null;
        }

        List<Team> teams = new ArrayList<>();
        for (int i = 0; i < bestTeams.size(); i++) {
            Team team = new Team();
            team.id = "team-" + (i + 1);
            team.name = "Đội " + (i + 1);
            team.players = bestTeams.get(i).stream()
                .map(p -> new Competitor(p.id, p.name))
                .collect(Collectors.toList());
            teams.add(team);
        }
        return teams;
    }

    public List<Team> generateTeamsWithCaptains(
            List<Competitor> players,
            int teamSize,
            List<String> designatedCaptains,
            Map<String, Integer> memberEloMap
    ) {
        int effectiveTeamSize = Math.max(teamSize, 1);
        int numTeams = players.size() / effectiveTeamSize;
        if (numTeams <= 0) return new ArrayList<>();

        List<Competitor> captainsList = new ArrayList<>();
        List<Competitor> regularPlayers = new ArrayList<>();

        for (Competitor p : players) {
            if (designatedCaptains.contains(p.id)) {
                captainsList.add(p);
            } else {
                regularPlayers.add(p);
            }
        }

        List<Competitor> shuffledRegular = new ArrayList<>(regularPlayers);
        Collections.shuffle(shuffledRegular);
        shuffledRegular.sort((a, b) -> memberEloMap.getOrDefault(b.id, 1500) - memberEloMap.getOrDefault(a.id, 1500));

        while (captainsList.size() < numTeams && !shuffledRegular.isEmpty()) {
            Competitor additionalCaptain = shuffledRegular.remove(0);
            captainsList.add(additionalCaptain);
            regularPlayers.removeIf(x -> x.id.equals(additionalCaptain.id));
        }

        while (captainsList.size() > numTeams) {
            Competitor excessCaptain = captainsList.remove(captainsList.size() - 1);
            regularPlayers.add(excessCaptain);
        }

        List<Team> teams = new ArrayList<>();
        for (int i = 0; i < captainsList.size(); i++) {
            Team team = new Team();
            team.id = "team-" + (i + 1);
            team.name = "Đội " + captainsList.get(i).name;
            team.players = new ArrayList<>();
            team.players.add(captainsList.get(i));
            teams.add(team);
        }

        List<Competitor> shuffledRemaining = new ArrayList<>(regularPlayers);
        Collections.shuffle(shuffledRemaining);
        shuffledRemaining.sort((a, b) -> memberEloMap.getOrDefault(b.id, 1500) - memberEloMap.getOrDefault(a.id, 1500));

        int direction = 1;
        int teamIdx = 0;

        for (Competitor player : shuffledRemaining) {
            boolean assigned = false;
            int searchCount = 0;
            while (!assigned && searchCount < numTeams) {
                Team currentTeam = teams.get(teamIdx);
                if (currentTeam.players.size() < effectiveTeamSize) {
                    currentTeam.players.add(player);
                    assigned = true;
                }

                teamIdx += direction;
                if (teamIdx >= numTeams) {
                    teamIdx = numTeams - 1;
                    direction = -1;
                } else if (teamIdx < 0) {
                    teamIdx = 0;
                    direction = 1;
                }
                searchCount++;
            }

            if (!assigned) {
                Optional<Team> nonFull = teams.stream().filter(t -> t.players.size() < effectiveTeamSize).findFirst();
                if (nonFull.isPresent()) {
                    nonFull.get().players.add(player);
                } else {
                    teams.get(0).players.add(player);
                }
            }
        }

        return teams;
    }

    public List<GroupAssignment> generateRandomGroups(List<Competitor> competitors, int groupSize) {
        int effectiveGroupSize = Math.max(groupSize, 2);
        List<Competitor> shuffled = new ArrayList<>(competitors);
        Collections.shuffle(shuffled);
        List<GroupAssignment> groups = new ArrayList<>();
        int groupIndex = 0;

        for (int i = 0; i < shuffled.size(); i += effectiveGroupSize) {
            int end = Math.min(i + effectiveGroupSize, shuffled.size());
            String groupName = String.valueOf((char) (65 + groupIndex));
            groups.add(new GroupAssignment(groupName, new ArrayList<>(shuffled.subList(i, end))));
            groupIndex++;
        }
        return groups;
    }

    public List<GroupMatchScore> buildRoundRobinScores(GroupAssignment group) {
        List<GroupMatchScore> scores = new ArrayList<>();
        for (int i = 0; i < group.competitors.size(); i++) {
            for (int j = i + 1; j < group.competitors.size(); j++) {
                GroupMatchScore match = new GroupMatchScore();
                match.groupName = group.groupName;
                match.homeCompetitorId = group.competitors.get(i).id;
                match.awayCompetitorId = group.competitors.get(j).id;
                match.homeScore = 0;
                match.awayScore = 0;
                match.completed = false;
                scores.add(match);
            }
        }
        return scores;
    }

    public List<GroupStanding> computeGroupStandings(List<GroupAssignment> groups, List<GroupMatchScore> scores) {
        List<GroupStanding> standings = new ArrayList<>();
        for (GroupAssignment group : groups) {
            Map<String, GroupStandingRow> standingMap = new HashMap<>();

            for (Competitor competitor : group.competitors) {
                GroupStandingRow row = new GroupStandingRow();
                row.competitor = competitor;
                standingMap.put(competitor.id, row);
            }

            List<GroupMatchScore> groupScores = scores.stream()
                .filter(score -> score.groupName.equals(group.groupName))
                .filter(score -> {
                    if (score.subMatches != null && !score.subMatches.isEmpty()) {
                        return score.completed || score.homeScore >= 3 || score.awayScore >= 3;
                    }
                    return score.completed || score.homeScore > 0 || score.awayScore > 0;
                })
                .collect(Collectors.toList());

            for (GroupMatchScore score : groupScores) {
                GroupStandingRow home = standingMap.get(score.homeCompetitorId);
                GroupStandingRow away = standingMap.get(score.awayCompetitorId);

                if (home == null || away == null) continue;

                home.played += 1;
                away.played += 1;

                home.pointsFor += score.homeScore;
                home.pointsAgainst += score.awayScore;
                away.pointsFor += score.awayScore;
                away.pointsAgainst += score.homeScore;

                if (score.subMatches != null && !score.subMatches.isEmpty()) {
                    for (Map<String, Object> sub : score.subMatches) {
                        int hScore = sub.get("homeScore") != null ? ((Number) sub.get("homeScore")).intValue() : 0;
                        int aScore = sub.get("awayScore") != null ? ((Number) sub.get("awayScore")).intValue() : 0;
                        home.setsFor += hScore;
                        home.setsAgainst += aScore;
                        away.setsFor += aScore;
                        away.setsAgainst += hScore;
                    }
                } else {
                    home.setsFor += score.homeScore;
                    home.setsAgainst += score.awayScore;
                    away.setsFor += score.awayScore;
                    away.setsAgainst += score.homeScore;
                }

                if (score.homeScore > score.awayScore) {
                    home.won += 1;
                    away.lost += 1;
                    home.matchPoints += WIN_POINTS;
                    away.matchPoints += LOSS_POINTS;
                } else {
                    away.won += 1;
                    home.lost += 1;
                    away.matchPoints += WIN_POINTS;
                    home.matchPoints += LOSS_POINTS;
                }
            }

            List<GroupStandingRow> rows = new ArrayList<>(standingMap.values());
            rows.sort((left, right) -> sortStandingRows(left, right, groupScores));

            for (int i = 0; i < rows.size(); i++) {
                rows.get(i).rank = i + 1;
            }

            GroupStanding standing = new GroupStanding();
            standing.groupName = group.groupName;
            standing.rows = rows;
            standings.add(standing);
        }
        return standings;
    }

    private int sortStandingRows(GroupStandingRow left, GroupStandingRow right, List<GroupMatchScore> groupScores) {
        if (right.matchPoints != left.matchPoints) {
            return right.matchPoints - left.matchPoints;
        }

        int leftDiff = left.pointsFor - left.pointsAgainst;
        int rightDiff = right.pointsFor - right.pointsAgainst;
        if (rightDiff != leftDiff) {
            return rightDiff - leftDiff;
        }

        int leftSetsDiff = left.setsFor - left.setsAgainst;
        int rightSetsDiff = right.setsFor - right.setsAgainst;
        if (rightSetsDiff != leftSetsDiff) {
            return rightSetsDiff - leftSetsDiff;
        }

        int headToHead = headToHead(left.competitor.id, right.competitor.id, groupScores);
        if (headToHead != 0) {
            return headToHead;
        }

        return left.competitor.name.compareTo(right.competitor.name);
    }

    private int headToHead(String leftId, String rightId, List<GroupMatchScore> groupScores) {
        Optional<GroupMatchScore> matchOpt = groupScores.stream()
            .filter(score -> (score.homeCompetitorId.equals(leftId) && score.awayCompetitorId.equals(rightId)) ||
                             (score.homeCompetitorId.equals(rightId) && score.awayCompetitorId.equals(leftId)))
            .findFirst();

        if (matchOpt.isEmpty()) return 0;

        GroupMatchScore match = matchOpt.get();
        boolean leftWon = (match.homeCompetitorId.equals(leftId) && match.homeScore > match.awayScore) ||
                          (match.awayCompetitorId.equals(leftId) && match.awayScore > match.homeScore);

        return leftWon ? -1 : 1;
    }

    private double evaluateSeededTeams(List<List<SeededCompetitor>> teams, int maxFemalePerTeam) {
        List<Integer> totals = new ArrayList<>();
        int femaleViolation = 0;

        for (List<SeededCompetitor> team : teams) {
            int sum = 0;
            int femaleCount = 0;
            for (SeededCompetitor player : team) {
                sum += player.seed;
                if (isFemale(player.gender)) {
                    femaleCount++;
                }
            }
            totals.add(sum);
            if (femaleCount > maxFemalePerTeam) {
                femaleViolation += (femaleCount - maxFemalePerTeam);
            }
        }

        int maxTotal = Collections.max(totals);
        int minTotal = Collections.min(totals);
        double mean = totals.stream().mapToInt(Integer::intValue).average().orElse(0.0);
        double variance = totals.stream().mapToDouble(total -> Math.pow(total - mean, 2)).average().orElse(0.0);

        return femaleViolation * 1000000.0 + (maxTotal - minTotal) * 1000.0 + variance;
    }

    private boolean isFemale(String gender) {
        if (gender == null) return false;
        String g = gender.trim().toLowerCase();
        return "nu".equals(g) || "nữ".equals(g) || "female".equals(g);
    }

    public static class DrawCandidate {
        public String candidateId;
        public double score;
        public int seedSpread;
        public double variance;
        public int femaleViolations;
        public List<Team> teams;
    }

    public List<DrawCandidate> simulateDraw(
            List<SeededCompetitor> players,
            int teamSize,
            List<PotRange> potRanges,
            int maxFemalePerTeam,
            int topN
    ) {
        if (teamSize != 3 || potRanges.size() != 3) {
            return new ArrayList<>();
        }

        List<List<SeededCompetitor>> pots = new ArrayList<>();
        for (PotRange range : potRanges) {
            List<SeededCompetitor> pot = players.stream()
                .filter(p -> p.seed != null && p.seed >= range.min && p.seed <= range.max)
                .sorted(Comparator.comparingInt(p -> p.seed))
                .collect(Collectors.toList());
            pots.add(pot);
        }

        int teamCount = pots.get(0).size();
        for (List<SeededCompetitor> pot : pots) {
            if (pot.size() != teamCount || teamCount == 0) {
                return new ArrayList<>();
            }
        }

        List<DrawCandidate> candidates = new ArrayList<>();

        List<SeededCompetitor> pot0 = new ArrayList<>(pots.get(0));
        List<List<SeededCompetitor>> pot1Variants = List.of(new ArrayList<>(pots.get(1)), reverseList(pots.get(1)));
        List<List<SeededCompetitor>> pot2Variants = List.of(new ArrayList<>(pots.get(2)), reverseList(pots.get(2)));

        int varIdx = 0;
        for (int v1 = 0; v1 < pot1Variants.size(); v1++) {
            List<SeededCompetitor> p1 = pot1Variants.get(v1);
            for (int v2 = 0; v2 < pot2Variants.size(); v2++) {
                List<SeededCompetitor> p2 = pot2Variants.get(v2);
                for (int middleShift = 0; middleShift < teamCount; middleShift++) {
                    for (int weakShift = 0; weakShift < teamCount; weakShift++) {
                        List<List<SeededCompetitor>> candidateTeams = new ArrayList<>();
                        for (int i = 0; i < teamCount; i++) {
                            List<SeededCompetitor> teamPlayers = new ArrayList<>();
                            teamPlayers.add(pot0.get(i));
                            teamPlayers.add(p1.get((i + middleShift) % teamCount));
                            teamPlayers.add(p2.get((i + weakShift) % teamCount));
                            candidateTeams.add(teamPlayers);
                        }

                List<Integer> totals = new ArrayList<>();
                int femaleViolations = 0;
                for (List<SeededCompetitor> team : candidateTeams) {
                    int sum = 0;
                    int femaleCount = 0;
                    for (SeededCompetitor p : team) {
                        sum += p.seed;
                        if (isFemale(p.gender)) {
                            femaleCount++;
                        }
                    }
                    totals.add(sum);
                    if (femaleCount > maxFemalePerTeam) {
                        femaleViolations += (femaleCount - maxFemalePerTeam);
                    }
                }
                int maxTotal = Collections.max(totals);
                int minTotal = Collections.min(totals);
                int seedSpread = maxTotal - minTotal;
                double mean = totals.stream().mapToInt(Integer::intValue).average().orElse(0.0);
                double variance = totals.stream().mapToDouble(total -> Math.pow(total - mean, 2)).average().orElse(0.0);
                double score = femaleViolations * 1000000.0 + seedSpread * 1000.0 + variance;

                DrawCandidate candidate = new DrawCandidate();
                candidate.candidateId = "cand-" + String.format("%02d%02d", middleShift, weakShift);
                candidate.score = score;
                candidate.seedSpread = seedSpread;
                candidate.variance = variance;
                candidate.femaleViolations = femaleViolations;

                List<Team> teams = new ArrayList<>();
                for (int idx = 0; idx < candidateTeams.size(); idx++) {
                    Team team = new Team();
                    team.id = "team-" + (idx + 1);
                    team.name = "Đội " + (idx + 1);
                    team.players = candidateTeams.get(idx).stream()
                        .map(p -> new Competitor(p.id, p.name))
                        .collect(Collectors.toList());
                    teams.add(team);
                }
                candidate.teams = teams;
                candidates.add(candidate);
                    }
                }
            }
        }

        candidates.sort(Comparator.comparingDouble(c -> c.score));
        return candidates.stream().limit(topN).collect(Collectors.toList());
    }

    public List<GroupAssignment> generateBalancedGroups(
            List<Competitor> competitors,
            int groupSize,
            Map<String, Integer> strengthMap
    ) {
        int n = competitors.size();
        if (n <= 1) {
            List<GroupAssignment> single = new ArrayList<>();
            single.add(new GroupAssignment("A", competitors));
            return single;
        }

        int k = (int) Math.ceil((double) n / groupSize);
        if (k <= 1) {
            List<GroupAssignment> single = new ArrayList<>();
            single.add(new GroupAssignment("A", competitors));
            return single;
        }

        int baseSize = n / k;
        int remainder = n % k;
        List<Integer> targetSizes = new ArrayList<>();
        for (int i = 0; i < k; i++) {
            targetSizes.add(i < remainder ? baseSize + 1 : baseSize);
        }

        List<List<Competitor>> bestPartition = new ArrayList<>();
        for (int i = 0; i < k; i++) {
            bestPartition.add(new ArrayList<>());
        }

        final double[] minDiff = { Double.MAX_VALUE };
        List<List<Competitor>> currentPartition = new ArrayList<>();
        for (int i = 0; i < k; i++) {
            currentPartition.add(new ArrayList<>());
        }

        if (n <= 12) {
            searchBestPartition(competitors, 0, currentPartition, targetSizes, strengthMap, minDiff, bestPartition);
        } else {
            List<Competitor> sorted = competitors.stream()
                .sorted((a, b) -> strengthMap.getOrDefault(b.id, 0) - strengthMap.getOrDefault(a.id, 0))
                .collect(Collectors.toList());
            for (int i = 0; i < n; i++) {
                int groupIdx = i % k;
                bestPartition.get(groupIdx).add(sorted.get(i));
            }
        }

        List<GroupAssignment> groups = new ArrayList<>();
        for (int i = 0; i < k; i++) {
            String groupName = String.valueOf((char) (65 + i));
            groups.add(new GroupAssignment(groupName, bestPartition.get(i)));
        }
        return groups;
    }

    private void searchBestPartition(
            List<Competitor> competitors,
            int index,
            List<List<Competitor>> current,
            List<Integer> targetSizes,
            Map<String, Integer> strengthMap,
            double[] minDiff,
            List<List<Competitor>> best
    ) {
        if (index == competitors.size()) {
            double minAvg = Double.MAX_VALUE;
            double maxAvg = Double.MIN_VALUE;
            for (List<Competitor> grp : current) {
                double sum = grp.stream().mapToDouble(c -> strengthMap.getOrDefault(c.id, 0)).sum();
                double avg = grp.isEmpty() ? 0 : sum / grp.size();
                if (avg < minAvg) minAvg = avg;
                if (avg > maxAvg) maxAvg = avg;
            }
            double diff = maxAvg - minAvg;
            if (diff < minDiff[0]) {
                minDiff[0] = diff;
                for (int i = 0; i < current.size(); i++) {
                    best.set(i, new ArrayList<>(current.get(i)));
                }
            }
            return;
        }

        Competitor comp = competitors.get(index);
        for (int i = 0; i < current.size(); i++) {
            if (current.get(i).size() < targetSizes.get(i)) {
                if (current.get(i).isEmpty()) {
                    current.get(i).add(comp);
                    searchBestPartition(competitors, index + 1, current, targetSizes, strengthMap, minDiff, best);
                    current.get(i).remove(current.get(i).size() - 1);
                    break;
                } else {
                    current.get(i).add(comp);
                    searchBestPartition(competitors, index + 1, current, targetSizes, strengthMap, minDiff, best);
                    current.get(i).remove(current.get(i).size() - 1);
                }
            }
        }
    }

    private <T> List<T> reverseList(List<T> list) {
        List<T> copy = new ArrayList<>(list);
        Collections.reverse(copy);
        return copy;
    }
}
