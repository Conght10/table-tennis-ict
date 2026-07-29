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

        const pots = potRanges.map((range) =>
            players
                .filter((player) => player.seed >= range.min && player.seed <= range.max)
                .sort((left, right) => left.seed - right.seed)
        );

        const teamCount = pots[0].length;
        if (!teamCount || pots.some((pot) => pot.length !== teamCount)) {
            return null;
        }

        // Shuffle within each pot (Fisher-Yates) so that re-runs produce different team compositions
        // while still preserving the tier balance (one player per tier per team)
        const shuffledPots = pots.map(pot => {
            const arr = [...pot];
            for (let i = arr.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [arr[i], arr[j]] = [arr[j], arr[i]];
            }
            return arr;
        });

        let bestTeams: SeededCompetitor[][] | null = null;
        let bestScore = Number.POSITIVE_INFINITY;

        for (let middleShift = 0; middleShift < teamCount; middleShift += 1) {
            for (let weakShift = 0; weakShift < teamCount; weakShift += 1) {
                const candidateTeams: SeededCompetitor[][] = [];
                for (let i = 0; i < teamCount; i += 1) {
                    candidateTeams.push([
                        shuffledPots[0][i],
                        shuffledPots[1][(i + middleShift) % teamCount],
                        shuffledPots[2][(i + weakShift) % teamCount]
                    ]);
                }

                const score = this.evaluateSeededTeams(candidateTeams, maxFemalePerTeam);
                if (score < bestScore) {
                    bestScore = score;
                    bestTeams = candidateTeams;
                }
            }
        }

        if (!bestTeams) {
            return null;
        }

        return bestTeams.map((teamPlayers, index) => ({
            id: `team-${index + 1}`,
            name: teamPlayers[0]?.name ? `Đội ${teamPlayers[0].name}` : `Đội ${index + 1}`,
            players: teamPlayers.map((player) => ({ id: player.id, name: player.name }))
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

            return {
                groupName: group.groupName,
                rows
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

        // 5. Tên (Alphabetical)
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
}
