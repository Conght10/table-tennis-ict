export type UserRole = 'super_admin' | 'admin' | 'referee' | 'captain' | 'player';

export type RankTier = 'A0' | 'A1' | 'A2' | 'A3' | 'A4' | 'A5' | 'A6';

export type TournamentType = 'single' | 'double' | 'team';

export type MatchSource = 'challenge' | 'tournament';

export type SeedSource = 'manual' | 'imported' | 'auto';

export interface Member {
    id: string;
    username?: string;
    fullName: string;
    email: string;
    elo: number;
    rankTier: RankTier;
    roles: UserRole[];
    joinedAt: string;
    isActive: boolean;
    department?: string;
    gender?: string;
    phone?: string;
    notes?: string;
    password?: string;
}

export interface MatchRecord {
    id: string;
    playedAt: string;
    source: MatchSource;
    homePlayerId: string;
    awayPlayerId: string;
    homeScore: number;
    awayScore: number;
    homeEloBefore: number;
    awayEloBefore: number;
    homeEloAfter: number;
    awayEloAfter: number;
    status?: 'pending' | 'confirmed' | 'disputed' | 'walkover' | 'canceled';
    recordedById?: string;
    confirmedById?: string;
    notes?: string;
    homeCheckedIn?: boolean;
    awayCheckedIn?: boolean;
    isWalkover?: boolean;
    walkoverWinnerId?: string;
    courtName?: string;
    timeSlot?: string;
}

export interface KnockoutMatch {
    id: string; // e.g., 'sf-1', 'sf-2', 'f-1'
    roundName: 'Semifinals' | 'Finals' | 'Bronze';
    homeCompetitorId: string;
    awayCompetitorId: string;
    homeScore: number;
    awayScore: number;
    winnerId?: string;
    lineup?: TeamLineup;
    subMatches?: SubMatchScore[];
    completed?: boolean;
    setScores?: { home: number; away: number }[];
}

export interface TournamentPrize {
    title: string;
    amount: number;
}

export interface TournamentRegistration {
    memberId: string;
    seed: number;
    seedSource: SeedSource;
    rankSnapshot: RankTier;
    eloSnapshot: number;
    genderSnapshot?: string;
    departmentSnapshot?: string;
    status?: 'active' | 'withdrawn';
    isCaptain?: boolean;
    registeredAt: string;
}

export interface TournamentDrawRuleConfig {
    useSeededDraw: boolean;
    lockRankDuringTournament: boolean;
    maxFemalePerTeam: number;
    seededPotRanges: Array<{ min: number; max: number; label: string }>;
}

export interface TournamentSeedOverride {
    memberId: string;
    oldSeed: number;
    newSeed: number;
    reason: string;
    actorId: string;
    overriddenAt: string;
    drawRevisionBefore: number;
    drawRevisionAfter: number;
}

export interface TournamentDrawRevisionTeam {
    teamId: string;
    teamName: string;
    memberIds: string[];
    seedTotal: number;
}

export interface TournamentDrawRevision {
    revisionNo: number;
    createdAt: string;
    reason: string;
    actorId: string;
    status: 'committed' | 'dirty';
    teams: TournamentDrawRevisionTeam[];
    groups: Array<{ groupName: string; competitorIds: string[] }>;
}

export interface Tournament {
    id: string;
    version?: number;
    registrationVersion?: number;
    metadataVersion?: number;
    competitionVersion?: number;
    name: string;
    type: TournamentType;
    startedAt: string;
    finishedAt?: string;
    status?: 'draft' | 'ongoing' | 'finished';
    participants?: string[]; // Member IDs
    registrations?: TournamentRegistration[];
    groupSize?: number;
    teamSize?: number;
    groups?: GroupAssignment<Competitor>[];
    scores?: GroupMatchScore[];
    standings?: GroupStanding<Competitor>[];
    stage?: 'group' | 'knockout';
    knockoutMatches?: KnockoutMatch[];
    teams?: Team[];
    captains?: string[];
    drawRules?: TournamentDrawRuleConfig;
    drawRevisionCurrent?: number;
    drawRevisions?: TournamentDrawRevision[];
    seedOverrideHistory?: TournamentSeedOverride[];
    drawDirty?: boolean;
    location?: string;
    prizes?: TournamentPrize[];
    manualTeamSlots?: Array<{ slotId: string; label?: string; memberIds: string[] }>;
    format?: 'group' | 'round_robin';
}

export interface TournamentParticipation {
    tournamentId: string;
    memberId: string;
    resultLabel: string;
}

export interface ChallengeRequest {
    id: string;
    challengerId: string;
    opponentId: string;
    requestedAt: string;
    preferredTime: string;
    bestOf: 3 | 5 | 7;
    note: string;
    status: 'pending' | 'accepted' | 'declined' | 'expired' | 'completed' | 'canceled';
}

export interface AppNotification {
    id: string;
    receiverId: string;
    createdAt: string;
    title: string;
    content: string;
    isRead: boolean;
}

export interface Team {
    id: string;
    name: string;
    players: Competitor[];
}

export interface Competitor {
    id: string;
    name: string;
}

export interface GroupAssignment<TCompetitor extends Competitor> {
    groupName: string;
    competitors: TCompetitor[];
}

export interface GroupMatchScore {
    groupName: string;
    homeCompetitorId: string;
    awayCompetitorId: string;
    homeScore: number;
    awayScore: number;
    lineup?: TeamLineup;
    subMatches?: SubMatchScore[];
    completed?: boolean;
    setScores?: { home: number; away: number }[];
    isWalkover?: boolean;
    walkoverWinnerId?: string;
}

export interface GroupStandingRow<TCompetitor extends Competitor> {
    competitor: TCompetitor;
    played: number;
    won: number;
    lost: number;
    pointsFor: number;
    pointsAgainst: number;
    matchPoints: number;
    rank: number;
    setsFor?: number;
    setsAgainst?: number;
    tieBreakLot?: number;
}

export interface GroupStanding<TCompetitor extends Competitor> {
    groupName: string;
    rows: GroupStandingRow<TCompetitor>[];
    hasTie?: boolean;
    tiedCompetitorIds?: string[];
}

export interface EloSettings {
    kFactor: number;
}

export interface EloComputationInput {
    homeElo: number;
    awayElo: number;
    homeScore: number;
    awayScore: number;
    settings?: EloSettings;
}

export interface EloComputationResult {
    homeExpected: number;
    awayExpected: number;
    homeAfter: number;
    awayAfter: number;
}

export interface AuditLog {
    id: string;
    timestamp: string;
    actorId: string;
    action: string;
    details: string;
    reason: string;
}

export interface CourtBooking {
    id: string;
    courtName: string;
    date: string; // YYYY-MM-DD
    startTime: string; // HH:MM
    endTime: string; // HH:MM
    bookedById: string;
    homePlayerId: string;
    awayPlayerId: string;
    status: 'pending' | 'approved' | 'rejected';
}

export interface TeamLineup {
    aPlayerId: string;
    bPlayerId: string;
    cPlayerId: string;
    xPlayerId: string;
    yPlayerId: string;
    zPlayerId: string;
    isHomeABC?: boolean;
}

export interface SubMatchScore {
    matchType: 'double' | 'single';
    label: string;
    homePlayers: string[];
    awayPlayers: string[];
    homeScore: number;
    awayScore: number;
    completed: boolean;
    handicapText?: string;
    setScores?: { home: number; away: number }[];
}

