import { Injectable } from '@angular/core';
import {
    Competitor,
    GroupAssignment,
    GroupMatchScore,
    GroupStanding,
    GroupStandingRow,
    Team
} from './evnict.models';

interface MutableStanding<TCompetitor extends Competitor> {
    competitor: TCompetitor;
    played: number;
    won: number;
    lost: number;
    pointsFor: number;
    pointsAgainst: number;
    matchPoints: number;
    setsFor: number;
    setsAgainst: number;
    tieBreakLot?: number;
}

interface SeededCompetitor extends Competitor {
    seed: number;
    gender?: string;
}

@Injectable({
    providedIn: 'root'
})
export class TournamentEngineService {
    private readonly winPoints = 3;
    private readonly lossPoints = 0;
    private lastSelectedCaptainTeamKey = '';

    generateRandomTeams<TPlayer extends Competitor>(players: readonly TPlayer[], teamSize: number): Team[] {
        const effectiveTeamSize = Math.max(teamSize, 1);
        const shuffled = this.shuffle(players);
        const teams: Team[] = [];

        for (let i = 0; i < shuffled.length; i += effectiveTeamSize) {
            const members = shuffled.slice(i, i + effectiveTeamSize);

            if (!members.length) {
                continue;
            }

            teams.push({
                id: `team-${Math.floor(i / effectiveTeamSize) + 1}`,
                name: members[0]?.name ? `Đội ${members[0].name}` : `Đội ${Math.floor(i / effectiveTeamSize) + 1}`,
                players: members.map((player) => ({ id: player.id, name: player.name }))
            });
        }

        return teams;
    }

    generateTeamsBySeedPots(
        players: SeededCompetitor[],
        teamSize: number,
        potRanges: Array<{ min: number; max: number }>,
        maxFemalePerTeam: number
    ): Team[] | null {
        if (teamSize !== 3 || potRanges.length !== 3) {
            return null;
        }

        const sortedPlayers = [...players].sort((a, b) => (a.seed ?? 999999) - (b.seed ?? 999999));

        // Partition into 3 pots by seed range (or equal thirds if ranges don't match)
        let pots = potRanges.map((range) =>
            sortedPlayers.filter((p) => p.seed >= range.min && p.seed <= range.max)
        );
        let N = pots[0]?.length || 0;

        if (!N || pots.some((pot) => pot.length !== N)) {
            N = Math.floor(sortedPlayers.length / 3);
            if (!N) return null;
            pots = [
                sortedPlayers.slice(0, N),
                sortedPlayers.slice(N, N * 2),
                sortedPlayers.slice(N * 2, N * 3)
            ];
        }

        // pot0 = strongest (small seed), pot1 = medium, pot2 = weakest (large seed)
        // pot0 stays sorted ascending (fixed) — team captain/name comes from pot0[i]
        const pot0 = pots[0]; // sorted ascending already
        const pot1 = pots[1]; // sorted ascending
        const pot2 = pots[2]; // sorted ascending

        const isFem = (p: SeededCompetitor) => this.isFemale(p.gender);

        let bestScore = Number.POSITIVE_INFINITY;
        const allCandidates: Array<{ teamGroups: SeededCompetitor[][]; score: number }> = [];

        // Monte Carlo: Run iterations dynamically depending on N
        let ITERATIONS = 50000;
        if (N <= 5) {
            ITERATIONS = 20000;
        } else if (N === 6) {
            ITERATIONS = 100000;
        } else if (N >= 7) {
            ITERATIONS = 200000;
        }
        for (let iter = 0; iter < ITERATIONS; iter++) {
            const p1 = this.shuffle([...pot1]);
            const p2 = this.shuffle([...pot2]);

            // Form candidate teams
            const teamGroups: SeededCompetitor[][] = [];
            let femaleViolation = 0;

            for (let i = 0; i < N; i++) {
                const team = [pot0[i], p1[i], p2[i]];
                
                // Count females
                const femaleCount = team.filter(isFem).length;
                if (femaleCount > maxFemalePerTeam) {
                    femaleViolation += (femaleCount - maxFemalePerTeam);
                }

                teamGroups.push(team);
            }

            // Evaluate seed balance
            const totals = teamGroups.map((team) => team.reduce((sum, player) => sum + (player.seed ?? 0), 0));
            const maxTotal = Math.max(...totals);
            const minTotal = Math.min(...totals);
            const mean = totals.reduce((sum, total) => sum + total, 0) / totals.length;
            const variance = totals.reduce((sum, total) => sum + Math.pow(total - mean, 2), 0) / totals.length;

            const score = femaleViolation * 1000000 + (maxTotal - minTotal) * 1000 + variance;

            if (score < bestScore) {
                bestScore = score;
            }

            allCandidates.push({ teamGroups, score });
        }

        if (allCandidates.length === 0) return null;

        // Accept all candidates within 3 seed-spread of optimal (tolerance for variety)
        // Score formula: femViolation*1M + (maxSpread)*1K + variance
        // 3 seed-spread tolerance = 3000 score points
        const SPREAD_TOLERANCE = 3_000;
        const candidates = allCandidates.filter((c) => c.score <= bestScore + SPREAD_TOLERANCE);

        if (candidates.length === 0) return null;

        // De-duplicate candidate configurations (set of 7 teams) to avoid duplicates
        const uniqueConfigs = new Map<string, typeof candidates[0]>();
        for (const c of candidates) {
            const teamKeys = c.teamGroups.map(team => 
                team.map(p => p.id).sort().join(',')
            ).sort().join('|');
            if (!uniqueConfigs.has(teamKeys)) {
                uniqueConfigs.set(teamKeys, c);
            }
        }
        const uniqueList = Array.from(uniqueConfigs.values());

        // Exclude the last selected team composition for the first captain (pot0[0]) if there are other unique options
        let filteredList = uniqueList;
        if (this.lastSelectedCaptainTeamKey && uniqueList.length > 1) {
            const temp = uniqueList.filter(c => {
                const captainTeam = c.teamGroups[0];
                const key = captainTeam.map(p => p.id).sort().join(',');
                return key !== this.lastSelectedCaptainTeamKey;
            });
            if (temp.length > 0) {
                filteredList = temp;
            }
        }

        // Randomly pick one unique configuration
        const chosen = filteredList[Math.floor(Math.random() * filteredList.length)];
        
        // Save the selected team composition for the next draw
        const chosenCaptainTeam = chosen.teamGroups[0];
        this.lastSelectedCaptainTeamKey = chosenCaptainTeam.map(p => p.id).sort().join(',');

        return pot0.map((p, i) => ({
            id: `team-${i + 1}`,
            name: p.name ? `Đội ${p.name}` : `Đội ${i + 1}`,
            players: [
                { id: p.id, name: p.name },
                { id: chosen.teamGroups[i][1].id, name: chosen.teamGroups[i][1].name },
                { id: chosen.teamGroups[i][2].id, name: chosen.teamGroups[i][2].name }
            ]
        }));
    }

    generateTeamsWithCaptains(players: Competitor[], teamSize: number, designatedCaptains: string[], getMemberElo: (id: string) => number): Team[] {
        const effectiveTeamSize = Math.max(teamSize, 1);
        const numTeams = Math.floor(players.length / effectiveTeamSize);
        if (numTeams <= 0) return [];

        const captainsList: Competitor[] = [];
        const regularPlayers: Competitor[] = [];

        for (const p of players) {
            if (designatedCaptains.includes(p.id)) {
                captainsList.push(p);
            } else {
                regularPlayers.push(p);
            }
        }

        // Shuffle first to randomize within the same rank tier, then sort
        const shuffledRegular = [...regularPlayers].sort(() => Math.random() - 0.5);
        const sortedRegular = shuffledRegular.sort((a, b) => getMemberElo(b.id) - getMemberElo(a.id));
        while (captainsList.length < numTeams && sortedRegular.length > 0) {
            const additionalCaptain = sortedRegular.shift();
            if (additionalCaptain) {
                captainsList.push(additionalCaptain);
                const idx = regularPlayers.findIndex(x => x.id === additionalCaptain.id);
                if (idx > -1) regularPlayers.splice(idx, 1);
            }
        }

        while (captainsList.length > numTeams) {
            const excessCaptain = captainsList.pop();
            if (excessCaptain) {
                regularPlayers.push(excessCaptain);
            }
        }

        const teams: Team[] = [];
        for (let i = 0; i < captainsList.length; i++) {
            teams.push({
                id: `team-${i + 1}`,
                name: `Đội ${captainsList[i].name}`,
                players: [captainsList[i]]
            });
        }

        // Shuffle first to randomize within the same rank tier, then sort
        const shuffledRemaining = [...regularPlayers].sort(() => Math.random() - 0.5);
        const sortedRemaining = shuffledRemaining.sort((a, b) => getMemberElo(b.id) - getMemberElo(a.id));
        let direction = 1;
        let teamIdx = 0;

        for (const player of sortedRemaining) {
            let assigned = false;
            let searchCount = 0;
            while (!assigned && searchCount < numTeams) {
                const currentTeam = teams[teamIdx];
                if (currentTeam.players.length < effectiveTeamSize) {
                    currentTeam.players.push(player);
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
                const nonFullTeam = teams.find(t => t.players.length < effectiveTeamSize);
                if (nonFullTeam) {
                    nonFullTeam.players.push(player);
                } else {
                    teams[0].players.push(player);
                }
            }
        }

        return teams;
    }

    /**
     * Hybrid team generation: locked slots become team seeds, remaining free players are
     * distributed via snake-draft balanced by ELO strength.
     *
     * @param allPlayers     Full participant list
     * @param teamSize       Target players per team
     * @param lockedSlots    Pre-assigned player groups (can be partial – under teamSize)
     * @param designatedCaptains  Captains from admin selection (used for free-pool captain logic)
     * @param getMemberElo   Strength scorer (higher = stronger)
     */
    generateTeamsWithLockedSlots(
        allPlayers: Competitor[],
        teamSize: number,
        lockedSlots: Array<{ slotId: string; label?: string; memberIds: string[] }>,
        designatedCaptains: string[],
        getMemberElo: (id: string) => number
    ): Team[] {
        const effectiveTeamSize = Math.max(teamSize, 1);

        // 1. Build set of all locked member IDs
        const lockedMemberIdSet = new Set<string>(lockedSlots.flatMap(s => s.memberIds));

        // 2. Initialise teams from locked slots (in order, preserving member sequence)
        const teams: Team[] = lockedSlots.map((slot, idx) => ({
            id: `team-${idx + 1}`,
            name: slot.label?.trim()
                ? slot.label.trim()
                : (allPlayers.find(p => p.id === slot.memberIds[0])?.name
                    ? `Đội ${allPlayers.find(p => p.id === slot.memberIds[0])!.name}`
                    : `Đội ${idx + 1}`),
            players: slot.memberIds
                .map(mid => allPlayers.find(p => p.id === mid))
                .filter((p): p is Competitor => !!p)
        }));

        // 3. Free pool = participants NOT in any locked slot
        const freePool = allPlayers.filter(p => !lockedMemberIdSet.has(p.id));

        // 4. Determine total team count needed
        const numTeams = Math.max(teams.length, Math.floor(allPlayers.length / effectiveTeamSize));

        // 5. Add empty team slots if we need more teams than locked slots
        for (let i = teams.length; i < numTeams; i++) {
            // Prefer captains to lead new teams
            const cap = freePool.find(p => designatedCaptains.includes(p.id));
            const leader = cap ?? freePool[0];
            if (leader) {
                freePool.splice(freePool.indexOf(leader), 1);
                teams.push({
                    id: `team-${i + 1}`,
                    name: `Đội ${leader.name}`,
                    players: [leader]
                });
            } else {
                teams.push({ id: `team-${i + 1}`, name: `Đội ${i + 1}`, players: [] });
            }
        }

        // 6. Snake-draft remaining free pool (shuffle within same tier, sort by strength desc)
        const shuffled = [...freePool].sort(() => Math.random() - 0.5);
        const sorted = shuffled.sort((a, b) => getMemberElo(b.id) - getMemberElo(a.id));

        let direction = 1;
        let teamIdx = 0;

        for (const player of sorted) {
            let assigned = false;
            let searched = 0;
            while (!assigned && searched < numTeams) {
                const currentTeam = teams[teamIdx];
                if (currentTeam.players.length < effectiveTeamSize) {
                    currentTeam.players.push(player);
                    assigned = true;
                }
                teamIdx += direction;
                if (teamIdx >= numTeams) { teamIdx = numTeams - 1; direction = -1; }
                else if (teamIdx < 0) { teamIdx = 0; direction = 1; }
                searched++;
            }
            // Fallback: first non-full team
            if (!assigned) {
                const fallback = teams.find(t => t.players.length < effectiveTeamSize);
                if (fallback) fallback.players.push(player);
                else teams[0].players.push(player);
            }
        }

        return teams;
    }

    generateRandomGroups<TCompetitor extends Competitor>(competitors: readonly TCompetitor[], groupSize: number): GroupAssignment<TCompetitor>[] {
        const effectiveGroupSize = Math.max(groupSize, 2);
        const shuffled = this.shuffle(competitors);
        const groups: GroupAssignment<TCompetitor>[] = [];
        let groupIndex = 0;

        for (let i = 0; i < shuffled.length; i += effectiveGroupSize) {
            const groupName = String.fromCharCode(65 + groupIndex);
            groups.push({
                groupName,
                competitors: shuffled.slice(i, i + effectiveGroupSize)
            });
            groupIndex += 1;
        }

        return groups;
    }

    generateBalancedGroups<TCompetitor extends Competitor>(
        competitors: readonly TCompetitor[],
        groupSize: number,
        strengthMap?: Map<string, number> | Record<string, number>
    ): GroupAssignment<TCompetitor>[] {
        const n = competitors.length;
        if (n <= 1) {
            return [{ groupName: 'A', competitors: [...competitors] }];
        }

        const k = Math.ceil(n / Math.max(groupSize, 2));
        if (k <= 1) {
            return [{ groupName: 'A', competitors: [...competitors] }];
        }

        const baseSize = Math.floor(n / k);
        const remainder = n % k;
        const targetSizes: number[] = [];
        for (let i = 0; i < k; i++) {
            targetSizes.push(i < remainder ? baseSize + 1 : baseSize);
        }

        const getStrength = (id: string): number => {
            if (!strengthMap) return 0;
            if (strengthMap instanceof Map) return strengthMap.get(id) ?? 0;
            return (strengthMap as Record<string, number>)[id] ?? 0;
        };

        // Shuffle competitors before searching to randomize branch exploration order
        const shuffledCompetitors = this.shuffle([...competitors]);

        const currentPartition: TCompetitor[][] = Array.from({ length: k }, () => []);
        let minDiff = Number.MAX_VALUE;
        const allPartitions: Array<{ partition: TCompetitor[][]; diff: number }> = [];

        const search = (index: number) => {
            if (index === n) {
                let minAvg = Number.MAX_VALUE;
                let maxAvg = -Number.MAX_VALUE;
                for (const grp of currentPartition) {
                    const sum = grp.reduce((s, c) => s + getStrength(c.id), 0);
                    const avg = grp.length ? sum / grp.length : 0;
                    if (avg < minAvg) minAvg = avg;
                    if (avg > maxAvg) maxAvg = avg;
                }
                const diff = maxAvg - minAvg;
                if (diff < minDiff) {
                    minDiff = diff;
                }
                allPartitions.push({
                    partition: currentPartition.map((grp) => [...grp]),
                    diff
                });
                return;
            }

            const comp = shuffledCompetitors[index];
            for (let i = 0; i < k; i++) {
                if (currentPartition[i].length < targetSizes[i]) {
                    if (currentPartition[i].length === 0) {
                        currentPartition[i].push(comp);
                        search(index + 1);
                        currentPartition[i].pop();
                        break;
                    } else {
                        currentPartition[i].push(comp);
                        search(index + 1);
                        currentPartition[i].pop();
                    }
                }
            }
        };

        search(0);

        // Filter partitions within a small tolerance of minDiff
        const TOLERANCE = 1.0;
        const candidates = allPartitions.filter((p) => p.diff <= minDiff + TOLERANCE);

        if (candidates.length === 0) {
            // Fallback to first partition
            return allPartitions[0].partition.map((compList, i) => ({
                groupName: String.fromCharCode(65 + i),
                competitors: compList
            }));
        }

        const chosen = candidates[Math.floor(Math.random() * candidates.length)];

        return chosen.partition.map((compList, i) => ({
            groupName: String.fromCharCode(65 + i),
            competitors: compList
        }));
    }

    computeGroupStandings<TCompetitor extends Competitor>(groups: readonly GroupAssignment<TCompetitor>[], scores: readonly GroupMatchScore[]): GroupStanding<TCompetitor>[] {
        return groups.map((group) => {
            const standingMap = new Map<string, MutableStanding<TCompetitor>>();

            for (const competitor of group.competitors) {
                standingMap.set(competitor.id, {
                    competitor,
                    played: 0,
                    won: 0,
                    lost: 0,
                    pointsFor: 0,
                    pointsAgainst: 0,
                    matchPoints: 0,
                    setsFor: 0,
                    setsAgainst: 0
                });
            }

            const groupScores = scores.filter((score) => {
                if (score.groupName !== group.groupName) return false;
                if (score.subMatches && score.subMatches.length > 0) {
                    return !!(score.completed || score.homeScore >= 3 || score.awayScore >= 3);
                }
                return !!(score.completed || score.homeScore > 0 || score.awayScore > 0);
            });

            for (const score of groupScores) {
                const home = standingMap.get(score.homeCompetitorId);
                const away = standingMap.get(score.awayCompetitorId);

                if (!home || !away) {
                    continue;
                }

                home.played += 1;
                away.played += 1;

                home.pointsFor += score.homeScore;
                home.pointsAgainst += score.awayScore;
                away.pointsFor += score.awayScore;
                away.pointsAgainst += score.homeScore;

                if (score.subMatches && score.subMatches.length > 0) {
                    for (const sub of score.subMatches) {
                        home.setsFor += sub.homeScore || 0;
                        home.setsAgainst += sub.awayScore || 0;
                        away.setsFor += sub.awayScore || 0;
                        away.setsAgainst += sub.homeScore || 0;
                    }
                } else {
                    home.setsFor += score.homeScore || 0;
                    home.setsAgainst += score.awayScore || 0;
                    away.setsFor += score.awayScore || 0;
                    away.setsAgainst += score.homeScore || 0;
                }

                if (score.homeScore > score.awayScore) {
                    home.won += 1;
                    away.lost += 1;
                    home.matchPoints += this.winPoints;
                    away.matchPoints += this.lossPoints;
                } else {
                    away.won += 1;
                    home.lost += 1;
                    away.matchPoints += this.winPoints;
                    home.matchPoints += this.lossPoints;
                }
            }

            const rows = Array.from(standingMap.values())
                .sort((left, right) => this.sortStandingRows(left, right, groupScores))
                .map((row, index) => ({ ...row, rank: index + 1 }));

            let hasTie = false;
            const tiedCompetitorIds: string[] = [];

            for (let i = 0; i < rows.length - 1; i++) {
                const a = rows[i];
                const b = rows[i + 1];
                const aDiff = a.pointsFor - a.pointsAgainst;
                const bDiff = b.pointsFor - b.pointsAgainst;
                const aSetsDiff = (a.setsFor || 0) - (a.setsAgainst || 0);
                const bSetsDiff = (b.setsFor || 0) - (b.setsAgainst || 0);
                const h2h = this.headToHead(a.competitor.id, b.competitor.id, groupScores);

                if (a.matchPoints === b.matchPoints && aDiff === bDiff && aSetsDiff === bSetsDiff && h2h === 0) {
                    if (a.tieBreakLot === undefined || b.tieBreakLot === undefined) {
                        hasTie = true;
                        if (!tiedCompetitorIds.includes(a.competitor.id)) tiedCompetitorIds.push(a.competitor.id);
                        if (!tiedCompetitorIds.includes(b.competitor.id)) tiedCompetitorIds.push(b.competitor.id);
                    }
                }
            }

            return {
                groupName: group.groupName,
                rows,
                hasTie,
                tiedCompetitorIds
            };
        });
    }

    pickQualified<TCompetitor extends Competitor>(standings: readonly GroupStanding<TCompetitor>[], qualifyPerGroup: number): GroupStandingRow<TCompetitor>[] {
        return standings.flatMap((standing) => standing.rows.filter((row) => row.rank <= qualifyPerGroup));
    }

    buildRoundRobinScores<TCompetitor extends Competitor>(group: GroupAssignment<TCompetitor>): GroupMatchScore[] {
        const scores: GroupMatchScore[] = [];

        for (let i = 0; i < group.competitors.length; i += 1) {
            for (let j = i + 1; j < group.competitors.length; j += 1) {
                const homeScore = this.randomScore();
                let awayScore = this.randomScore();

                // Avoid draws so ranking and Elo updates are deterministic.
                if (homeScore === awayScore) {
                    awayScore = awayScore === 3 ? 2 : awayScore + 1;
                }

                scores.push({
                    groupName: group.groupName,
                    homeCompetitorId: group.competitors[i].id,
                    awayCompetitorId: group.competitors[j].id,
                    homeScore,
                    awayScore
                });
            }
        }

        return scores;
    }

    private sortStandingRows<TCompetitor extends Competitor>(
        left: MutableStanding<TCompetitor>,
        right: MutableStanding<TCompetitor>,
        groupScores: readonly GroupMatchScore[]
    ): number {
        // 1. matchPoints (Win=3, Loss=0)
        if (right.matchPoints !== left.matchPoints) {
            return right.matchPoints - left.matchPoints;
        }

        // 2. Hiệu số trận nhỏ thắng - thua (pointsFor - pointsAgainst)
        const leftDiff = left.pointsFor - left.pointsAgainst;
        const rightDiff = right.pointsFor - right.pointsAgainst;
        if (rightDiff !== leftDiff) {
            return rightDiff - leftDiff;
        }

        // 3. Hiệu số séc thắng - thua (setsFor - setsAgainst)
        const leftSetsDiff = left.setsFor - left.setsAgainst;
        const rightSetsDiff = right.setsFor - right.setsAgainst;
        if (rightSetsDiff !== leftSetsDiff) {
            return rightSetsDiff - leftSetsDiff;
        }

        // 4. Đối đầu trực tiếp (headToHead)
        const headToHead = this.headToHead(left.competitor.id, right.competitor.id, groupScores);
        if (headToHead !== 0) {
            return headToHead;
        }

        // 5. Kết quả bốc thăm thứ hạng thủ công (tieBreakLot)
        if (left.tieBreakLot !== undefined && right.tieBreakLot !== undefined) {
            return left.tieBreakLot - right.tieBreakLot;
        }

        // 6. Tên (Alphabetical)
        return left.competitor.name.localeCompare(right.competitor.name);
    }

    private headToHead(leftId: string, rightId: string, groupScores: readonly GroupMatchScore[]): number {
        const match = groupScores.find(
            (score) =>
                (score.homeCompetitorId === leftId && score.awayCompetitorId === rightId) ||
                (score.homeCompetitorId === rightId && score.awayCompetitorId === leftId)
        );

        if (!match) {
            return 0;
        }

        const leftWon =
            (match.homeCompetitorId === leftId && match.homeScore > match.awayScore) ||
            (match.awayCompetitorId === leftId && match.awayScore > match.homeScore);

        if (leftWon) {
            return -1;
        }

        return 1;
    }

    private randomScore(): number {
        return Math.floor(Math.random() * 4);
    }

    private evaluateSeededTeams(teams: SeededCompetitor[][], maxFemalePerTeam: number): number {
        const totals = teams.map((team) => team.reduce((sum, player) => sum + player.seed, 0));
        const maxTotal = Math.max(...totals);
        const minTotal = Math.min(...totals);
        const mean = totals.reduce((sum, total) => sum + total, 0) / totals.length;
        const variance = totals.reduce((sum, total) => sum + Math.pow(total - mean, 2), 0) / totals.length;

        let femaleViolation = 0;
        for (const team of teams) {
            const femaleCount = team.filter((player) => this.isFemale(player.gender)).length;
            if (femaleCount > maxFemalePerTeam) {
                femaleViolation += femaleCount - maxFemalePerTeam;
            }
        }

        // Prioritize valid female constraints, then minimize seed spread and variance.
        return femaleViolation * 1_000_000 + (maxTotal - minTotal) * 1_000 + variance;
    }

    private isFemale(gender: string | undefined): boolean {
        const normalized = (gender || '').trim().toLowerCase();
        return normalized === 'nu' || normalized === 'nữ' || normalized === 'female';
    }

    private shuffle<T>(items: readonly T[]): T[] {
        const copy = [...items];

        for (let i = copy.length - 1; i > 0; i -= 1) {
            const j = Math.floor(Math.random() * (i + 1));
            const current = copy[i];
            copy[i] = copy[j];
            copy[j] = current;
        }

        return copy;
    }

    private shuffleNearEqualSeeds(pot: SeededCompetitor[]): SeededCompetitor[] {
        const copy = [...pot];
        // Shuffle elements randomly within the same pot for draw variation
        for (let i = copy.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [copy[i], copy[j]] = [copy[j], copy[i]];
        }
        return copy;
    }

    /** Generate all N! permutations of [0, 1, ..., n-1] using backtracking. */
    private generateAllPermutations(n: number): number[][] {
        const result: number[][] = [];
        const current: number[] = [];
        const used = new Array<boolean>(n).fill(false);

        const backtrack = () => {
            if (current.length === n) {
                result.push([...current]);
                return;
            }
            for (let i = 0; i < n; i++) {
                if (!used[i]) {
                    used[i] = true;
                    current.push(i);
                    backtrack();
                    current.pop();
                    used[i] = false;
                }
            }
        };

        backtrack();
        return result;
    }
}
