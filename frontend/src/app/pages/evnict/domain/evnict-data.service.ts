import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
    AppNotification,
    ChallengeRequest,
    MatchRecord,
    MatchSource,
    Member,
    RankTier,
    Tournament,
    TournamentParticipation,
    UserRole,
    TournamentType,
    AuditLog,
    CourtBooking,
    Competitor,
    GroupAssignment,
    GroupMatchScore,
    GroupStanding,
    TeamLineup,
    KnockoutMatch,
    TournamentPrize,
    Team,
    TournamentRegistration,
    TournamentDrawRuleConfig,
    TournamentDrawRevision,
    TournamentSeedOverride
} from './evnict.models';
import { EloService } from './elo.service';
import { TournamentEngineService } from './tournament-engine.service';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';

interface TournamentConflictResponse {
    error?: string;
    message?: string;
    latestTournament?: Tournament;
}

interface TournamentMatchWriteResponse {
    tournamentId: string;
    version?: number;
    metadataVersion?: number;
    competitionVersion?: number;
    stage?: 'group' | 'knockout';
    status?: 'draft' | 'ongoing' | 'finished';
    updatedGroupMatch?: GroupMatchScore;
    updatedKnockoutMatch?: KnockoutMatch;
    standings?: GroupStanding<Competitor>[];
    knockoutMatches?: KnockoutMatch[];
}

interface RecordMatchInput {
    source: MatchSource;
    homePlayerId: string;
    awayPlayerId: string;
    homeScore: number;
    awayScore: number;
    status?: 'pending' | 'confirmed' | 'disputed' | 'walkover';
    recordedById?: string;
    notes?: string;
    courtName?: string;
    timeSlot?: string;
}

@Injectable({
    providedIn: 'root'
})
export class EvnictDataService {
    private loggedInUserId: string | null = typeof window !== 'undefined' ? localStorage.getItem('loggedInUserId') : null;

    getLoggedInUserId(): string | null {
        return this.loggedInUserId;
    }

    login(identifier: string, password?: string): boolean {
        const member = this.findMemberByIdentifier(identifier);
        if (!member) {
            throw new Error('Tên đăng nhập hoặc Email không tồn tại trong hệ thống.');
        }
        if (!member.isActive) {
            throw new Error('Tài khoản của bạn chưa được phê duyệt bởi Admin.');
        }
        if (password && member.password && member.password !== password) {
            throw new Error('Mật khẩu không chính xác.');
        }
        this.loggedInUserId = member.id;
        if (typeof window !== 'undefined') {
            localStorage.setItem('loggedInUserId', member.id);
        }

        // Fetch challenges and notifications for active user
        this.http.get<ChallengeRequest[]>(`${this.apiUrl}/challenges/${member.id}`).subscribe(data => this.challenges = data);
        this.http.get<AppNotification[]>(`${this.apiUrl}/notifications/${member.id}`).subscribe(data => this.notifications = data);

        this.http.post(`${this.apiUrl}/auth/login?identifier=${encodeURIComponent(identifier)}&password=${encodeURIComponent(password || '')}`, {}).subscribe();
        return true;
    }

    logout(): void {
        this.loggedInUserId = null;
        if (typeof window !== 'undefined') {
            localStorage.removeItem('loggedInUserId');
        }
        this.challenges = [];
        this.notifications = [];
    }

    setLoggedInUserForTest(userId: string): void {
        this.loggedInUserId = userId;
    }

    private findMemberByIdentifier(identifier: string): Member | undefined {
        const normalized = (identifier || '').trim().toLowerCase();
        if (!normalized) return undefined;
        return this.members.find((m) =>
            m.email.trim().toLowerCase() === normalized || (m.username || '').trim().toLowerCase() === normalized
        );
    }

    private normalizeUsername(username: string): string {
        return (username || '').trim().toLowerCase().replace(/\s+/g, '');
    }

    suggestUsernameFromEmail(email: string): string {
        const localPart = (email || '').trim().toLowerCase().split('@')[0] || 'player';
        const cleaned = localPart.replace(/[^a-z0-9._]/g, '');
        return cleaned || 'player';
    }

    private buildUniqueLocalUsername(base: string): string {
        const root = this.normalizeUsername(base) || 'player';
        let username = root;
        let suffix = 1;
        while (this.members.some((m) => (m.username || '').trim().toLowerCase() === username)) {
            username = `${root}${suffix}`;
            suffix += 1;
        }
        return username;
    }

    private normalizeRankTier(rank: string | null | undefined): RankTier {
        const normalized = (rank || '').trim().toUpperCase();
        switch (normalized) {
            case 'A0':
            case 'A1':
            case 'A2':
            case 'A3':
            case 'A4':
            case 'A5':
            case 'A6':
                return normalized;
            // Backward-compatibility for old data values.
            case 'A+':
                return 'A0';
            case 'B':
                return 'A1';
            case 'A':
                return 'A2';
            case 'C':
                return 'A3';
            case 'D':
                return 'A4';
            case 'E':
                return 'A5';
            default:
                return 'A5';
        }
    }

    private getRankTierFromElo(elo: number): RankTier {
        if (elo >= 1850) return 'A0';
        if (elo >= 1700) return 'A1';
        if (elo >= 1550) return 'A2';
        if (elo >= 1400) return 'A3';
        if (elo >= 1200) return 'A4';
        if (elo >= 1000) return 'A5';
        return 'A6';
    }

    private readonly apiUrl = 'http://localhost:8084/api';
    private readonly defaultDrawRules: TournamentDrawRuleConfig = {
        useSeededDraw: true,
        lockRankDuringTournament: true,
        maxFemalePerTeam: 1,
        seededPotRanges: [
            { min: 1, max: 7, label: 'strong' },
            { min: 8, max: 14, label: 'medium' },
            { min: 15, max: 21, label: 'weak' }
        ]
    };

    private members: Member[] = [];
    private tournaments: Tournament[] = [];
    private matches: MatchRecord[] = [];
    private challenges: ChallengeRequest[] = [];
    private notifications: AppNotification[] = [];
    private auditLogs: AuditLog[] = [];
    private bookings: CourtBooking[] = [];
    private readonly tournamentSyncInFlight = new Set<string>();
    private readonly tournamentSyncQueued = new Set<string>();
    /** Stores a desired seed order per tournament that must survive server round-trips until confirmed */
    private readonly pendingSeedOrder = new Map<string, string[]>();

    constructor(
        private readonly eloService: EloService,
        private readonly tournamentEngine: TournamentEngineService,
        private readonly http: HttpClient
    ) {}

    init(): Promise<boolean> {
        return new Promise((resolve) => {
            const loggedIn = this.getLoggedInUserId();
            const promises: Promise<any>[] = [
                firstValueFrom(this.http.get<Member[]>(`${this.apiUrl}/members`)).then(data => {
                    this.members = data.map((m) => ({ ...m, rankTier: this.normalizeRankTier(m.rankTier) }));
                }),
                firstValueFrom(this.http.get<MatchRecord[]>(`${this.apiUrl}/matches`)).then(data => this.matches = data),
                firstValueFrom(this.http.get<Tournament[]>(`${this.apiUrl}/tournaments`)).then(data => {
                    this.tournaments = data.map((tournament) => this.hydrateTournamentDerivedData(tournament));
                    this.tournaments.forEach(t => this.autoCheckAndGenerateFinal(t, true));
                }),
                firstValueFrom(this.http.get<AuditLog[]>(`${this.apiUrl}/audit-logs`)).then(data => this.auditLogs = data)
            ];

            if (loggedIn) {
                promises.push(
                    firstValueFrom(this.http.get<ChallengeRequest[]>(`${this.apiUrl}/challenges/${loggedIn}`)).then(data => this.challenges = data),
                    firstValueFrom(this.http.get<AppNotification[]>(`${this.apiUrl}/notifications/${loggedIn}`)).then(data => this.notifications = data)
                );
            }

            Promise.all(promises).then(() => {
                this.refreshAllTeamSubMatchHandicapTexts(false);
                resolve(true);
            }).catch(err => {
                console.error('Failed to load startup data from backend', err);
                resolve(true); // Don't block app boot if backend is offline during test
            });
        });
    }

    private syncTournamentToBackend(tournamentId: string): void {
        if (this.tournamentSyncInFlight.has(tournamentId)) {
            this.tournamentSyncQueued.add(tournamentId);
            return;
        }

        const t = this.tournaments.find(x => x.id === tournamentId);
        if (!t) {
            return;
        }

        this.tournamentSyncInFlight.add(tournamentId);
        this.http.put<Tournament>(`${this.apiUrl}/tournaments/${tournamentId}`, t).subscribe({
            next: (saved) => {
                this.replaceLocalTournament(saved);
                this.finishTournamentSync(tournamentId);
            },
            error: (err: HttpErrorResponse) => {
                if (err.status === 409) {
                    const latest = (err.error as TournamentConflictResponse | null)?.latestTournament;
                    if (latest?.id) {
                        this.replaceLocalTournament(latest);
                        console.warn('Tournament sync conflict. Local data refreshed from server.', latest.id);
                        this.finishTournamentSync(tournamentId);
                        return;
                    }

                    this.http.get<Tournament>(`${this.apiUrl}/tournaments/${tournamentId}`).subscribe({
                        next: (fresh) => {
                            this.replaceLocalTournament(fresh);
                            console.warn('Tournament sync conflict. Latest tournament reloaded from server.', tournamentId);
                            this.finishTournamentSync(tournamentId);
                        },
                        error: (reloadErr) => {
                            console.error('Tournament conflict reload failed', reloadErr);
                            this.finishTournamentSync(tournamentId);
                        }
                    });
                    return;
                }

                console.error('Failed to sync tournament to backend', err);
                this.finishTournamentSync(tournamentId);
            }
        });
    }

    private postTournamentMatchResult<TPayload>(
        tournamentId: string,
        endpointPath: string,
        payload: TPayload,
        attempt = 0,
        requestId?: string
    ): void {
        const tournament = this.tournaments.find((item) => item.id === tournamentId);
        const stableRequestId = requestId || this.generateTournamentRequestId(tournamentId, endpointPath);
        const requestBody: Record<string, unknown> = {
            ...(payload as Record<string, unknown>),
            requestId: stableRequestId,
            expectedMetadataVersion: tournament?.metadataVersion,
            expectedCompetitionVersion: tournament?.competitionVersion,
            expectedTournamentVersion: tournament?.competitionVersion
        };

        this.http.post<TournamentMatchWriteResponse | Tournament>(`${this.apiUrl}/tournaments/${tournamentId}${endpointPath}`, requestBody).subscribe({
            next: (response) => this.applyTournamentMatchWriteResponse(tournamentId, response),
            error: (err: HttpErrorResponse) => {
                if (err.status === 409) {
                    const latest = (err.error as TournamentConflictResponse | null)?.latestTournament;
                    if (latest?.id) {
                        this.replaceLocalTournament(latest);
                    }
                    if (attempt < 1) {
                        this.postTournamentMatchResult(tournamentId, endpointPath, payload, attempt + 1, stableRequestId);
                        return;
                    }
                }

                // Topology may have changed (match moved/rebuilt). Refresh local cache proactively.
                if (err.status === 400 || err.status >= 500) {
                    this.http.get<Tournament>(`${this.apiUrl}/tournaments/${tournamentId}`).subscribe({
                        next: (fresh) => this.replaceLocalTournament(fresh),
                        error: () => undefined
                    });
                }
                console.error('Failed to persist tournament match result', err);
            }
        });
    }

    private generateTournamentRequestId(tournamentId: string, endpointPath: string): string {
        return `${tournamentId}:${endpointPath}:${Date.now()}:${Math.random().toString(16).slice(2, 10)}`;
    }

    private applyTournamentMatchWriteResponse(tournamentId: string, response: TournamentMatchWriteResponse | Tournament): void {
        const fullTournament = response as Tournament;
        if (fullTournament && typeof fullTournament.id === 'string' && typeof fullTournament.name === 'string') {
            const current = this.tournaments.find((item) => item.id === fullTournament.id);
            if (
                this.getCompetitionVersion(current) > this.getCompetitionVersion(fullTournament)
                || this.getMetadataVersion(current) > this.getMetadataVersion(fullTournament)
            ) {
                return;
            }
            this.replaceLocalTournament(fullTournament);
            return;
        }

        const patch = response as TournamentMatchWriteResponse;
        const targetId = patch.tournamentId || tournamentId;
        const t = this.tournaments.find((x) => x.id === targetId);
        if (!t) {
            return;
        }

        if (
            (typeof patch.competitionVersion === 'number' && patch.competitionVersion < this.getCompetitionVersion(t))
            || (typeof patch.metadataVersion === 'number' && patch.metadataVersion < this.getMetadataVersion(t))
        ) {
            return;
        }

        if (typeof patch.version === 'number') {
            t.version = patch.version;
        }
        if (typeof patch.metadataVersion === 'number') {
            t.metadataVersion = patch.metadataVersion;
        }
        if (typeof patch.competitionVersion === 'number') {
            t.competitionVersion = patch.competitionVersion;
        }
        if (patch.stage) {
            t.stage = patch.stage;
        }
        if (patch.status) {
            t.status = patch.status;
        }
        if (patch.standings) {
            t.standings = patch.standings;
        }
        if (patch.knockoutMatches) {
            t.knockoutMatches = patch.knockoutMatches;
        }

        if (!patch.standings) {
            t.standings = this.tournamentEngine.computeGroupStandings(t.groups || [], t.scores || []);
        }

        if (patch.updatedGroupMatch) {
            const updated = patch.updatedGroupMatch;
            const index = (t.scores || []).findIndex((s) =>
                s.groupName === updated.groupName
                && s.homeCompetitorId === updated.homeCompetitorId
                && s.awayCompetitorId === updated.awayCompetitorId
            );
            if (index !== -1 && t.scores) {
                t.scores[index] = updated;
            }
        }

        if (patch.updatedKnockoutMatch) {
            const updated = patch.updatedKnockoutMatch;
            const index = (t.knockoutMatches || []).findIndex((m) => m.id === updated.id);
            if (index !== -1 && t.knockoutMatches) {
                t.knockoutMatches[index] = updated;
            }
        }
    }

    private finishTournamentSync(tournamentId: string): void {
        this.tournamentSyncInFlight.delete(tournamentId);
        if (this.tournamentSyncQueued.delete(tournamentId)) {
            this.syncTournamentToBackend(tournamentId);
        } else {
            // No more syncs queued — the server now has the latest state, clear pending seed order
            this.pendingSeedOrder.delete(tournamentId);
        }
    }

    private replaceLocalTournament(updated: Tournament): void {
        const index = this.tournaments.findIndex((tournament) => tournament.id === updated.id);
        if (index !== -1) {
            this.tournaments[index] = this.hydrateTournamentDerivedData(updated);
            // Re-apply any pending seed reorder that was queued after the in-flight PUT was dispatched
            const pending = this.pendingSeedOrder.get(updated.id);
            if (pending) {
                this.applySeedOrder(this.tournaments[index], pending);
            }
        }
    }

    /** Re-assign seeds 1..n in order for the given memberIdOrder array */
    private applySeedOrder(t: Tournament, memberIdOrder: string[]): void {
        if (!t.registrations) return;
        memberIdOrder.forEach((memberId, index) => {
            const reg = t.registrations!.find((r) => r.memberId === memberId);
            if (reg) {
                reg.seed = index + 1;
                reg.seedSource = 'manual';
            }
        });
    }

    private getMetadataVersion(tournament: Tournament | undefined | null): number {
        return typeof tournament?.metadataVersion === 'number' ? tournament.metadataVersion : 0;
    }

    private getCompetitionVersion(tournament: Tournament | undefined | null): number {
        const competitionVersion = tournament?.competitionVersion;
        if (typeof competitionVersion === 'number') {
            return competitionVersion;
        }

        return typeof tournament?.version === 'number' ? tournament.version : 0;
    }

    private hydrateTournamentDerivedData(tournament: Tournament): Tournament {
        const hydrated: Tournament = {
            ...tournament,
            groups: tournament.groups || [],
            scores: tournament.scores || [],
            standings: this.tournamentEngine.computeGroupStandings(tournament.groups || [], tournament.scores || []),
            knockoutMatches: tournament.knockoutMatches || [],
            participants: tournament.participants || [],
            registrations: tournament.registrations || [],
            drawRules: tournament.drawRules
                ? {
                      ...this.defaultDrawRules,
                      ...tournament.drawRules,
                      seededPotRanges: (tournament.drawRules.seededPotRanges || this.defaultDrawRules.seededPotRanges).map((item) => ({ ...item }))
                  }
                : { ...this.defaultDrawRules, seededPotRanges: this.defaultDrawRules.seededPotRanges.map((item) => ({ ...item })) },
            drawRevisionCurrent: tournament.drawRevisionCurrent || 0,
            drawRevisions: tournament.drawRevisions || [],
            seedOverrideHistory: tournament.seedOverrideHistory || [],
            drawDirty: !!tournament.drawDirty
        };

        this.ensureTournamentRegistrations(hydrated);

        if (typeof hydrated.metadataVersion !== 'number') {
            hydrated.metadataVersion = 0;
        }
        if (typeof hydrated.competitionVersion !== 'number') {
            hydrated.competitionVersion = typeof hydrated.version === 'number' ? hydrated.version : 0;
        }

        return hydrated;
    }

    private ensureTournamentRegistrations(tournament: Tournament): void {
        if (!tournament.participants) {
            tournament.participants = [];
        }

        if (!tournament.registrations) {
            tournament.registrations = [];
        }

        if (tournament.registrations.length === 0 && tournament.participants.length > 0) {
            tournament.registrations = tournament.participants.map((memberId, index) =>
                this.buildTournamentRegistration(memberId, index + 1)
            );
            return;
        }

        if (tournament.registrations.length > 0 && tournament.participants.length === 0) {
            tournament.participants = tournament.registrations.map((registration) => registration.memberId);
        }

        const registrationByMember = new Map(tournament.registrations.map((item) => [item.memberId, item]));
        for (const memberId of tournament.participants) {
            if (!registrationByMember.has(memberId)) {
                const nextSeed = this.nextSeedValue(tournament.registrations);
                const registration = this.buildTournamentRegistration(memberId, nextSeed);
                tournament.registrations.push(registration);
                registrationByMember.set(memberId, registration);
            }
        }

        tournament.registrations = tournament.registrations.filter((registration) => tournament.participants?.includes(registration.memberId));

        for (const registration of tournament.registrations) {
            const member = this.getMemberById(registration.memberId);
            registration.seed = Math.max(1, Number(registration.seed) || this.nextSeedValue(tournament.registrations));
            registration.seedSource = registration.seedSource || 'manual';
            registration.rankSnapshot = this.normalizeRankTier(registration.rankSnapshot || member?.rankTier);
            registration.eloSnapshot = Number(registration.eloSnapshot) || member?.elo || 1200;
            registration.genderSnapshot = registration.genderSnapshot || member?.gender;
            registration.departmentSnapshot = registration.departmentSnapshot || member?.department;
            registration.registeredAt = registration.registeredAt || new Date().toISOString();
        }

        tournament.registrations.sort((left, right) => left.seed - right.seed || left.memberId.localeCompare(right.memberId));
    }

    private buildTournamentRegistration(memberId: string, seed: number): TournamentRegistration {
        const member = this.getMemberById(memberId);
        return {
            memberId,
            seed,
            seedSource: 'auto',
            rankSnapshot: this.normalizeRankTier(member?.rankTier),
            eloSnapshot: member?.elo ?? 1200,
            genderSnapshot: member?.gender,
            departmentSnapshot: member?.department,
            registeredAt: new Date().toISOString()
        };
    }

    private nextSeedValue(registrations: TournamentRegistration[]): number {
        const maxSeed = registrations.reduce((max, item) => Math.max(max, item.seed), 0);
        return maxSeed + 1;
    }

    private getMemberRankTier(memberId: string): RankTier {
        const member = this.members.find((m) => m.id === memberId);
        return this.normalizeRankTier(member?.rankTier);
    }

    private getTournamentRankTier(tournament: Tournament | undefined, memberId: string): RankTier {
        if (tournament?.drawRules?.lockRankDuringTournament && tournament.registrations?.length) {
            const registration = tournament.registrations.find((item) => item.memberId === memberId);
            if (registration) {
                return this.normalizeRankTier(registration.rankSnapshot);
            }
        }

        return this.getMemberRankTier(memberId);
    }

    private getDoubleHandicapFromRanks(homeRanks: RankTier[], awayRanks: RankTier[]): string {
        const homeScore = homeRanks.reduce((sum, rank) => sum + this.getDoublePointByRank(rank), 0);
        const awayScore = awayRanks.reduce((sum, rank) => sum + this.getDoublePointByRank(rank), 0);

        if (homeScore === awayScore) {
            return 'Đánh ngang';
        }

        const diff = Math.abs(homeScore - awayScore);
        const doubleHandicapTable: Record<number, string> = {
            1: '0-2-0-2-0',
            2: '2 quả đều',
            3: '2-3-2-3-2',
            4: '3 quả đều',
            5: '3-4-3-4-3',
            6: '4 quả đều'
        };

        const handicap = doubleHandicapTable[Math.min(diff, 6)] || '4 quả đều';
        const isHomeStronger = homeScore < awayScore;
        return isHomeStronger ? `Bên A chấp ${handicap}` : `Bên B chấp ${handicap}`;
    }

    private computeSubMatchHandicapText(
        sub: { matchType: 'double' | 'single'; homePlayers: string[]; awayPlayers: string[] },
        tournament?: Tournament
    ): string {
        if (sub.matchType === 'double') {
            const homeRanks = (sub.homePlayers || []).map((id) => this.getTournamentRankTier(tournament, id));
            const awayRanks = (sub.awayPlayers || []).map((id) => this.getTournamentRankTier(tournament, id));
            return this.getDoubleHandicapFromRanks(homeRanks, awayRanks);
        }

        const homeRank = this.getTournamentRankTier(tournament, sub.homePlayers?.[0] || '');
        const awayRank = this.getTournamentRankTier(tournament, sub.awayPlayers?.[0] || '');
        return this.getSingleHandicap(homeRank, awayRank);
    }

    private refreshAllTeamSubMatchHandicapTexts(syncToBackend: boolean): void {
        for (const tournament of this.tournaments) {
            if (tournament.type !== 'team') {
                continue;
            }

            let changed = false;
            const allMatches = [
                ...(tournament.scores || []),
                ...(tournament.knockoutMatches || [])
            ];

            for (const match of allMatches) {
                if (!match?.lineup || !match.subMatches?.length) {
                    continue;
                }

                for (const sub of match.subMatches) {
                    const expected = this.computeSubMatchHandicapText(sub, tournament);
                    if (sub.handicapText !== expected) {
                        sub.handicapText = expected;
                        changed = true;
                    }
                }
            }

            if (changed && syncToBackend) {
                this.syncTournamentToBackend(tournament.id);
            }
        }
    }

    private participations: TournamentParticipation[] = [];

    // --- MEMBERS SECTION ---
    getMembers(): Member[] {
        return this.members.map((member) => ({ ...member, roles: [...member.roles] }));
    }

    getMemberById(memberId: string): Member | null {
        const member = this.members.find((item) => item.id === memberId);
        return member ? { ...member, roles: [...member.roles] } : null;
    }

    registerMember(input: { fullName: string; username?: string; email: string; department?: string; password?: string; gender?: string; phone?: string }): Member {
        const normalizedEmail = input.email.trim().toLowerCase();
        if (this.members.some((m) => m.email.trim().toLowerCase() === normalizedEmail)) {
            throw new Error('Email đã tồn tại trong hệ thống.');
        }

        const requestedUsername = this.normalizeUsername(input.username || '');
        if (requestedUsername && this.members.some((m) => (m.username || '').trim().toLowerCase() === requestedUsername)) {
            throw new Error('Username đã tồn tại. Vui lòng chọn username khác.');
        }

        const username = this.buildUniqueLocalUsername(requestedUsername || this.suggestUsernameFromEmail(normalizedEmail));
        const id = `u${(this.members.length + 1).toString().padStart(2, '0')}`;
        const newMember: Member = {
            id,
            username,
            fullName: input.fullName,
            email: normalizedEmail,
            elo: 1200, // Default Elo
            rankTier: 'A5', // Default Rank
            roles: ['player'],
            joinedAt: new Date().toISOString().split('T')[0],
            isActive: false, // Must be approved by admin
            department: input.department ?? 'N/A',
            gender: input.gender ?? 'Nam',
            phone: input.phone ?? '',
            password: input.password ?? '123456'
        };
        this.members.push(newMember);

        // Notify admins
        this.members
            .filter((m) => m.roles.includes('admin'))
            .forEach((admin) => {
                this.pushNotification(admin.id, 'Nguoi choi moi dang ky', `${input.fullName} dang cho ban duyet tai khoan.`);
            });

        this.http.post(`${this.apiUrl}/auth/register`, newMember).subscribe();
        return newMember;
    }

    async changePassword(memberId: string, oldPassword: string, newPassword: string): Promise<void> {
        await firstValueFrom(this.http.post(`${this.apiUrl}/members/${memberId}/change-password`, {
            oldPassword,
            newPassword
        }));

        const member = this.members.find((item) => item.id === memberId);
        if (member) {
            member.password = newPassword;
        }
    }

    approveMember(memberId: string, actorId: string): boolean {
        const member = this.members.find((item) => item.id === memberId);
        if (!member) return false;

        member.isActive = true;
        this.pushNotification(member.id, 'Tai khoan duoc kich hoat', 'Chao mung ban den voi EVNICT Table Tennis!');
        this.logAction(actorId, 'Kich hoat tai khoan', `Duyet thanh vien ${member.fullName} (${member.email})`, 'Duyet yeu cau dang ky hop le.');

        this.http.post(`${this.apiUrl}/members/approve/${memberId}?actorId=${actorId}`, {}).subscribe();
        return true;
    }

    rejectMember(memberId: string, actorId: string): boolean {
        const index = this.members.findIndex((item) => item.id === memberId);
        if (index === -1) return false;

        const name = this.members[index].fullName;
        this.members.splice(index, 1);
        this.logAction(actorId, 'Tu choi dang ky', `Xoa dang ky cua ${name}`, 'Tai khoan khong hop le.');
        return true;
    }

    updateMemberRank(memberId: string, rankTier: RankTier): boolean {
        const member = this.members.find((item) => item.id === memberId);
        if (!member) return false;
        member.rankTier = this.normalizeRankTier(rankTier);
        this.refreshAllTeamSubMatchHandicapTexts(true);
        return true;
    }

    updateMemberRoles(memberId: string, roles: UserRole[]): boolean {
        const member = this.members.find((item) => item.id === memberId);
        if (!member) return false;
        member.roles = [...roles];
        return true;
    }

    overrideRankWithReason(memberId: string, rankTier: RankTier, reason: string, actorId: string): boolean {
        const member = this.members.find((item) => item.id === memberId);
        if (!member) return false;

        const normalizedRank = this.normalizeRankTier(rankTier);
        const oldRank = member.rankTier;
        member.rankTier = normalizedRank;
        this.logAction(actorId, 'Ghi de hang xep hang', `Thay doi hang cua ${member.fullName} tu ${oldRank} sang ${normalizedRank}`, reason);
        this.pushNotification(member.id, 'Thay doi hang boi Admin', `Hang cua ban da duoc dieu chinh tu ${oldRank} sang ${normalizedRank}.`);

        this.http.put(`${this.apiUrl}/members/override/${memberId}?elo=${member.elo}&rank=${normalizedRank}&actorId=${actorId}&reason=${encodeURIComponent(reason)}`, {}).subscribe();
        this.refreshAllTeamSubMatchHandicapTexts(true);
        return true;
    }

    overrideEloWithReason(memberId: string, newElo: number, reason: string, actorId: string): boolean {
        const member = this.members.find((item) => item.id === memberId);
        if (!member) return false;

        const oldElo = member.elo;
        member.elo = newElo;

        // Auto-update rank tier based on new Elo
        const newRank = this.getRankTierFromElo(newElo);
        member.rankTier = newRank;

        this.logAction(actorId, 'Ghi de diem Elo', `Thay doi Elo cua ${member.fullName} tu ${oldElo} sang ${newElo}`, reason);
        this.pushNotification(member.id, 'Thay doi Elo boi Admin', `Diem Elo cua ban da duoc dieu chinh tu ${oldElo} sang ${newElo}.`);

        this.http.put(`${this.apiUrl}/members/override/${memberId}?elo=${newElo}&rank=${newRank}&actorId=${actorId}&reason=${encodeURIComponent(reason)}`, {}).subscribe();
        this.refreshAllTeamSubMatchHandicapTexts(true);
        return true;
    }

    // --- MATCH RECORDING ---
    getMatches(): MatchRecord[] {
        return this.matches.map((match) => ({ ...match }));
    }

    getMatchesByMember(memberId: string): MatchRecord[] {
        return this.matches.filter((match) => match.homePlayerId === memberId || match.awayPlayerId === memberId).map((match) => ({ ...match }));
    }

    recordMatch(input: RecordMatchInput): MatchRecord {
        const home = this.members.find((member) => member.id === input.homePlayerId);
        const away = this.members.find((member) => member.id === input.awayPlayerId);

        if (!home || !away) {
            throw new Error('Nguoi choi khong ton tai.');
        }

        const isPending = input.status === 'pending';
        let elo = { homeAfter: home.elo, awayAfter: away.elo };

        if (!isPending && input.status !== 'walkover') {
            elo = this.eloService.calculate({
                homeElo: home.elo,
                awayElo: away.elo,
                homeScore: input.homeScore,
                awayScore: input.awayScore
            });
        }

        const match: MatchRecord = {
            id: `m${(this.matches.length + 1).toString().padStart(2, '0')}`,
            playedAt: new Date().toISOString(),
            source: input.source,
            homePlayerId: home.id,
            awayPlayerId: away.id,
            homeScore: input.homeScore,
            awayScore: input.awayScore,
            homeEloBefore: home.elo,
            awayEloBefore: away.elo,
            homeEloAfter: elo.homeAfter,
            awayEloAfter: elo.awayAfter,
            status: input.status ?? 'confirmed',
            recordedById: input.recordedById,
            notes: input.notes,
            courtName: input.courtName,
            timeSlot: input.timeSlot
        };

        if (!isPending && input.status !== 'walkover') {
            home.elo = elo.homeAfter;
            away.elo = elo.awayAfter;
        }

        this.matches = [match, ...this.matches];

        // Send notifications
        if (isPending) {
            this.pushNotification(away.id, 'Xac nhan ket qua tran dau', `${home.fullName} vua ghi nhan ket qua ${input.homeScore}-${input.awayScore}. Vui long kiem tra va xac nhan.`);
        } else {
            this.pushNotification(away.id, 'Ket qua tran dau moi', `${home.fullName} ${input.homeScore}-${input.awayScore} ${away.fullName}.`);
            if (input.recordedById && input.recordedById !== home.id && input.recordedById !== away.id) {
                this.pushNotification(home.id, 'Trọng tài nhập kết quả', `Trọng tài đã xác nhận kết quả ${input.homeScore}-${input.awayScore} với ${away.fullName}.`);
            }
        }

        this.http.post(`${this.apiUrl}/matches/record`, match).subscribe();
        return match;
    }

    confirmMatch(matchId: string, actorId: string): boolean {
        const match = this.matches.find((m) => m.id === matchId);
        if (!match || match.status !== 'pending') return false;

        const home = this.members.find((m) => m.id === match.homePlayerId);
        const away = this.members.find((m) => m.id === match.awayPlayerId);
        if (!home || !away) return false;

        // Apply Elo recalculation now
        const elo = this.eloService.calculate({
            homeElo: home.elo,
            awayElo: away.elo,
            homeScore: match.homeScore,
            awayScore: match.awayScore
        });

        match.homeEloBefore = home.elo;
        match.awayEloBefore = away.elo;
        match.homeEloAfter = elo.homeAfter;
        match.awayEloAfter = elo.awayAfter;
        match.status = 'confirmed';
        match.confirmedById = actorId;

        home.elo = elo.homeAfter;
        away.elo = elo.awayAfter;

        // Notify players
        this.pushNotification(match.homePlayerId, 'Tran dau duoc xac nhan', `Ket qua tran voi ${away.fullName} da duoc dong y va tinh Elo.`);
        this.pushNotification(match.awayPlayerId, 'Tran dau duoc xac nhan', `Ket qua tran voi ${home.fullName} da duoc dong y va tinh Elo.`);

        this.logAction('He thong', 'Xác nhận kết quả', `Trận đấu ${match.id}: ${home.fullName} vs ${away.fullName} (${match.homeScore}-${match.awayScore})`, `Xác nhận bởi ${actorId}`);

        return true;
    }

    disputeMatch(matchId: string, actorId: string): boolean {
        const match = this.matches.find((m) => m.id === matchId);
        if (!match || match.status !== 'pending') return false;

        match.status = 'disputed';
        match.confirmedById = actorId;

        const otherPlayerId = match.homePlayerId === actorId ? match.awayPlayerId : match.homePlayerId;
        this.pushNotification(otherPlayerId, 'Tranh chap ket qua tran dau', `${this.getMemberById(actorId)?.fullName} khong dong y voi ket qua ghi nhan. Dang cho Admin gia quyet.`);

        // Notify refs/admins
        this.members
            .filter((m) => m.roles.includes('referee') || m.roles.includes('admin'))
            .forEach((ref) => {
                this.pushNotification(ref.id, 'Tranh chap tran dau can giai quyet', `Trận ${match.id} dang bi khieu nai.`);
            });

        return true;
    }

    resolveDisputedMatch(matchId: string, action: 'confirm' | 'cancel' | 'modify', homeScore: number, awayScore: number, actorId: string, reason: string): boolean {
        const match = this.matches.find((m) => m.id === matchId);
        if (!match) return false;

        if (action === 'cancel') {
            match.status = 'canceled';
            this.logAction(actorId, 'Huy tran tranh chap', `Hủy trận ${match.id}`, reason);
            this.pushNotification(match.homePlayerId, 'Trận đấu bị hủy bởi Admin', `Trận đấu ngày ${new Date(match.playedAt).toLocaleDateString()} đã bị hủy.`);
            this.pushNotification(match.awayPlayerId, 'Trận đấu bị hủy bởi Admin', `Trận đấu ngày ${new Date(match.playedAt).toLocaleDateString()} đã bị hủy.`);
            return true;
        }

        const home = this.members.find((m) => m.id === match.homePlayerId);
        const away = this.members.find((m) => m.id === match.awayPlayerId);
        if (!home || !away) return false;

        if (action === 'modify') {
            match.homeScore = homeScore;
            match.awayScore = awayScore;
        }

        // Apply Elo
        const elo = this.eloService.calculate({
            homeElo: home.elo,
            awayElo: away.elo,
            homeScore: match.homeScore,
            awayScore: match.awayScore
        });

        match.homeEloBefore = home.elo;
        match.awayEloBefore = away.elo;
        match.homeEloAfter = elo.homeAfter;
        match.awayEloAfter = elo.awayAfter;
        match.status = 'confirmed';
        match.confirmedById = actorId;

        home.elo = elo.homeAfter;
        away.elo = elo.awayAfter;

        this.logAction(actorId, 'Giai quyet tranh chap tran dau', `Xac nhan tran ${match.id} voi ty so ${match.homeScore}-${match.awayScore}`, reason);
        this.pushNotification(match.homePlayerId, 'Tranh chấp đã giải quyết', `Admin đã giải quyết khiếu nại trận đấu. Tỉ số cuối cùng: ${match.homeScore}-${match.awayScore}.`);
        this.pushNotification(match.awayPlayerId, 'Tranh chấp đã giải quyết', `Admin đã giải quyết khiếu nại trận đấu. Tỉ số cuối cùng: ${match.homeScore}-${match.awayScore}.`);

        return true;
    }

    recordWalkover(homeId: string, awayId: string, winnerId: string, notes: string, actorId: string): MatchRecord {
        const home = this.getMemberById(homeId);
        const away = this.getMemberById(awayId);
        if (!home || !away) throw new Error('Nguoi choi khong ton tai.');

        const homeScore = winnerId === homeId ? 3 : 0;
        const awayScore = winnerId === awayId ? 3 : 0;

        const match: MatchRecord = {
            id: `m${(this.matches.length + 1).toString().padStart(2, '0')}`,
            playedAt: new Date().toISOString(),
            source: 'challenge',
            homePlayerId: homeId,
            awayPlayerId: awayId,
            homeScore,
            awayScore,
            homeEloBefore: home.elo,
            awayEloBefore: away.elo,
            homeEloAfter: home.elo, // Walkovers do not affect Elo
            awayEloAfter: away.elo,
            status: 'walkover',
            recordedById: actorId,
            notes: `Xu walkover/no-show. ${notes}`
        };

        this.matches = [match, ...this.matches];
        this.logAction(actorId, 'Ghi nhận Walkover', `Xử thắng cuộc cho ${winnerId === homeId ? home.fullName : away.fullName}`, notes);
        this.pushNotification(homeId, 'Ket qua Walkover', `Trận đấu đã được ghi nhận Walkover.`);
        this.pushNotification(awayId, 'Ket qua Walkover', `Trận đấu đã được ghi nhận Walkover.`);

        this.http.post(`${this.apiUrl}/matches/record`, match).subscribe();
        return match;
    }

    // --- CHALLENGES ---
    async createChallenge(input: Omit<ChallengeRequest, 'id' | 'requestedAt' | 'status'>): Promise<ChallengeRequest> {
        const payload = {
            ...input,
            preferredTime: this.toBackendDateTime(input.preferredTime)
        };

        const saved = await firstValueFrom(this.http.post<ChallengeRequest>(`${this.apiUrl}/challenges`, payload));
        this.challenges = [saved, ...this.challenges.filter((c) => c.id !== saved.id)];
        return { ...saved };
    }

    private toBackendDateTime(value: string): string {
        const raw = (value || '').trim();
        if (!raw) {
            const now = new Date();
            return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}T${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:00`;
        }

        if (/^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}$/.test(raw)) {
            return raw.replace(' ', 'T') + ':00';
        }

        if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(raw)) {
            return raw + ':00';
        }

        return raw;
    }

    getChallengesByMember(memberId: string): ChallengeRequest[] {
        return this.challenges.filter((item) => item.challengerId === memberId || item.opponentId === memberId).map((item) => ({ ...item }));
    }

    acceptChallenge(challengeId: string): boolean {
        const challenge = this.challenges.find((c) => c.id === challengeId);
        if (!challenge || challenge.status !== 'pending') return false;

        challenge.status = 'accepted';
        const opponent = this.getMemberById(challenge.opponentId);
        this.pushNotification(challenge.challengerId, 'Thach dau duoc dong y', `${opponent?.fullName} da chap nhan loi thach dau cua ban.`);

        this.http.post(`${this.apiUrl}/challenges/${challengeId}/accept`, {}).subscribe();
        return true;
    }

    declineChallenge(challengeId: string): boolean {
        const challenge = this.challenges.find((c) => c.id === challengeId);
        if (!challenge || challenge.status !== 'pending') return false;

        challenge.status = 'declined';
        const opponent = this.getMemberById(challenge.opponentId);
        this.pushNotification(challenge.challengerId, 'Thach dau bi tu choi', `${opponent?.fullName} da tu choi loi thach dau cua ban.`);

        this.http.post(`${this.apiUrl}/challenges/${challengeId}/decline`, {}).subscribe();
        return true;
    }

    cancelChallenge(challengeId: string): boolean {
        const challenge = this.challenges.find((c) => c.id === challengeId);
        if (!challenge || challenge.status !== 'pending') return false;

        challenge.status = 'canceled';
        this.http.post(`${this.apiUrl}/challenges/${challengeId}/cancel`, {}).subscribe();
        return true;
    }

    // --- COURT BOOKINGS SECTION ---
    getBookings(): CourtBooking[] {
        return this.bookings.map((b) => ({ ...b }));
    }

    bookCourt(input: Omit<CourtBooking, 'id' | 'status'>): { success: boolean; message: string; booking?: CourtBooking } {
        // Validate overlaps
        const start = input.startTime;
        const end = input.endTime;

        const hasCourtConflict = this.bookings.some(
            (b) =>
                b.status === 'approved' &&
                b.courtName === input.courtName &&
                b.date === input.date &&
                ((start >= b.startTime && start < b.endTime) || (end > b.startTime && end <= b.endTime) || (start <= b.startTime && end >= b.endTime))
        );

        if (hasCourtConflict) {
            return { success: false, message: `San ${input.courtName} da duoc dat vao khung gio nay.` };
        }

        const hasPlayerConflict = this.bookings.some(
            (b) =>
                b.status === 'approved' &&
                b.date === input.date &&
                ((start >= b.startTime && start < b.endTime) || (end > b.startTime && end <= b.endTime) || (start <= b.startTime && end >= b.endTime)) &&
                (b.homePlayerId === input.homePlayerId ||
                    b.awayPlayerId === input.homePlayerId ||
                    b.homePlayerId === input.awayPlayerId ||
                    b.awayPlayerId === input.awayPlayerId)
        );

        if (hasPlayerConflict) {
            return { success: false, message: `Nguoi choi dang co lich thi dau khac trung gio nay.` };
        }

        const booking: CourtBooking = {
            ...input,
            id: `b${(this.bookings.length + 1).toString().padStart(2, '0')}`,
            status: 'approved' // Auto-approve in mock
        };
        this.bookings.push(booking);

        this.pushNotification(booking.homePlayerId, 'Dat lich san thanh cong', `Lich dat san ${booking.courtName} vao luc ${booking.startTime} ngay ${booking.date} da duoc duyet.`);
        if (booking.awayPlayerId && booking.awayPlayerId !== booking.homePlayerId) {
            this.pushNotification(booking.awayPlayerId, 'Lich thi dau moi', `Lich thi dau voi ${this.getMemberById(booking.homePlayerId)?.fullName} tai ${booking.courtName} luc ${booking.startTime} da duoc len lich.`);
        }

        return { success: true, message: 'Dat lich san thanh cong!', booking };
    }

    cancelBooking(bookingId: string, actorId: string): boolean {
        const booking = this.bookings.find((b) => b.id === bookingId);
        if (!booking) return false;

        booking.status = 'rejected';
        this.pushNotification(booking.homePlayerId, 'Lich san bi huy', `Lich dat san ${booking.courtName} vao luc ${booking.startTime} ngay ${booking.date} da bi huy.`);
        return true;
    }

    // --- TOURNAMENTS SECTION ---
    getTournaments(): Tournament[] {
        this.refreshAllTeamSubMatchHandicapTexts(false);
        return this.tournaments.map((t) => this.hydrateTournamentDerivedData(t));
    }

    createTournament(input: { name: string; type: TournamentType; startedAt: string; finishedAt?: string; location?: string; prizes?: TournamentPrize[] }): Tournament {
        const id = `t${(this.tournaments.length + 1).toString().padStart(2, '0')}`;
        const newTournament: Tournament = {
            id,
            version: 0,
            metadataVersion: 0,
            competitionVersion: 0,
            name: input.name,
            type: input.type,
            startedAt: input.startedAt,
            finishedAt: input.finishedAt || '',
            status: 'draft',
            participants: [],
            registrations: [],
            groupSize: 4,
            teamSize: 3,
            groups: [],
            scores: [],
            standings: [],
            stage: 'group',
            knockoutMatches: [],
            drawRules: { ...this.defaultDrawRules, seededPotRanges: this.defaultDrawRules.seededPotRanges.map((item) => ({ ...item })) },
            drawRevisionCurrent: 0,
            drawRevisions: [],
            seedOverrideHistory: [],
            drawDirty: false,
            location: input.location || '',
            prizes: input.prizes || [],
            format: 'group'
        };

        this.tournaments.push(newTournament);
        this.http.post<Tournament>(`${this.apiUrl}/tournaments`, newTournament).subscribe({
            next: (saved) => this.replaceLocalTournament(saved),
            error: (err) => console.error('Failed to create tournament on backend', err)
        });
        return newTournament;
    }

    deleteTournament(id: string): boolean {
        const idx = this.tournaments.findIndex((x) => x.id === id);
        if (idx === -1) return false;
        this.tournaments.splice(idx, 1);
        this.http.delete(`${this.apiUrl}/tournaments/${id}`).subscribe();
        return true;
    }

    updateTournament(id: string, input: { name: string; type: TournamentType; startedAt: string; finishedAt?: string; location?: string; prizes?: TournamentPrize[] }): boolean {
        const t = this.tournaments.find((x) => x.id === id);
        if (!t) return false;
        if (t.status !== 'draft') return false;
        t.name = input.name;
        t.type = input.type;
        t.startedAt = input.startedAt;
        t.finishedAt = input.finishedAt;
        t.location = input.location || '';
        t.prizes = input.prizes || [];
        this.syncTournamentToBackend(id);
        return true;
    }

    updateTournamentStructure(id: string, groupSize: number, teamSize: number, format: 'group' | 'round_robin'): void {
        const t = this.tournaments.find(x => x.id === id);
        if (t) {
            t.groupSize = groupSize;
            t.teamSize = teamSize;
            t.format = format;
            this.syncTournamentToBackend(id);
        }
    }

    getMemberRankStrength(pid: string, tournamentId?: string): number {
        const rank = tournamentId
            ? this.getTournamentRankTier(this.tournaments.find((item) => item.id === tournamentId), pid)
            : this.getMemberRankTier(pid);

        switch (rank) {
            case 'A0':
                return 10;
            case 'A1':
                return 9;
            case 'A2':
                return 8;
            case 'A3':
                return 7;
            case 'A4':
                return 6;
            case 'A5':
                return 5;
            case 'A6':
                return 4;
            default:
                return 5;
        }
    }

    private getOrderedParticipantIds(tournament: Tournament): string[] {
        if (tournament.registrations?.length) {
            return [...tournament.registrations]
                .sort((left, right) => left.seed - right.seed)
                .map((registration) => registration.memberId);
        }

        return [...(tournament.participants || [])];
    }

    private tryGenerateSeededTeams(tournament: Tournament): Team[] | null {
        if (!tournament.drawRules?.useSeededDraw || !(tournament.registrations?.length)) {
            return null;
        }

        const players = tournament.registrations
            .map((registration) => {
                const member = this.getMemberById(registration.memberId);
                return {
                    id: registration.memberId,
                    name: member?.fullName ?? registration.memberId,
                    seed: registration.seed,
                    gender: registration.genderSnapshot
                };
            })
            .sort((left, right) => left.seed - right.seed);

        const potRanges = tournament.drawRules.seededPotRanges.map((range) => ({ min: range.min, max: range.max }));
        return this.tournamentEngine.generateTeamsBySeedPots(players, tournament.teamSize ?? 3, potRanges, tournament.drawRules.maxFemalePerTeam);
    }

    private appendDrawRevision(tournament: Tournament, reason: string, actorId: string, status: 'committed' | 'dirty'): number {
        if (!tournament.drawRevisions) {
            tournament.drawRevisions = [];
        }

        const nextRevision = (tournament.drawRevisionCurrent || 0) + 1;
        const registrationSeedMap = new Map((tournament.registrations || []).map((item) => [item.memberId, item.seed]));
        const revision: TournamentDrawRevision = {
            revisionNo: nextRevision,
            createdAt: new Date().toISOString(),
            reason,
            actorId,
            status,
            teams: (tournament.teams || []).map((team) => {
                const memberIds = team.players.map((player) => player.id);
                const seedTotal = memberIds.reduce((sum, memberId) => sum + (registrationSeedMap.get(memberId) || 0), 0);
                return {
                    teamId: team.id,
                    teamName: team.name,
                    memberIds,
                    seedTotal
                };
            }),
            groups: (tournament.groups || []).map((group) => ({
                groupName: group.groupName,
                competitorIds: group.competitors.map((competitor) => competitor.id)
            }))
        };

        tournament.drawRevisions.push(revision);
        tournament.drawRevisionCurrent = nextRevision;
        tournament.drawDirty = status === 'dirty';
        return nextRevision;
    }

    generateTeamsForTournament(id: string): boolean {
        const t = this.tournaments.find((x) => x.id === id);
        if (!t || t.status !== 'draft') return false;

        this.ensureTournamentRegistrations(t);
        const participantIds = this.getOrderedParticipantIds(t);
        if (!participantIds.length) return false;

        const sourcePlayers = participantIds.map((pid) => {
            const member = this.getMemberById(pid);
            return { id: pid, name: member?.fullName ?? pid };
        });

        if (t.type === 'team') {
            const hasLockedSlots = (t.manualTeamSlots?.length ?? 0) > 0;
            if (hasLockedSlots) {
                // Hybrid: locked slots are team seeds, free pool is balanced via snake-draft
                t.teams = this.tournamentEngine.generateTeamsWithLockedSlots(
                    sourcePlayers,
                    t.teamSize ?? 3,
                    t.manualTeamSlots!,
                    t.captains || [],
                    (pid) => this.getMemberRankStrength(pid, t.id)
                );
                // Clear the manual slots after consuming them (they're baked into teams now)
                t.manualTeamSlots = [];
            } else {
                t.teams = this.tryGenerateSeededTeams(t) || this.tournamentEngine.generateTeamsWithCaptains(
                    sourcePlayers, t.teamSize ?? 3, t.captains || [],
                    (pid) => this.getMemberRankStrength(pid, t.id)
                );
            }
            this.syncTournamentToBackend(id);
            return true;
        } else if (t.type === 'double') {
            t.teams = this.tournamentEngine.generateRandomTeams(sourcePlayers, 2);
            this.syncTournamentToBackend(id);
            return true;
        }
        return false;
    }

    /** Clear all teams and manual slots, returning tournament to the slot-builder state */
    clearTeamsForTournament(tournamentId: string): boolean {
        const t = this.tournaments.find((x) => x.id === tournamentId);
        if (!t || t.status !== 'draft') return false;
        t.teams = [];
        t.manualTeamSlots = [];
        this.syncTournamentToBackend(tournamentId);
        return true;
    }

    /** Add a new empty manual team slot and return its generated ID */
    addManualTeamSlot(tournamentId: string): string | null {
        const t = this.tournaments.find((x) => x.id === tournamentId);
        if (!t || t.status !== 'draft' || (t.type !== 'team' && t.type !== 'double')) return null;
        if (!t.manualTeamSlots) t.manualTeamSlots = [];
        const slotId = `slot-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        t.manualTeamSlots.push({ slotId, memberIds: [] });
        return slotId;
    }

    /** Remove a manual team slot (players return to free pool) */
    removeManualTeamSlot(tournamentId: string, slotId: string): boolean {
        const t = this.tournaments.find((x) => x.id === tournamentId);
        if (!t?.manualTeamSlots) return false;
        const before = t.manualTeamSlots.length;
        t.manualTeamSlots = t.manualTeamSlots.filter(s => s.slotId !== slotId);
        return t.manualTeamSlots.length < before;
    }

    /** Toggle a member's presence in a specific slot (remove from other slots first) */
    togglePlayerInSlot(tournamentId: string, slotId: string, memberId: string): boolean {
        const t = this.tournaments.find((x) => x.id === tournamentId);
        if (!t?.manualTeamSlots) return false;
        const targetSlot = t.manualTeamSlots.find(s => s.slotId === slotId);
        if (!targetSlot) return false;

        const alreadyInTarget = targetSlot.memberIds.includes(memberId);
        if (alreadyInTarget) {
            // Remove from this slot
            targetSlot.memberIds = targetSlot.memberIds.filter(id => id !== memberId);
        } else {
            // Remove from any other slot first
            t.manualTeamSlots.forEach(s => {
                if (s.slotId !== slotId) {
                    s.memberIds = s.memberIds.filter(id => id !== memberId);
                }
            });
            targetSlot.memberIds.push(memberId);
        }
        return true;
    }

    /** Clear all manual team slots for a tournament */
    clearAllManualSlots(tournamentId: string): void {
        const t = this.tournaments.find((x) => x.id === tournamentId);
        if (t) t.manualTeamSlots = [];
    }

    /** Update the label of a manual team slot */
    renameManualTeamSlot(tournamentId: string, slotId: string, label: string): boolean {
        const t = this.tournaments.find((x) => x.id === tournamentId);
        const slot = t?.manualTeamSlots?.find(s => s.slotId === slotId);
        if (!slot) return false;
        slot.label = label;
        return true;
    }

    toggleCaptainForTournament(tournamentId: string, memberId: string): boolean {
        const t = this.tournaments.find((x) => x.id === tournamentId);
        if (!t) return false;
        if (!t.captains) {
            t.captains = [];
        }
        const idx = t.captains.indexOf(memberId);
        if (idx > -1) {
            t.captains.splice(idx, 1);
        } else {
            t.captains.push(memberId);
        }
        this.syncTournamentToBackend(tournamentId);
        return true;
    }

    drawTournament(id: string): boolean {
        const t = this.tournaments.find((x) => x.id === id);
        if (!t) return false;

        this.ensureTournamentRegistrations(t);
        const participantIds = this.getOrderedParticipantIds(t);
        if (!participantIds.length) return false;

        let competitors: Competitor[] = [];

        if (t.type === 'team' || t.type === 'double') {
            this.generateTeamsForTournament(id);
            competitors = (t.teams || []).map((team) => ({
                id: team.id,
                name: t.type === 'double'
                    ? `${team.players[0]?.name ?? 'N/A'} / ${team.players[1]?.name ?? 'N/A'}`
                    : team.name
            }));
        } else {
            competitors = participantIds.map((pid) => {
                const member = this.getMemberById(pid);
                return { id: pid, name: member?.fullName ?? pid };
            });
        }

        if (t.format === 'round_robin') {
            t.groups = [{ groupName: 'Vòng tròn', competitors }];
        } else {
            t.groups = this.tournamentEngine.generateRandomGroups(competitors, t.groupSize ?? 4);
        }

        t.scores = t.groups.flatMap((group) => {
            const matches = this.tournamentEngine.buildRoundRobinScores(group);
            // Initialize scores to 0-0 so user can enter scores manually
            return matches.map((m) => ({ ...m, homeScore: 0, awayScore: 0 }));
        });
        t.standings = this.tournamentEngine.computeGroupStandings(t.groups, t.scores);
        t.stage = 'group';
        t.knockoutMatches = [];
        t.status = 'ongoing';
        this.appendDrawRevision(t, 'Draw committed', this.loggedInUserId || 'system', 'committed');

        this.syncTournamentToBackend(id);
        return true;
    }

    resetTournamentDraw(id: string): boolean {
        const t = this.tournaments.find((x) => x.id === id);
        if (!t) return false;
        
        t.status = 'draft';
        t.groups = [];
        t.scores = [];
        t.standings = [];
        t.knockoutMatches = [];
        t.teams = [];
        t.stage = 'group';
        t.drawDirty = false;

        this.syncTournamentToBackend(id);
        return true;
    }

    rebuildTournamentDrawFromCurrentSeeds(tournamentId: string): boolean {
        const t = this.tournaments.find((item) => item.id === tournamentId);
        if (!t) {
            return false;
        }

        const hasCompletedGroupMatch = (t.scores || []).some((match) => !!match.completed);
        const hasCompletedKnockoutMatch = (t.knockoutMatches || []).some((match) => !!match.completed);

        if (hasCompletedGroupMatch || hasCompletedKnockoutMatch) {
            return false;
        }

        t.groups = [];
        t.scores = [];
        t.standings = [];
        t.knockoutMatches = [];
        t.teams = [];
        t.stage = 'group';
        t.status = 'draft';

        const drawSuccess = this.drawTournament(tournamentId);
        if (!drawSuccess) {
            return false;
        }

        t.drawDirty = false;
        this.logAction(this.loggedInUserId || 'system', 'Rebuild draw from current seeds', `Tournament ${t.name}`, 'Rebuild after seed updates');
        this.syncTournamentToBackend(tournamentId);
        return true;
    }

    saveTournamentMatchScore(tournamentId: string, groupName: string, homeId: string, awayId: string, homeScore: number, awayScore: number, setScores?: { home: number; away: number }[]): boolean {
        const t = this.tournaments.find((x) => x.id === tournamentId);
        if (!t || !t.scores || !t.groups) return false;

        const scoreObj = t.scores.find(
            (s) => s.groupName === groupName && s.homeCompetitorId === homeId && s.awayCompetitorId === awayId
        );

        if (!scoreObj) return false;

        scoreObj.homeScore = homeScore;
        scoreObj.awayScore = awayScore;
        scoreObj.completed = true;
        if (setScores) {
            scoreObj.setScores = setScores;
        }

        t.standings = this.tournamentEngine.computeGroupStandings(t.groups, t.scores);
        this.postTournamentMatchResult(tournamentId, '/matches/group/result', {
            groupName,
            homeCompetitorId: homeId,
            awayCompetitorId: awayId,
            homeScore,
            awayScore,
            setScores: setScores || [],
            recordedById: this.loggedInUserId || undefined
        });
        return true;
    }

    private normalizeRankForHandicap(rank: string): RankTier {
        return this.normalizeRankTier(rank);
    }

    private getDoublePointByRank(rank: string): number {
        const normalized = this.normalizeRankForHandicap(rank);
        const pointMap: Record<'A0' | 'A1' | 'A2' | 'A3' | 'A4' | 'A5' | 'A6', number> = {
            A0: 0,
            A1: 1,
            A2: 2,
            A3: 3,
            A4: 4,
            A5: 5,
            A6: 6
        };
        return pointMap[normalized];
    }

    getSingleHandicap(rank1: string, rank2: string): string {
        const r1 = this.normalizeRankForHandicap(rank1);
        const r2 = this.normalizeRankForHandicap(rank2);

        if (r1 === r2) {
            return 'Đánh ngang';
        }

        const rankOrder: Array<'A0' | 'A1' | 'A2' | 'A3' | 'A4' | 'A5' | 'A6'> = ['A0', 'A1', 'A2', 'A3', 'A4', 'A5', 'A6'];
        const idx1 = rankOrder.indexOf(r1);
        const idx2 = rankOrder.indexOf(r2);

        const isHomeStronger = idx1 < idx2;
        const stronger = isHomeStronger ? r1 : r2;
        const weaker = isHomeStronger ? r2 : r1;

        const singleHandicapTable: Record<string, Record<string, string>> = {
            A0: { A1: '3', A2: '3-4-3-4-3', A3: '4', A4: '5', A5: '6', A6: '6-7-6-7-6' },
            A1: { A2: '2', A3: '3', A4: '4', A5: '4-5-4-5-4', A6: '5' },
            A2: { A3: '2', A4: '3', A5: '4', A6: '4-5-4-5-4' },
            A3: { A4: '2', A5: '3', A6: '3-4-3-4-3' },
            A4: { A5: '2-0-2-0-2', A6: '2' },
            A5: { A6: '2-0-2-0-2' }
        };

        const handicap = singleHandicapTable[stronger]?.[weaker];
        if (!handicap) {
            return 'Đánh ngang';
        }
        return isHomeStronger ? `Bên A chấp ${handicap}` : `Bên B chấp ${handicap}`;
    }

    getDoubleHandicap(players1: string[], players2: string[]): string {
        const getPlayerPoints = (pid: string) => {
            const p = this.getMemberById(pid);
            if (!p) return 5;
            return this.getDoublePointByRank(p.rankTier);
        };

        const score1 = players1.reduce((sum, pid) => sum + getPlayerPoints(pid), 0);
        const score2 = players2.reduce((sum, pid) => sum + getPlayerPoints(pid), 0);

        if (score1 === score2) {
            return 'Đánh ngang';
        }

        const diff = Math.abs(score1 - score2);

        const doubleHandicapTable: Record<number, string> = {
            1: '0-2-0-2-0',
            2: '2 quả đều',
            3: '2-3-2-3-2',
            4: '3 quả đều',
            5: '3-4-3-4-3',
            6: '4 quả đều'
        };

        const handicap = doubleHandicapTable[Math.min(diff, 6)] || '4 quả đều';
        const isHomeStronger = score1 < score2;
        return isHomeStronger ? `Bên A chấp ${handicap}` : `Bên B chấp ${handicap}`;
    }

    saveTeamMatchLineup(tournamentId: string, isKnockout: boolean, matchId: string, lineup: TeamLineup): boolean {
        const t = this.tournaments.find((x) => x.id === tournamentId);
        if (!t) return false;

        const match = isKnockout
            ? t.knockoutMatches?.find(m => m.id === matchId)
            : t.scores?.find(m => `${m.groupName}-${m.homeCompetitorId}-${m.awayCompetitorId}` === matchId);

        if (!match) return false;

        match.lineup = lineup;

        const getPlayerRank = (pid: string): RankTier => this.getTournamentRankTier(t, pid);

        const isHomeABC = lineup.isHomeABC !== false;

        const aId = lineup.aPlayerId;
        const bId = lineup.bPlayerId;
        const cId = lineup.cPlayerId;
        const xId = lineup.xPlayerId;
        const yId = lineup.yPlayerId;
        const zId = lineup.zPlayerId;

        const doubleHandicap = this.getDoubleHandicapFromRanks([getPlayerRank(bId), getPlayerRank(cId)], [getPlayerRank(yId), getPlayerRank(zId)]);
        const handicapA_X = this.getSingleHandicap(getPlayerRank(aId), getPlayerRank(xId));
        const handicapC_Z = this.getSingleHandicap(getPlayerRank(cId), getPlayerRank(zId));
        const handicapA_Y = this.getSingleHandicap(getPlayerRank(aId), getPlayerRank(yId));
        const handicapB_X = this.getSingleHandicap(getPlayerRank(bId), getPlayerRank(xId));

        match.subMatches = [
            {
                matchType: 'double',
                label: `Trận 1: Đôi BC vs Đôi YZ`,
                homePlayers: isHomeABC ? [bId, cId] : [yId, zId],
                awayPlayers: isHomeABC ? [yId, zId] : [bId, cId],
                homeScore: 0,
                awayScore: 0,
                completed: false,
                handicapText: doubleHandicap
            },
            {
                matchType: 'single',
                label: `Trận 2: Đơn A vs Đơn X`,
                homePlayers: isHomeABC ? [aId] : [xId],
                awayPlayers: isHomeABC ? [xId] : [aId],
                homeScore: 0,
                awayScore: 0,
                completed: false,
                handicapText: handicapA_X
            },
            {
                matchType: 'single',
                label: `Trận 3: Đơn C vs Đơn Z`,
                homePlayers: isHomeABC ? [cId] : [zId],
                awayPlayers: isHomeABC ? [zId] : [cId],
                homeScore: 0,
                awayScore: 0,
                completed: false,
                handicapText: handicapC_Z
            },
            {
                matchType: 'single',
                label: `Trận 4: Đơn A vs Đơn Y`,
                homePlayers: isHomeABC ? [aId] : [yId],
                awayPlayers: isHomeABC ? [yId] : [aId],
                homeScore: 0,
                awayScore: 0,
                completed: false,
                handicapText: handicapA_Y
            },
            {
                matchType: 'single',
                label: `Trận 5: Đơn B vs Đơn X`,
                homePlayers: isHomeABC ? [bId] : [xId],
                awayPlayers: isHomeABC ? [xId] : [bId],
                homeScore: 0,
                awayScore: 0,
                completed: false,
                handicapText: handicapB_X
            }
        ];

        match.homeScore = 0;
        match.awayScore = 0;
        match.completed = false;
        match.setScores = [];
        if (isKnockout) {
            (match as KnockoutMatch).winnerId = undefined;
        }

        this.postTournamentMatchResult(tournamentId, '/matches/team-lineup/result', {
            knockout: isKnockout,
            matchId,
            lineup,
            subMatches: match.subMatches || [],
            recordedById: this.loggedInUserId || undefined
        });
        return true;
    }

    saveTeamSubMatchScore(tournamentId: string, isKnockout: boolean, matchId: string, subMatchIdx: number, homeSets: number, awaySets: number, setScores?: { home: number; away: number }[]): boolean {
        const t = this.tournaments.find((x) => x.id === tournamentId);
        if (!t) return false;

        const match = isKnockout
            ? t.knockoutMatches?.find(m => m.id === matchId)
            : t.scores?.find(m => `${m.groupName}-${m.homeCompetitorId}-${m.awayCompetitorId}` === matchId);

        if (!match || !match.subMatches || !match.subMatches[subMatchIdx]) return false;

        const sub = match.subMatches[subMatchIdx];
        sub.homeScore = homeSets;
        sub.awayScore = awaySets;
        sub.completed = true;
        if (setScores) {
            sub.setScores = setScores;
        }

        let homeWins = 0;
        let awayWins = 0;

        for (const subM of match.subMatches) {
            if (subM.completed) {
                if (subM.homeScore > subM.awayScore) homeWins++;
                else if (subM.awayScore > subM.homeScore) awayWins++;
            }
        }

        match.homeScore = homeWins;
        match.awayScore = awayWins;
        match.completed = (homeWins >= 3 || awayWins >= 3);

        if (isKnockout) {
            const km = match as KnockoutMatch;
            if (homeWins >= 3) {
                km.winnerId = km.homeCompetitorId;
            } else if (awayWins >= 3) {
                km.winnerId = km.awayCompetitorId;
            }
            this.autoCheckAndGenerateFinal(t);
        } else {
            t.standings = this.tournamentEngine.computeGroupStandings(t.groups || [], t.scores || []);
        }

        this.postTournamentMatchResult(tournamentId, '/matches/team-sub/result', {
            knockout: isKnockout,
            matchId,
            subMatchIdx,
            homeScore: homeSets,
            awayScore: awaySets,
            setScores: setScores || [],
            recordedById: this.loggedInUserId || undefined
        });
        return true;
    }

    generateKnockoutStage(tournamentId: string): boolean {
        const t = this.tournaments.find((x) => x.id === tournamentId);
        if (!t || !t.standings || t.standings.length === 0) return false;

        const allQualified = this.tournamentEngine.pickQualified(t.standings, 2);
        if (allQualified.length === 2) {
            t.knockoutMatches = [
                {
                    id: 'f-1',
                    roundName: 'Finals',
                    homeCompetitorId: allQualified[0].competitor.id,
                    awayCompetitorId: allQualified[1].competitor.id,
                    homeScore: 0,
                    awayScore: 0
                }
            ];
        } else if (allQualified.length >= 4) {
            const groupA = t.standings.find(s => s.groupName === 'A');
            const groupB = t.standings.find(s => s.groupName === 'B');
            if (groupA && groupB && groupA.rows.length >= 2 && groupB.rows.length >= 2) {
                const a1 = groupA.rows.find(r => r.rank === 1)?.competitor.id;
                const a2 = groupA.rows.find(r => r.rank === 2)?.competitor.id;
                const b1 = groupB.rows.find(r => r.rank === 1)?.competitor.id;
                const b2 = groupB.rows.find(r => r.rank === 2)?.competitor.id;

                t.knockoutMatches = [
                    {
                        id: 'sf-1',
                        roundName: 'Semifinals',
                        homeCompetitorId: a1!,
                        awayCompetitorId: b2!,
                        homeScore: 0,
                        awayScore: 0
                    },
                    {
                        id: 'sf-2',
                        roundName: 'Semifinals',
                        homeCompetitorId: b1!,
                        awayCompetitorId: a2!,
                        homeScore: 0,
                        awayScore: 0
                    }
                ];
            } else {
                t.knockoutMatches = [
                    {
                        id: 'sf-1',
                        roundName: 'Semifinals',
                        homeCompetitorId: allQualified[0].competitor.id,
                        awayCompetitorId: allQualified[3].competitor.id,
                        homeScore: 0,
                        awayScore: 0
                    },
                    {
                        id: 'sf-2',
                        roundName: 'Semifinals',
                        homeCompetitorId: allQualified[1].competitor.id,
                        awayCompetitorId: allQualified[2].competitor.id,
                        homeScore: 0,
                        awayScore: 0
                    }
                ];
            }
        } else {
            return false;
        }

        t.stage = 'knockout';
        this.postTournamentMatchResult(tournamentId, '/stage/knockout/start', {
            recordedById: this.loggedInUserId || undefined
        });
        return true;
    }

    saveKnockoutMatchScore(tournamentId: string, matchId: string, homeScore: number, awayScore: number, setScores?: { home: number; away: number }[]): boolean {
        const t = this.tournaments.find((x) => x.id === tournamentId);
        if (!t || !t.knockoutMatches) return false;

        const match = t.knockoutMatches.find(m => m.id === matchId);
        if (!match) return false;

        match.homeScore = homeScore;
        match.awayScore = awayScore;
        match.completed = true;
        if (setScores) {
            match.setScores = setScores;
        }

        if (homeScore > awayScore) {
            match.winnerId = match.homeCompetitorId;
        } else if (awayScore > homeScore) {
            match.winnerId = match.awayCompetitorId;
        } else {
            match.winnerId = undefined;
        }
        this.autoCheckAndGenerateFinal(t);
        this.postTournamentMatchResult(tournamentId, '/matches/knockout/result', {
            matchId,
            homeScore,
            awayScore,
            setScores: setScores || [],
            recordedById: this.loggedInUserId || undefined
        });
        return true;
    }

    generateFinalMatch(tournamentId: string): boolean {
        const t = this.tournaments.find((x) => x.id === tournamentId);
        if (!t || !t.knockoutMatches) return false;

        const sf1 = t.knockoutMatches.find(m => m.id === 'sf-1');
        const sf2 = t.knockoutMatches.find(m => m.id === 'sf-2');

        if (!sf1 || !sf1.winnerId || !sf2 || !sf2.winnerId) return false;

        let finalMatch = t.knockoutMatches.find(m => m.id === 'f-1');
        if (!finalMatch) {
            t.knockoutMatches.push({
                id: 'f-1',
                roundName: 'Finals',
                homeCompetitorId: sf1.winnerId,
                awayCompetitorId: sf2.winnerId,
                homeScore: 0,
                awayScore: 0
            });
        } else {
            finalMatch.homeCompetitorId = sf1.winnerId;
            finalMatch.awayCompetitorId = sf2.winnerId;
        }

        const loser1 = sf1.winnerId === sf1.homeCompetitorId ? sf1.awayCompetitorId : sf1.homeCompetitorId;
        const loser2 = sf2.winnerId === sf2.homeCompetitorId ? sf2.awayCompetitorId : sf2.homeCompetitorId;

        let bronzeMatch = t.knockoutMatches.find(m => m.id === '3rd-1');
        if (!bronzeMatch) {
            t.knockoutMatches.push({
                id: '3rd-1',
                roundName: 'Bronze',
                homeCompetitorId: loser1,
                awayCompetitorId: loser2,
                homeScore: 0,
                awayScore: 0
            });
        } else {
            bronzeMatch.homeCompetitorId = loser1;
            bronzeMatch.awayCompetitorId = loser2;
        }

        this.postTournamentMatchResult(tournamentId, '/status/finish', {
            recordedById: this.loggedInUserId || undefined
        });
        return true;
    }

    autoCheckAndGenerateFinal(t: Tournament, sync: boolean = false): void {
        if (!t || !t.knockoutMatches || t.knockoutMatches.length === 0) return;
        const semifinals = t.knockoutMatches.filter(m => m.roundName === 'Semifinals');
        if (semifinals.length === 2 && semifinals.every(m => m.winnerId !== undefined)) {
            const sf1 = semifinals.find(m => m.id === 'sf-1');
            const sf2 = semifinals.find(m => m.id === 'sf-2');
            if (sf1 && sf1.winnerId && sf2 && sf2.winnerId) {
                let modified = false;
                let finalMatch = t.knockoutMatches.find(m => m.id === 'f-1');
                if (!finalMatch) {
                    t.knockoutMatches.push({
                        id: 'f-1',
                        roundName: 'Finals',
                        homeCompetitorId: sf1.winnerId,
                        awayCompetitorId: sf2.winnerId,
                        homeScore: 0,
                        awayScore: 0
                    });
                    modified = true;
                } else if (finalMatch.homeCompetitorId !== sf1.winnerId || finalMatch.awayCompetitorId !== sf2.winnerId) {
                    finalMatch.homeCompetitorId = sf1.winnerId;
                    finalMatch.awayCompetitorId = sf2.winnerId;
                    modified = true;
                }

                const loser1 = sf1.winnerId === sf1.homeCompetitorId ? sf1.awayCompetitorId : sf1.homeCompetitorId;
                const loser2 = sf2.winnerId === sf2.homeCompetitorId ? sf2.awayCompetitorId : sf2.homeCompetitorId;

                let bronzeMatch = t.knockoutMatches.find(m => m.id === '3rd-1');
                if (!bronzeMatch) {
                    t.knockoutMatches.push({
                        id: '3rd-1',
                        roundName: 'Bronze',
                        homeCompetitorId: loser1,
                        awayCompetitorId: loser2,
                        homeScore: 0,
                        awayScore: 0
                    });
                    modified = true;
                } else if (bronzeMatch.homeCompetitorId !== loser1 || bronzeMatch.awayCompetitorId !== loser2) {
                    bronzeMatch.homeCompetitorId = loser1;
                    bronzeMatch.awayCompetitorId = loser2;
                    modified = true;
                }

                if (modified && sync) {
                    this.syncTournamentToBackend(t.id);
                }
            }
        }
    }

    deleteTeamSubMatchScore(tournamentId: string, isKnockout: boolean, matchId: string, subMatchIdx: number): boolean {
        const t = this.tournaments.find((x) => x.id === tournamentId);
        if (!t) return false;

        const match = isKnockout
            ? t.knockoutMatches?.find(m => m.id === matchId)
            : t.scores?.find(m => `${m.groupName}-${m.homeCompetitorId}-${m.awayCompetitorId}` === matchId);

        if (!match || !match.subMatches || !match.subMatches[subMatchIdx]) return false;

        const sub = match.subMatches[subMatchIdx];
        sub.homeScore = 0;
        sub.awayScore = 0;
        sub.completed = false;
        sub.setScores = [];

        let homeWins = 0;
        let awayWins = 0;

        for (const subM of match.subMatches) {
            if (subM.completed) {
                if (subM.homeScore > subM.awayScore) homeWins++;
                else if (subM.awayScore > subM.homeScore) awayWins++;
            }
        }

        match.homeScore = homeWins;
        match.awayScore = awayWins;
        match.completed = (homeWins >= 3 || awayWins >= 3);

        if (isKnockout) {
            const km = match as KnockoutMatch;
            if (match.completed) {
                km.winnerId = homeWins >= 3 ? km.homeCompetitorId : km.awayCompetitorId;
            } else {
                km.winnerId = undefined;
                this.deleteDependentMatches(t, matchId);
            }
        } else {
            t.standings = this.tournamentEngine.computeGroupStandings(t.groups || [], t.scores || []);
        }

        this.postTournamentMatchResult(tournamentId, '/matches/team-sub/clear', {
            knockout: isKnockout,
            matchId,
            subMatchIdx,
            recordedById: this.loggedInUserId || undefined
        });
        return true;
    }

    deleteKnockoutMatchScore(tournamentId: string, matchId: string): boolean {
        const t = this.tournaments.find((x) => x.id === tournamentId);
        if (!t || !t.knockoutMatches) return false;

        const match = t.knockoutMatches.find(m => m.id === matchId);
        if (!match) return false;

        match.homeScore = 0;
        match.awayScore = 0;
        match.completed = false;
        match.winnerId = undefined;
        match.setScores = [];

        this.deleteDependentMatches(t, matchId);

        this.postTournamentMatchResult(tournamentId, '/matches/knockout/clear', {
            matchId,
            recordedById: this.loggedInUserId || undefined
        });
        return true;
    }

    deleteTournamentMatchScore(tournamentId: string, groupName: string, homeCompetitorId: string, awayCompetitorId: string): boolean {
        const t = this.tournaments.find((x) => x.id === tournamentId);
        if (!t || !t.scores) return false;

        const match = t.scores.find(m => m.groupName === groupName && m.homeCompetitorId === homeCompetitorId && m.awayCompetitorId === awayCompetitorId);
        if (!match) return false;

        match.homeScore = 0;
        match.awayScore = 0;
        match.completed = false;
        match.setScores = [];

        t.standings = this.tournamentEngine.computeGroupStandings(t.groups || [], t.scores || []);

        this.postTournamentMatchResult(tournamentId, '/matches/group/clear', {
            groupName,
            homeCompetitorId,
            awayCompetitorId,
            recordedById: this.loggedInUserId || undefined
        });
        return true;
    }

    private deleteDependentMatches(t: Tournament, changedMatchId: string): void {
        if ((changedMatchId === 'sf-1' || changedMatchId === 'sf-2') && t.knockoutMatches) {
            t.knockoutMatches = t.knockoutMatches.filter(m => m.id !== 'f-1' && m.id !== '3rd-1');
        }
    }

    finishTournament(tournamentId: string): boolean {
        const t = this.tournaments.find((x) => x.id === tournamentId);
        if (!t) return false;

        t.status = 'finished';
        t.finishedAt = new Date().toISOString().split('T')[0];

        // Award default achievements
        if (t.knockoutMatches && t.knockoutMatches.length > 0) {
            const finalMatch = t.knockoutMatches.find(m => m.id === 'f-1');
            if (finalMatch && finalMatch.winnerId) {
                const winnerId = finalMatch.winnerId;
                const runnerUpId = finalMatch.winnerId === finalMatch.homeCompetitorId ? finalMatch.awayCompetitorId : finalMatch.homeCompetitorId;

                // Award to winner
                if (!winnerId.startsWith('team-') && !winnerId.startsWith('double-')) {
                    this.participations.push({
                        tournamentId: t.id,
                        memberId: winnerId,
                        resultLabel: 'Champion'
                    });
                    this.pushNotification(winnerId, 'Chúc mừng Vô địch!', `Bạn đã giành chức vô địch giải đấu ${t.name}! 🎉`);
                } else {
                    const groupCompetitors = t.groups?.flatMap(g => g.competitors) || [];
                    const comp = groupCompetitors.find(c => c.id === winnerId);
                    if (comp) {
                        t.participants?.forEach(pid => {
                            const member = this.getMemberById(pid);
                            if (comp.name.includes(member?.fullName || '')) {
                                this.participations.push({
                                    tournamentId: t.id,
                                    memberId: pid,
                                    resultLabel: 'Champion'
                                });
                                this.pushNotification(pid, 'Chúc mừng Vô địch!', `Bạn cùng đồng đội đã giành chức vô địch giải đấu ${t.name}! 🎉`);
                            }
                        });
                    }
                }

                // Award to runner-up
                if (!runnerUpId.startsWith('team-') && !runnerUpId.startsWith('double-')) {
                    this.participations.push({
                        tournamentId: t.id,
                        memberId: runnerUpId,
                        resultLabel: 'Runner-up'
                    });
                    this.pushNotification(runnerUpId, 'Hạng nhì giải đấu!', `Chúc mừng bạn đã giành hạng nhì giải đấu ${t.name}! 🥈`);
                } else {
                    const groupCompetitors = t.groups?.flatMap(g => g.competitors) || [];
                    const comp = groupCompetitors.find(c => c.id === runnerUpId);
                    if (comp) {
                        t.participants?.forEach(pid => {
                            const member = this.getMemberById(pid);
                            if (comp.name.includes(member?.fullName || '')) {
                                this.participations.push({
                                    tournamentId: t.id,
                                    memberId: pid,
                                    resultLabel: 'Runner-up'
                                });
                                this.pushNotification(pid, 'Hạng nhì giải đấu!', `Chúc mừng bạn và đồng đội đã giành hạng nhì giải đấu ${t.name}! 🥈`);
                            }
                        });
                    }
                }
            }
        } else if (t.standings && t.standings.length > 0) {
            const topRows = this.tournamentEngine.pickQualified(t.standings, 1);
            topRows.forEach((row) => {
                if (t.type === 'single') {
                    this.participations.push({
                        tournamentId: t.id,
                        memberId: row.competitor.id,
                        resultLabel: 'Champion'
                    });
                    this.pushNotification(row.competitor.id, 'Chúc mừng Vô địch!', `Bạn đã giành chức vô địch giải ${t.name}!`);
                }
            });
        }

        this.syncTournamentToBackend(tournamentId);
        return true;
    }

    registerPlayerForTournament(tournamentId: string, memberId: string): boolean {
        const t = this.tournaments.find((x) => x.id === tournamentId);
        if (!t || t.status !== 'draft') return false;

        this.ensureTournamentRegistrations(t);

        if (!t.participants) {
            t.participants = [];
        }

        if (!t.registrations) {
            t.registrations = [];
        }

        if (!t.participants.includes(memberId)) {
            t.participants.push(memberId);

            if (!t.registrations.some((registration) => registration.memberId === memberId)) {
                const nextSeed = this.nextSeedValue(t.registrations);
                t.registrations.push(this.buildTournamentRegistration(memberId, nextSeed));
            }

            this.pushNotification(memberId, 'Đăng ký giải đấu thành công', `Bạn đã đăng ký tham gia giải đấu ${t.name} thành công. 🎉`);
            this.logAction(memberId, 'Đăng ký giải đấu', `Đăng ký tham gia giải ${t.name} (ID: ${t.id})`, 'Tự đăng ký');
            this.syncTournamentToBackend(tournamentId);
            return true;
        }
        return false;
    }

    /** Register multiple players at once and sync only once at the end (avoids race condition) */
    batchRegisterPlayersForTournament(tournamentId: string, memberIds: string[]): number {
        const t = this.tournaments.find((x) => x.id === tournamentId);
        if (!t || t.status !== 'draft') return 0;

        this.ensureTournamentRegistrations(t);
        if (!t.participants) t.participants = [];
        if (!t.registrations) t.registrations = [];

        let added = 0;
        for (const memberId of memberIds) {
            if (!t.participants.includes(memberId)) {
                t.participants.push(memberId);
                if (!t.registrations.some((r) => r.memberId === memberId)) {
                    const nextSeed = this.nextSeedValue(t.registrations);
                    t.registrations.push(this.buildTournamentRegistration(memberId, nextSeed));
                }
                this.pushNotification(memberId, 'Đăng ký giải đấu thành công', `Bạn đã đăng ký tham gia giải đấu ${t.name} thành công. 🎉`);
                this.logAction(memberId, 'Đăng ký giải đấu', `Đăng ký tham gia giải ${t.name} (ID: ${t.id})`, 'Tự đăng ký');
                added++;
            }
        }

        // Sync ONCE after all players are added locally — avoids race condition
        if (added > 0) {
            this.syncTournamentToBackend(tournamentId);
        }
        return added;
    }


    getTournamentRegistrations(tournamentId: string): TournamentRegistration[] {
        const tournament = this.tournaments.find((item) => item.id === tournamentId);
        if (!tournament) {
            return [];
        }

        this.ensureTournamentRegistrations(tournament);
        return (tournament.registrations || []).map((item) => ({ ...item }));
    }

    importRegistrations(tournamentId: string, items: Array<{ memberId: string; seed?: number }>): import('rxjs').Observable<any> {
        return this.http.post<any>(`${this.apiUrl}/tournaments/${tournamentId}/registrations/import`, items);
    }

    assessSeedImpact(tournamentId: string, memberId: string, newSeed: number): import('rxjs').Observable<any> {
        return this.http.post<any>(`${this.apiUrl}/tournaments/${tournamentId}/draw/assess-seed-impact`, { memberId, newSeed });
    }

    reloadTournamentFromServer(tournamentId: string): void {
        this.http.get<Tournament>(`${this.apiUrl}/tournaments/${tournamentId}`).subscribe({
            next: (fresh) => this.replaceLocalTournament(fresh),
            error: (err) => console.error('Failed to reload tournament from server', err)
        });
    }

    overrideTournamentSeed(tournamentId: string, memberId: string, newSeed: number, reason: string, actorId: string): boolean {
        const t = this.tournaments.find((item) => item.id === tournamentId);
        if (!t || newSeed <= 0) {
            return false;
        }

        this.ensureTournamentRegistrations(t);
        const registrations = t.registrations || [];
        const target = registrations.find((item) => item.memberId === memberId);
        if (!target) {
            return false;
        }

        const duplicate = registrations.find((item) => item.memberId !== memberId && item.seed === newSeed);
        if (duplicate) {
            return false;
        }

        const oldSeed = target.seed;
        if (oldSeed === newSeed) {
            return true;
        }

        // Optimistic local update
        target.seed = newSeed;
        target.seedSource = 'manual';

        const payload = {
            newSeed,
            reason,
            actorId,
            expectedRegistrationVersion: t.registrationVersion
        };

        this.http.patch<any>(`${this.apiUrl}/tournaments/${tournamentId}/registrations/${memberId}/seed`, payload).subscribe({
            next: (res) => {
                this.reloadTournamentFromServer(tournamentId);
            },
            error: (err) => {
                console.error('Failed to override seed on server', err);
                this.reloadTournamentFromServer(tournamentId);
            }
        });

        return true;
    }

    /** Batch-reorder seeds for all participants in one shot (used for drag-and-drop seed reorder).
     *  memberIdOrder is an array of member IDs in the desired seed order (index 0 -> seed 1, etc.)
     */
    batchReorderSeeds(tournamentId: string, memberIdOrder: string[]): boolean {
        const t = this.tournaments.find((x) => x.id === tournamentId);
        if (!t || t.status !== 'draft' || !t.registrations) return false;
        // Apply locally
        this.applySeedOrder(t, memberIdOrder);
        // Store as pending so replaceLocalTournament re-applies it if an old server response arrives first
        this.pendingSeedOrder.set(tournamentId, [...memberIdOrder]);
        this.syncTournamentToBackend(tournamentId);
        return true;
    }

    removePlayerFromTournament(tournamentId: string, memberId: string): boolean {
        const t = this.tournaments.find((x) => x.id === tournamentId);
        if (!t || t.status !== 'draft') return false;

        this.ensureTournamentRegistrations(t);

        if (t.participants && t.participants.includes(memberId)) {
            t.participants = t.participants.filter(pid => pid !== memberId);
            t.registrations = (t.registrations || []).filter((registration) => registration.memberId !== memberId);
            
            // Clear teams/groups to avoid inconsistent draft states
            t.teams = [];
            t.groups = [];
            t.scores = [];
            t.standings = [];
            t.knockoutMatches = [];
            t.captains = t.captains?.filter(cid => cid !== memberId) || [];

            this.pushNotification(memberId, 'Hủy đăng ký giải đấu', `Bạn đã hủy đăng ký tham gia giải đấu ${t.name}.`);
            this.logAction(memberId, 'Hủy đăng ký giải đấu', `Hủy đăng ký tham gia giải ${t.name} (ID: ${t.id})`, 'Tự hủy đăng ký');
            this.syncTournamentToBackend(tournamentId);
            return true;
        }
        return false;
    }

    withdrawPlayerFromOngoing(tournamentId: string, memberId: string): boolean {
        const t = this.tournaments.find((x) => x.id === tournamentId);
        if (!t || t.status !== 'ongoing') return false;

        this.ensureTournamentRegistrations(t);

        // 1. Remove from participants and captains
        t.participants = t.participants?.filter(pid => pid !== memberId) || [];
        t.registrations = (t.registrations || []).filter((registration) => registration.memberId !== memberId);
        t.captains = t.captains?.filter(pid => pid !== memberId) || [];

        // 2. Remove from team roster
        if (t.teams) {
            t.teams.forEach(team => {
                team.players = team.players.filter(p => p.id !== memberId);
            });
        }

        this.pushNotification(memberId, 'Rút khỏi giải đấu', `Bạn đã rút khỏi giải đấu ${t.name}.`);
        this.logAction(memberId, 'Rút khỏi giải đấu', `Rút khỏi giải đấu ${t.name} (ID: ${t.id})`, 'Admin thực hiện');
        this.postTournamentMatchResult(tournamentId, '/participants/withdraw', {
            memberId,
            recordedById: this.loggedInUserId || undefined
        });
        return true;
    }

    movePlayerBetweenTeams(tournamentId: string, fromTeamId: string, toTeamId: string, playerId: string): boolean {
        const t = this.tournaments.find((x) => x.id === tournamentId);
        if (!t || t.type !== 'team' || !t.teams?.length) return false;
        if (fromTeamId === toTeamId) return false;

        const fromTeam = t.teams.find(team => team.id === fromTeamId);
        const toTeam = t.teams.find(team => team.id === toTeamId);
        if (!fromTeam || !toTeam) return false;

        const teamSize = t.teamSize || 3;
        if (toTeam.players.length >= teamSize) return false;

        const player = fromTeam.players.find(p => p.id === playerId);
        if (!player) return false;
        if (toTeam.players.some(p => p.id === playerId)) return false;

        fromTeam.players = fromTeam.players.filter(p => p.id !== playerId);
        toTeam.players.push(player);

        const touchedTeamIds = new Set<string>([fromTeamId, toTeamId]);
        (t.scores || []).forEach(match => {
            if (touchedTeamIds.has(match.homeCompetitorId) || touchedTeamIds.has(match.awayCompetitorId)) {
                match.lineup = undefined;
                match.subMatches = undefined;
            }
        });
        (t.knockoutMatches || []).forEach(match => {
            if (touchedTeamIds.has(match.homeCompetitorId) || touchedTeamIds.has(match.awayCompetitorId)) {
                match.lineup = undefined;
                match.subMatches = undefined;
            }
        });

        this.postTournamentMatchResult(tournamentId, '/teams/move-player', {
            fromTeamId,
            toTeamId,
            playerId,
            recordedById: this.loggedInUserId || undefined
        });
        return true;
    }

    moveCompetitorBetweenGroups(tournamentId: string, fromGroupName: string, toGroupName: string, competitorId: string): boolean {
        const t = this.tournaments.find((x) => x.id === tournamentId);
        if (!t || !t.groups?.length || t.status !== 'ongoing') return false;
        if (fromGroupName === toGroupName) return false;

        const fromGroup = t.groups.find(g => g.groupName === fromGroupName);
        const toGroup = t.groups.find(g => g.groupName === toGroupName);
        if (!fromGroup || !toGroup) return false;

        const competitor = fromGroup.competitors.find(c => c.id === competitorId);
        if (!competitor) return false;
        if (toGroup.competitors.some(c => c.id === competitorId)) return false;

        fromGroup.competitors = fromGroup.competitors.filter(c => c.id !== competitorId);
        toGroup.competitors.push(competitor);

        this.recreateGroupStageMatchesFromExistingGroups(t);
        this.postTournamentMatchResult(tournamentId, '/groups/move-competitor', {
            fromGroupName,
            toGroupName,
            competitorId,
            recordedById: this.loggedInUserId || undefined
        });
        return true;
    }

    rebuildGroupScheduleFromCurrentGroups(tournamentId: string): boolean {
        const t = this.tournaments.find((x) => x.id === tournamentId);
        if (!t || !t.groups?.length) return false;
        this.recreateGroupStageMatchesFromExistingGroups(t);
        this.postTournamentMatchResult(tournamentId, '/groups/rebuild-schedule', {
            recordedById: this.loggedInUserId || undefined
        });
        return true;
    }

    private recreateGroupStageMatchesFromExistingGroups(t: Tournament): void {
        if (!t.groups || t.groups.length === 0) {
            t.scores = [];
            t.standings = [];
            t.knockoutMatches = [];
            t.stage = 'group';
            return;
        }

        t.scores = t.groups.flatMap((group) => {
            const matches = this.tournamentEngine.buildRoundRobinScores(group);
            return matches.map((m) => ({ ...m, homeScore: 0, awayScore: 0, completed: false }));
        });
        t.standings = this.tournamentEngine.computeGroupStandings(t.groups, t.scores);
        t.stage = 'group';
        t.knockoutMatches = [];
    }

    rebalanceDeficitTeamsAndRecreateMatches(tournamentId: string): boolean {
        const t = this.tournaments.find((x) => x.id === tournamentId);
        if (!t) return false;

        const teamSize = t.teamSize || 3;
        const allTeams = t.teams || [];
        
        // Find all teams that are missing players
        const deficitTeams = allTeams.filter(team => team.players.length < teamSize);

        if (deficitTeams.length === 0) {
            return true;
        }

        // 3. Collect remaining players from these deficit teams
        const poolPlayers: any[] = [];
        const oldTeamIds = deficitTeams.map(team => team.id);
        
        for (const team of deficitTeams) {
            poolPlayers.push(...team.players);
        }

        // 4. Calculate how many full teams we can form
        const numNewTeams = Math.floor(poolPlayers.length / teamSize);

        // 5. Generate the new reformed teams
        const newTeams: Team[] = [];
        if (numNewTeams > 0) {
            const sourcePlayers = poolPlayers.map(p => ({ id: p.id, name: p.name }));
            const poolCaptains = sourcePlayers.filter(p => t.captains?.includes(p.id)).map(p => p.id);
            
            const generated = this.tournamentEngine.generateTeamsWithCaptains(
                sourcePlayers,
                teamSize,
                poolCaptains,
                (pid) => this.getMemberRankStrength(pid)
            );
            
            generated.forEach((team, index) => {
                team.id = `team-reformed-${Date.now()}-${index}`;
                team.name = `Đội Tái Cấu Trúc ${index + 1}`;
                newTeams.push(team);
            });
        }

        // 6. Update t.teams list: remove old deficit teams, add newly reformed teams
        t.teams = allTeams.filter(team => !oldTeamIds.includes(team.id)).concat(newTeams);

        // 7. Re-structure groups globally based on current team list.
        const allTeamCompetitors = (t.teams || []).map((team) => ({ id: team.id, name: team.name }));
        if ((t.format || 'group') === 'round_robin') {
            t.groups = [{ groupName: 'Vòng tròn', competitors: allTeamCompetitors }];
        } else {
            t.groups = this.tournamentEngine.generateRandomGroups(allTeamCompetitors, t.groupSize || 4);
        }

        // 8. Always recreate the group schedule and standings to keep brackets consistent.
        this.recreateGroupStageMatchesFromExistingGroups(t);

        this.postTournamentMatchResult(tournamentId, '/teams/rebalance-deficit', {
            recordedById: this.loggedInUserId || undefined
        });
        return true;
    }

    // --- SYSTEM NOTIFICATIONS ---
    getNotifications(memberId: string): AppNotification[] {
        return this.notifications.filter((item) => item.receiverId === memberId).map((item) => ({ ...item }));
    }

    markAllNotificationsAsRead(memberId: string): void {
        this.notifications = this.notifications.map((item) => {
            if (item.receiverId !== memberId) {
                return item;
            }

            if (!item.isRead) {
                this.http.post(`${this.apiUrl}/notifications/${item.id}/read`, {}).subscribe();
            }

            return {
                ...item,
                isRead: true
            };
        });
    }

    getParticipationsByMember(memberId: string): TournamentParticipation[] {
        return this.participations.filter((item) => item.memberId === memberId).map((item) => ({ ...item }));
    }

    // --- AUDIT LOGS ---
    getAuditLogs(): AuditLog[] {
        return this.auditLogs.map((log) => ({ ...log }));
    }

    private logAction(actorId: string, action: string, details: string, reason: string): void {
        const id = `a${(this.auditLogs.length + 1).toString().padStart(2, '0')}`;
        const log: AuditLog = {
            id,
            timestamp: new Date().toISOString(),
            actorId,
            action,
            details,
            reason
        };
        this.auditLogs = [log, ...this.auditLogs];
        this.http.post(`${this.apiUrl}/audit-logs`, log).subscribe();
    }

    private pushNotification(receiverId: string, title: string, content: string): void {
        const notification: AppNotification = {
            id: `n${(this.notifications.length + 1).toString().padStart(2, '0')}`,
            receiverId,
            createdAt: new Date().toISOString(),
            title,
            content,
            isRead: false
        };

        this.notifications = [notification, ...this.notifications];
        this.http.post(`${this.apiUrl}/notifications`, notification).subscribe();
    }
}
