import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ChartModule } from 'primeng/chart';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { TagModule } from 'primeng/tag';
import { AppNotification, ChallengeRequest, MatchRecord, Member, Tournament, TournamentParticipation, CourtBooking, TournamentPrize } from '../domain/evnict.models';
import { EvnictDataService } from '../domain/evnict-data.service';
import { Router, ActivatedRoute } from '@angular/router';

interface ParticipationView {
    tournamentName: string;
    resultLabel: string;
}

@Component({
    selector: 'app-evnict-user-portal',
    standalone: true,
    imports: [CommonModule, FormsModule, ChartModule, TableModule, ButtonModule, SelectModule, TagModule, DialogModule, InputTextModule],
    template: `
        <div class="portal-shell grid grid-cols-12 gap-6">

            <div class="col-span-12 screen-hero">
                <div class="flex items-center justify-between flex-wrap gap-2 mb-2">
                    <h2 class="screen-hero__title m-0">Bảng Điều Khiển Vận Động Viên EVNICT</h2>
                    <button class="px-3 py-1.5 bg-primary text-white hover:bg-primary-600 rounded-lg text-xs font-extrabold transition flex items-center gap-1.5 border-none shadow-sm cursor-pointer" (click)="refreshAllData()">
                        <i class="pi pi-refresh" [class.pi-spin]="isRefreshing"></i> Làm mới dữ liệu
                    </button>
                </div>
                <p class="screen-hero__subtitle">Theo dõi Elo cá nhân, quản lý kèo thách đấu và cập nhật tiến trình giải đấu theo thời gian thực.</p>
                <div class="screen-hero__metrics">
                    <span class="screen-hero__metric">VĐV: <strong>{{ currentUser?.fullName || 'N/A' }}</strong></span>
                    <span class="screen-hero__metric">Username: <strong>{{ currentUser?.username || 'N/A' }}</strong></span>
                    <span class="screen-hero__metric">Email: <strong>{{ currentUser?.email || 'N/A' }}</strong></span>
                    <span class="screen-hero__metric">Hạng: <strong>{{ currentUser?.rankTier || 'N/A' }}</strong></span>
                    <span class="screen-hero__metric">Elo: <strong>{{ currentUser?.elo || 0 }}</strong></span>
                    <span class="screen-hero__metric">Phòng/Ban: <strong>{{ currentUser?.department || 'N/A' }}</strong></span>
                    <span class="screen-hero__metric">Ngày gia nhập: <strong>{{ currentUser?.joinedAt || 'N/A' }}</strong></span>
                    <span class="screen-hero__metric">Trạng thái: <strong>{{ currentUser?.isActive ? 'Đã kích hoạt' : 'Chờ duyệt' }}</strong></span>
                    <span class="screen-hero__metric">Kèo chờ: <strong>{{ pendingApprovals.length }}</strong></span>
                    <span class="screen-hero__metric">Thách đấu: <strong>{{ myChallenges.length }}</strong></span>
                </div>
            </div>

            <!-- Tabs Selection -->
            <div class="col-span-12">
                <div [class]="activeTab === 'tournaments' && tournamentViewMode === 'detail' ? '' : 'card shadow-sm border border-surface-200'">


                    <!-- Tab Content: Challenges -->
                    <div *ngIf="activeTab === 'challenges'">
                        <div class="grid grid-cols-12 gap-6">
                            <div class="col-span-12 md:col-span-5 border-r border-surface-200 pr-0 md:pr-4">
                                <h3 class="text-lg font-bold mb-3 flex items-center gap-2">
                                    <i class="pi pi-send text-primary"></i> Gửi Thách Đấu Mới
                                </h3>
                                <div class="space-y-3">
                                    <div>
                                        <label class="block mb-1 text-sm font-medium">Tìm đối thủ theo tên/phòng ban</label>
                                        <input
                                            type="text"
                                            class="w-full p-2 border border-surface-300 dark:border-surface-600 rounded bg-surface-0 dark:bg-surface-900"
                                            [(ngModel)]="opponentSearchKeyword"
                                            placeholder="Ví dụ: Thành, TTPM, TTHT..."
                                        />
                                    </div>
                                    <div>
                                        <label class="block mb-1 text-sm font-medium">Chọn đối thủ</label>
                                        <select class="w-full p-2 border border-surface-300 dark:border-surface-600 rounded bg-surface-0 dark:bg-surface-900" [(ngModel)]="challengeForm.opponentId">
                                            <option *ngFor="let member of filteredOpponents" [value]="member.id">{{ member.fullName }} - {{ member.department || 'N/A' }} ({{ member.elo }} Elo)</option>
                                        </select>
                                    </div>
                                    <div class="grid grid-cols-2 gap-3">
                                        <div>
                                            <label class="block mb-1 text-sm font-medium">Best of</label>
                                            <select class="w-full p-2 border border-surface-300 dark:border-surface-600 rounded bg-surface-0 dark:bg-surface-900" [(ngModel)]="challengeForm.bestOf">
                                                <option [ngValue]="3">BO3</option>
                                                <option [ngValue]="5">BO5</option>
                                                <option [ngValue]="7">BO7</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label class="block mb-1 text-sm font-medium">Giờ đề xuất</label>
                                            <input type="datetime-local" class="w-full p-2 border border-surface-300 dark:border-surface-600 rounded bg-surface-0 dark:bg-surface-900" [(ngModel)]="challengeForm.preferredTime" />
                                        </div>
                                    </div>
                                    <div>
                                        <label class="block mb-1 text-sm font-medium">Ghi chú</label>
                                        <textarea class="w-full p-2 border border-surface-300 dark:border-surface-600 rounded bg-surface-0 dark:bg-surface-900" rows="2" [(ngModel)]="challengeForm.note" placeholder="Ví dụ: Gặp giao lưu cuối tuần nhé!"></textarea>
                                    </div>
                                    <button class="w-full px-4 py-2 bg-primary text-white rounded font-medium hover:bg-primary-600 transition" (click)="createChallenge()">Gửi lời mời thách đấu</button>
                                    <p class="text-sm text-surface-500 mt-2">{{ challengeMessage }}</p>
                                </div>
                            </div>

                            <div class="col-span-12 md:col-span-7">
                                <h3 class="text-lg font-bold mb-3 flex items-center gap-2">
                                    <i class="pi pi-list text-primary"></i> Các Lời Thách Đấu Liên Quan
                                </h3>
                                <div class="overflow-y-auto max-h-96 space-y-3">
                                    <div *ngFor="let challenge of myChallenges" class="p-3 border border-surface-200 rounded-lg flex justify-between items-center bg-surface-50 dark:bg-surface-800">
                                        <div>
                                            <div class="font-semibold text-surface-900 dark:text-surface-0">
                                                {{ memberName(challenge.challengerId) }} vs {{ memberName(challenge.opponentId) }}
                                            </div>
                                            <div class="text-xs text-surface-500 mt-1">
                                                <i class="pi pi-calendar mr-1"></i>{{ challenge.preferredTime }} | BO{{ challenge.bestOf }}
                                            </div>
                                            <p *ngIf="challenge.note" class="m-0 text-xs italic text-surface-600 mt-1">"{{ challenge.note }}"</p>
                                            <div class="mt-2 text-xs">
                                                Trạng thái: 
                                                <p-tag [value]="challenge.status.toUpperCase()" [severity]="getChallengeSeverity(challenge.status)" />
                                            </div>
                                        </div>
                                        <div class="flex flex-col gap-2" *ngIf="challenge.status === 'pending' && challenge.opponentId === currentUserId">
                                            <button class="px-3 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700 font-medium" (click)="acceptChallenge(challenge.id)">Chấp nhận</button>
                                            <button class="px-3 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700 font-medium" (click)="declineChallenge(challenge.id)">Từ chối</button>
                                        </div>
                                        <div *ngIf="challenge.status === 'pending' && challenge.challengerId === currentUserId">
                                            <button class="px-3 py-1 border border-red-500 text-red-500 rounded text-xs hover:bg-red-50" (click)="cancelChallenge(challenge.id)">Hủy yêu cầu</button>
                                        </div>
                                    </div>
                                    <div *ngIf="!myChallenges.length" class="text-center text-surface-500 py-6">Không có lời thách đấu nào.</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Tab Content: Match Self-Recording & Confirmation Queue -->
                    <div *ngIf="activeTab === 'matches'">
                        <div class="grid grid-cols-12 gap-6">
                            <!-- Left: Record a friendly match -->
                            <div class="col-span-12 md:col-span-4 border-r border-surface-200 pr-0 md:pr-4">
                                <h3 class="text-lg font-bold mb-3 flex items-center gap-2">
                                    <i class="pi pi-plus-circle text-primary"></i> Ghi Nhận Trận Đấu
                                </h3>
                                <div class="space-y-3">
                                    <div>
                                        <label class="block mb-1 text-sm font-medium">Đối thủ</label>
                                        <select class="w-full p-2 border border-surface-300 dark:border-surface-600 rounded bg-surface-0 dark:bg-surface-900" [(ngModel)]="newMatch.awayPlayerId">
                                            <option *ngFor="let opponent of opponents" [value]="opponent.id">{{ opponent.fullName }}</option>
                                        </select>
                                    </div>
                                    <div class="grid grid-cols-2 gap-3">
                                        <div>
                                            <label class="block mb-1 text-sm font-medium">Số Set Bạn Thắng</label>
                                            <input type="number" class="w-full p-2 border border-surface-300 dark:border-surface-600 rounded bg-surface-0 dark:bg-surface-900" min="0" [(ngModel)]="newMatch.homeScore" />
                                        </div>
                                        <div>
                                            <label class="block mb-1 text-sm font-medium">Số Set Đối Thủ Thắng</label>
                                            <input type="number" class="w-full p-2 border border-surface-300 dark:border-surface-600 rounded bg-surface-0 dark:bg-surface-900" min="0" [(ngModel)]="newMatch.awayScore" />
                                        </div>
                                    </div>
                                    <div>
                                        <label class="block mb-1 text-sm font-medium">Ghi chú trận đấu</label>
                                        <input type="text" class="w-full p-2 border border-surface-300 dark:border-surface-600 rounded bg-surface-0 dark:bg-surface-900" [(ngModel)]="newMatch.notes" placeholder="e.g. Set 5 kịch tính" />
                                    </div>
                                    <button class="w-full px-4 py-2 bg-primary text-white rounded font-medium hover:bg-primary-600 transition" (click)="recordMatch()">Gửi Kết Quả Cho Đối Thủ Duyệt</button>
                                    <p class="text-sm text-surface-500 mt-2">{{ lastMatchMessage }}</p>
                                </div>
                            </div>

                            <!-- Right: Approval Queue & Match History -->
                            <div class="col-span-12 md:col-span-8">
                                <div class="mb-4">
                                    <h3 class="text-lg font-bold mb-3 text-amber-600 flex items-center gap-2">
                                        <i class="pi pi-clock"></i> Chờ Xác Nhận Hai Chiều (Chờ Bạn duyệt)
                                    </h3>
                                    <div class="space-y-3">
                                        <div *ngFor="let pending of pendingApprovals" class="p-3 border-l-4 border-amber-500 border-surface-200 border rounded-r-lg bg-amber-50/20 dark:bg-surface-800 flex justify-between items-center">
                                            <div>
                                                <div class="font-semibold text-sm">
                                                    {{ memberName(pending.homePlayerId) }} vs {{ memberName(pending.awayPlayerId) }}
                                                </div>
                                                <div class="text-base font-bold text-surface-900 dark:text-surface-0 mt-1">
                                                    Tỉ số: {{ pending.homeScore }} - {{ pending.awayScore }}
                                                </div>
                                                <small class="text-surface-500 block">Người nhập: {{ memberName(pending.recordedById || '') }} | Lúc: {{ pending.playedAt | date: 'dd/MM HH:mm' }}</small>
                                            </div>
                                            <div class="flex gap-2">
                                                <button class="px-3 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700 font-semibold" (click)="confirmMatch(pending.id)">Đồng Ý (Tính Elo)</button>
                                                <button class="px-3 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700 font-semibold" (click)="disputeMatch(pending.id)">Khiếu Nại</button>
                                            </div>
                                        </div>
                                        <div *ngIf="!pendingApprovals.length" class="text-xs text-surface-500">Không có kết quả nào chờ bạn xác nhận.</div>
                                    </div>
                                </div>

                                <div>
                                    <h3 class="text-lg font-bold mb-3 flex items-center gap-2">
                                        <i class="pi pi-history text-primary"></i> Lịch Sử Trận Đấu Cá Nhân
                                    </h3>
                                    <div class="overflow-auto border border-surface-200 rounded-lg">
                                        <table class="w-full border-collapse text-sm">
                                            <thead>
                                                <tr class="bg-surface-100 dark:bg-surface-800 border-b border-surface-200">
                                                    <th class="text-left py-2 px-3">Thời gian</th>
                                                    <th class="text-left py-2 px-3">Đối thủ</th>
                                                    <th class="text-left py-2 px-3">Kết quả</th>
                                                    <th class="text-left py-2 px-3">Thay đổi Elo</th>
                                                    <th class="text-left py-2 px-3">Trạng thái</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                <tr *ngFor="let match of myMatches" class="border-b border-surface-100 hover:bg-surface-50 dark:hover:bg-surface-800">
                                                    <td class="py-2 px-3 text-xs">{{ match.playedAt | date: 'dd/MM/yyyy HH:mm' }}</td>
                                                    <td class="py-2 px-3 font-medium">{{ opponentName(match) }}</td>
                                                    <td class="py-2 px-3">
                                                        <span [class.text-green-600]="isMatchWon(match)" [class.text-red-500]="!isMatchWon(match)" class="font-semibold">
                                                            {{ isMatchWon(match) ? 'Thắng' : 'Thua' }}
                                                        </span>
                                                        ({{ match.homeScore }}-{{ match.awayScore }})
                                                    </td>
                                                    <td class="py-2 px-3">
                                                        <span *ngIf="match.status === 'confirmed'" class="flex items-center gap-1 font-bold">
                                                            {{ getEloDelta(match) }}
                                                            <small class="text-surface-400">({{ getEloDisplayRange(match) }})</small>
                                                        </span>
                                                        <span *ngIf="match.status !== 'confirmed'" class="text-surface-400 italic">--</span>
                                                    </td>
                                                    <td class="py-2 px-3">
                                                        <p-tag [value]="match.status?.toUpperCase() || 'CONFIRMED'" [severity]="getMatchStatusSeverity(match.status)" />
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </table>
                                        <div *ngIf="!myMatches.length" class="text-center py-6 text-surface-500">Chưa thi đấu trận nào.</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Tab Content: Tournaments -->
                    <div *ngIf="activeTab === 'tournaments'">
                        <!-- LIST VIEW -->
                        <div *ngIf="tournamentViewMode === 'list'" class="space-y-6 animate-fadein">
                            <div class="flex items-center justify-between border-b border-surface-200 pb-3">
                                <div>
                                    <h3 class="text-xl font-extrabold m-0 flex items-center gap-2">
                                        <i class="pi pi-sitemap text-primary"></i> Giải Đấu CLB EVNICT
                                    </h3>
                                    <p class="text-xs text-slate-500 mt-1">Đăng ký tham gia giải đấu đang mở và theo dõi bảng điểm live.</p>
                                </div>
                            </div>

                            <div class="tournament-toolbar">
                                <div class="tournament-toolbar__left">
                                    <button type="button" class="tournament-chip" [class.is-active]="tournamentStatusFilter === 'all'" (click)="tournamentStatusFilter = 'all'">
                                        Tất cả ({{ allTournaments.length }})
                                    </button>
                                    <button type="button" class="tournament-chip" [class.is-active]="tournamentStatusFilter === 'draft'" (click)="tournamentStatusFilter = 'draft'">
                                        Đang mở ({{ tournamentDraftCount }})
                                    </button>
                                    <button type="button" class="tournament-chip" [class.is-active]="tournamentStatusFilter === 'ongoing'" (click)="tournamentStatusFilter = 'ongoing'">
                                        Đang diễn ra ({{ tournamentOngoingCount }})
                                    </button>
                                    <button type="button" class="tournament-chip" [class.is-active]="tournamentStatusFilter === 'finished'" (click)="tournamentStatusFilter = 'finished'">
                                        Đã kết thúc ({{ tournamentFinishedCount }})
                                    </button>
                                </div>
                                <div class="tournament-toolbar__right">
                                    <label class="tournament-search">
                                        <i class="pi pi-search"></i>
                                        <input type="text" [(ngModel)]="tournamentSearchKeyword" placeholder="Tìm giải đấu theo tên hoặc địa điểm..." />
                                    </label>
                                    <select class="tournament-filter-select" [(ngModel)]="tournamentFormatFilter">
                                        <option value="all">Mọi thể thức</option>
                                        <option value="group">Chia bảng + Knockout</option>
                                        <option value="round_robin">Vòng tròn tính điểm</option>
                                    </select>
                                </div>
                            </div>

                            <div class="tournament-toolbar-divider" aria-hidden="true"></div>

                            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-2">
                                <div *ngFor="let t of filteredTournaments; trackBy: trackByTournamentId" class="card shadow-sm border border-surface-200 hover:border-primary/40 transition-all p-5 flex flex-col justify-between space-y-4 rounded-2xl bg-surface-0 dark:bg-surface-900/60">
                                    <div class="space-y-2">
                                        <div class="flex items-center justify-between">
                                            <span class="text-xs uppercase tracking-wider bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded font-bold text-slate-600 dark:text-slate-400">
                                                {{ getTournamentTypeLabel(t.type) }}
                                            </span>
                                            <p-tag [value]="(t.status || 'DRAFT').toUpperCase()" [severity]="getTournamentStatusSeverity(t.status)" />
                                        </div>
                                        <h4 class="text-lg font-black text-slate-900 dark:text-white m-0 pt-1 line-clamp-1" [title]="t.name">{{ t.name }}</h4>
                                        <p class="text-xs text-slate-500 font-medium">
                                            Bắt đầu: {{ t.startedAt | date:'dd/MM/yyyy' }}<span *ngIf="t.finishedAt"> - Kết thúc: {{ t.finishedAt | date:'dd/MM/yyyy' }}</span>
                                        </p>
                                        <div class="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
                                            <i class="pi pi-users text-primary"></i>
                                            <span class="font-bold">{{ t.participants?.length || 0 }}</span> người tham gia
                                            <span class="text-slate-400">({{ t.format === 'round_robin' ? 'Vòng tròn' : ('Chia bảng ' + (t.groupSize || 4) + '/bảng') }})</span>
                                        </div>
                                        <div class="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 font-semibold" *ngIf="t.prizes && t.prizes.length > 0">
                                             <i class="pi pi-gift"></i>
                                             <span>{{ getPrizesSummary(t.prizes) }}</span>
                                         </div>
                                        <div class="flex items-center gap-1.5 text-xs text-slate-550 dark:text-slate-350" *ngIf="t.location">
                                            <i class="pi pi-map-marker text-primary"></i>
                                            <span>{{ t.location }}</span>
                                        </div>
                                    </div>

                                    <div class="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                                        <!-- Fast registration / view actions -->
                                        <ng-container *ngIf="t.status === 'draft'">
                                            <button *ngIf="!isRegistered(t.id)" class="px-3 py-1.5 bg-green-600 text-white rounded text-xs font-bold hover:bg-green-700 transition" (click)="registerTournament(t.id)">
                                                Đăng ký ngay
                                            </button>
                                            <button *ngIf="isRegistered(t.id)" class="px-3 py-1.5 bg-red-50 text-red-600 rounded text-xs font-bold hover:bg-red-100 transition" (click)="deregisterTournament(t.id)">
                                                Hủy đăng ký
                                            </button>
                                        </ng-container>
                                        <span *ngIf="t.status !== 'draft'" class="text-xs text-slate-400 font-bold italic">Giải đấu đã bắt đầu</span>

                                        <button class="px-3 py-1.5 bg-surface-100 hover:bg-surface-200 text-slate-700 rounded text-xs font-bold transition" (click)="selectTournament(t.id)">
                                            Chi tiết
                                        </button>
                                    </div>
                                </div>

                                <div *ngIf="!allTournaments.length" class="col-span-full py-16 text-center text-slate-400 text-sm border-2 border-dashed border-slate-200 rounded-2xl">
                                    <i class="pi pi-sitemap text-3xl mb-1.5 text-slate-300"></i>
                                    <div>Chưa có giải đấu nào được khởi tạo.</div>
                                </div>
                                <div *ngIf="allTournaments.length && !filteredTournaments.length" class="col-span-full py-16 text-center text-slate-400 text-sm border-2 border-dashed border-slate-200 rounded-2xl">
                                    <i class="pi pi-filter-slash text-3xl mb-1.5 text-slate-300"></i>
                                    <div>Không có giải đấu phù hợp với bộ lọc bạn chọn.</div>
                                </div>
                            </div>

                            <div class="tournament-metrics mt-1">
                                <span class="tournament-metric">Hiển thị: {{ filteredTournaments.length }} giải</span>
                                <span class="tournament-metric">Bạn đã đăng ký: {{ registeredTournamentCount }} giải</span>
                                <span class="tournament-metric">Giải có thưởng: {{ prizeTournamentCount }} giải</span>
                            </div>
                        </div>

                        <!-- DETAIL VIEW -->
                        <div *ngIf="tournamentViewMode === 'detail' && currTournament" class="grid grid-cols-12 gap-6 animate-fadein">
                            <!-- Left: Summary Info & Register Card (Only shown for draft registration) -->
                            <div class="col-span-12 lg:col-span-4 space-y-6" *ngIf="currTournament.status === 'draft'">
                                <div class="card shadow-sm border border-surface-200">
                                    <div class="flex items-center gap-2 mb-4">
                                        <button class="p-2 bg-surface-100 hover:bg-surface-200 rounded-full text-slate-700 dark:bg-slate-800 dark:text-slate-300 transition" (click)="backToList()">
                                            <i class="pi pi-arrow-left"></i>
                                        </button>
                                        <span class="text-sm font-bold text-slate-500">Quay lại danh sách</span>
                                    </div>

                                    <h3 class="text-xl font-extrabold m-0 text-primary mb-3">{{ currTournament.name }}</h3>
                                    <div class="space-y-3 text-sm text-slate-700 dark:text-slate-300">
                                        <div class="flex items-center justify-between border-b pb-2">
                                            <span class="font-medium text-slate-400">Trạng thái:</span>
                                            <p-tag [value]="(currTournament.status || 'DRAFT').toUpperCase()" [severity]="getTournamentStatusSeverity(currTournament.status)" />
                                        </div>
                                        <div class="flex items-center justify-between border-b pb-2">
                                            <span class="font-medium text-slate-400">Thể thức:</span>
                                            <span class="font-bold">{{ getTournamentTypeLabel(currTournament.type) }}</span>
                                        </div>
                                        <div class="flex items-center justify-between border-b pb-2">
                                            <span class="font-medium text-slate-400">Hình thức:</span>
                                            <span class="font-bold text-xs">{{ currTournament.format === 'round_robin' ? 'Vòng tròn tính điểm' : 'Chia bảng + Knockout' }}</span>
                                        </div>
                                        <div class="flex items-center justify-between border-b pb-2" *ngIf="currTournament.format !== 'round_robin'">
                                            <span class="font-medium text-slate-400">Quy mô bảng:</span>
                                            <span class="font-semibold text-slate-700 dark:text-slate-200">{{ currTournament.groupSize || 4 }} VĐV</span>
                                        </div>
                                        <div class="flex items-center justify-between border-b pb-2" *ngIf="currTournament.location">
                                            <span class="font-medium text-slate-400">Địa điểm:</span>
                                            <span class="font-semibold text-slate-700 dark:text-slate-200 text-xs">{{ currTournament.location }}</span>
                                        </div>
                                        <div class="flex items-center justify-between border-b pb-2" *ngIf="currTournament.prizes && currTournament.prizes.length > 0">
                                             <span class="font-medium text-slate-400">Giải thưởng:</span>
                                             <span class="font-semibold text-amber-600 dark:text-amber-400 text-xs">{{ getPrizesSummary(currTournament.prizes) }}</span>
                                         </div>
                                        <div class="flex items-center justify-between">
                                            <span class="font-medium text-slate-400">Đã đăng ký:</span>
                                            <span class="font-bold text-indigo-600">{{ currTournament.participants?.length || 0 }} VĐV</span>
                                        </div>
                                    </div>

                                    <!-- Logged-in Player Action -->
                                    <div class="mt-6 pt-4 border-t" *ngIf="currTournament.status === 'draft'">
                                        <button *ngIf="!isRegistered(currTournament.id)" class="w-full py-2.5 bg-green-600 text-white rounded-lg text-sm font-extrabold hover:bg-green-700 transition flex items-center justify-center gap-1.5" (click)="registerTournament(currTournament.id)">
                                            <i class="pi pi-check-circle"></i> Đăng Ký Tham Gia
                                        </button>
                                        <button *ngIf="isRegistered(currTournament.id)" class="w-full py-2.5 bg-red-600 text-white rounded-lg text-sm font-extrabold hover:bg-red-700 transition flex items-center justify-center gap-1.5" (click)="deregisterTournament(currTournament.id)">
                                            <i class="pi pi-times-circle"></i> Hủy Đăng Ký
                                        </button>
                                        <div class="text-xxs text-slate-400 text-center mt-2.5 italic">
                                            Bạn có thể tự đăng ký hoặc hủy đăng ký bất cứ lúc nào trước khi giải bốc thăm.
                                        </div>
                                    </div>

                                    <div class="mt-6 pt-4 border-t text-center text-xs font-bold text-slate-400" *ngIf="currTournament.status !== 'draft'">
                                        <i class="pi pi-lock mr-1"></i> Giải đấu đã được bốc thăm & đang diễn ra.
                                    </div>
                                </div>
                            </div>

                            <!-- Right: Standings/Bracket/Players tabs (Full-width for active tournaments) -->
                            <div [class]="currTournament.status === 'draft' ? 'col-span-12 lg:col-span-8 space-y-6' : 'col-span-12 space-y-6'">
                                
                                <!-- Horizontal Header for Ongoing/Finished Tournament (User view) -->
                                <div class="card shadow-sm border border-surface-200 p-4 mb-2 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-slate-50/50 dark:bg-slate-900/40" *ngIf="currTournament.status !== 'draft'">
                                    <div class="space-y-1">
                                        <div class="flex items-center gap-2">
                                            <button class="p-2 bg-surface-100 hover:bg-surface-200 rounded-full text-slate-700 dark:bg-slate-800 dark:text-slate-300 transition" (click)="backToList()">
                                                <i class="pi pi-arrow-left text-xs"></i>
                                            </button>
                                            <h3 class="text-base font-extrabold m-0 text-primary">{{ currTournament.name }}</h3>
                                            <p-tag [value]="(currTournament.status || 'DRAFT').toUpperCase()" [style]="{ 'font-size': '9px' }" [severity]="getTournamentStatusSeverity(currTournament.status)" />
                                        </div>
                                        <div class="flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] text-slate-550 dark:text-slate-350 font-bold">
                                            <span><strong>Thể thức:</strong> {{ getTournamentTypeLabel(currTournament.type) }}</span>
                                            <span><strong>Hình thức:</strong> {{ currTournament.format === 'round_robin' ? 'Vòng tròn tính điểm' : 'Chia bảng đấu' }}</span>
                                            <span *ngIf="currTournament.format !== 'round_robin'"><strong>Quy mô bảng:</strong> {{ currTournament.groupSize || 4 }} VĐV/Bảng</span>
                                            <span *ngIf="currTournament.type === 'team'"><strong>Quy mô đội:</strong> {{ currTournament.teamSize || 3 }} VĐV/Đội</span>
                                            <span><strong>Đã tham gia:</strong> {{ currTournament.participants?.length || 0 }} VĐV</span>
                                            <span *ngIf="currTournament.location"><strong>Địa điểm:</strong> {{ currTournament.location }}</span>
                                        </div>
                                    </div>
                                </div>

                                <div class="card shadow-sm border border-surface-200">
                                    <!-- Tabs Header -->
                                    <div class="tournament-tabs">
                                        <button type="button" class="tournament-tab-btn" [class.is-active]="detailTab === 'overview'" (click)="detailTab = 'overview'">
                                            Tổng Quan & Giải Thưởng
                                        </button>
                                        <button type="button" class="tournament-tab-btn" [class.is-active]="detailTab === 'players'" (click)="detailTab = 'players'">
                                            Đội hình & VĐV ({{ currTournament.participants?.length || 0 }})
                                        </button>
                                        <button type="button" class="tournament-tab-btn" [class.is-active]="detailTab === 'group'" [disabled]="currTournament.status === 'draft'" (click)="detailTab = 'group'">
                                            Vòng Bảng & Kết Quả
                                        </button>
                                        <button type="button" class="tournament-tab-btn" [class.is-active]="detailTab === 'knockout'" [disabled]="currTournament.status === 'draft' || currTournament.stage !== 'knockout'" (click)="detailTab = 'knockout'">
                                            Vòng Loại Trực Tiếp
                                        </button>
                                    </div>

                                    <!-- Content Tab 0: Overview -->
                                    <div *ngIf="detailTab === 'overview'" class="space-y-6">
                                        
                                        <!-- Podium & Trophy Header (Only if drawn or finished) -->
                                        <div *ngIf="currTournament.status !== 'draft'" class="bg-gradient-to-br from-indigo-900 via-slate-900 to-indigo-950 text-white rounded-2xl p-6 shadow-xl relative overflow-hidden border border-indigo-950">
                                            <!-- Ambient light effect -->
                                            <div class="absolute -top-24 -left-24 w-48 h-48 bg-primary-500 rounded-full blur-3xl opacity-20"></div>
                                            <div class="absolute -bottom-24 -right-24 w-48 h-48 bg-amber-500 rounded-full blur-3xl opacity-20"></div>

                                            <div class="relative flex flex-col items-center">
                                                <h4 class="text-sm uppercase tracking-widest text-amber-400 font-black mb-1">Bảng Vàng Danh Dự</h4>
                                                <h3 class="text-xl font-extrabold text-slate-100 mb-6 text-center">BỤC VINH QUANG GIẢI ĐẤU</h3>

                                                <!-- The 3D-styled Podium Layout -->
                                                <div class="flex items-end justify-center w-full max-w-4xl mx-auto pt-6 pb-2 gap-3 md:gap-5 flex-wrap">
                                                    
                                                    <!-- 2nd Place: Left Column -->
                                                    <div class="flex flex-col items-center flex-1 min-w-[130px] max-w-[190px]">
                                                        <div class="text-center mb-3 w-full px-1">
                                                            <div class="inline-flex items-center justify-center w-9 h-9 rounded-full bg-slate-800 border-2 border-slate-350 font-black text-xs text-slate-200 shadow-md mb-2">
                                                                2nd
                                                            </div>
                                                            <div class="text-xs font-bold text-slate-200 leading-tight">
                                                                {{ getPodiumWinners(currTournament).second?.name || 'Đang đấu...' }}
                                                            </div>
                                                            <div *ngIf="currTournament.type === 'team' && getPodiumWinners(currTournament).second?.id" class="text-[10px] text-slate-400 font-normal leading-snug mt-1 block">
                                                                {{ getTeamPlayersText(getPodiumWinners(currTournament).second?.id || '') }}
                                                            </div>
                                                        </div>
                                                        <!-- Podium block -->
                                                        <div class="w-full h-24 bg-gradient-to-t from-slate-700/80 to-slate-500/80 border border-slate-500 rounded-t-xl flex items-center justify-center shadow-lg text-center">
                                                            <div class="flex flex-col items-center px-1">
                                                                <i class="pi pi-medal text-xl text-slate-300"></i>
                                                                <span class="text-[10px] text-slate-200 font-bold mt-1">GIẢI NHÌ</span>
                                                                <span class="text-[10px] text-amber-300 font-black mt-0.5" *ngIf="getPrizeForPodium(currTournament, 'second')">
                                                                    {{ getPrizeForPodium(currTournament, 'second') }}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <!-- 1st Place: Center Column -->
                                                    <div class="flex flex-col items-center flex-1 min-w-[150px] max-w-[210px]">
                                                        <div class="text-center mb-3 w-full px-1 scale-105 transform">
                                                            <div class="inline-flex items-center justify-center w-11 h-11 rounded-full bg-amber-950 border-2 border-amber-400 font-black text-sm text-amber-400 shadow-lg relative mb-2">
                                                                <i class="pi pi-prime absolute -top-3 text-yellow-400 text-xs animate-bounce"></i>
                                                                1st
                                                            </div>
                                                            <div class="text-sm font-black text-amber-300 leading-tight">
                                                                {{ getPodiumWinners(currTournament).first?.name || 'Đang đấu...' }}
                                                            </div>
                                                            <div *ngIf="currTournament.type === 'team' && getPodiumWinners(currTournament).first?.id" class="text-[11px] text-amber-400 font-medium leading-snug mt-1 block">
                                                                {{ getTeamPlayersText(getPodiumWinners(currTournament).first?.id || '') }}
                                                            </div>
                                                        </div>
                                                        <!-- Podium block -->
                                                        <div class="w-full h-32 bg-gradient-to-t from-amber-700/90 to-yellow-500/90 border border-amber-400 rounded-t-xl flex items-center justify-center shadow-2xl relative text-center">
                                                            <div class="absolute inset-0 bg-yellow-400/10 animate-pulse rounded-t-xl"></div>
                                                            <div class="flex flex-col items-center px-1">
                                                                <i class="pi pi-trophy text-3xl text-yellow-350 drop-shadow"></i>
                                                                <span class="text-xs text-white font-black mt-1">VÔ ĐỊCH</span>
                                                                <span class="text-xs text-yellow-250 font-black mt-0.5 animate-pulse" *ngIf="getPrizeForPodium(currTournament, 'first')">
                                                                    {{ getPrizeForPodium(currTournament, 'first') }}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <!-- 3rd Place 1: Right Column -->
                                                    <div class="flex flex-col items-center flex-1 min-w-[130px] max-w-[190px]">
                                                        <div class="text-center mb-3 w-full px-1">
                                                            <div class="inline-flex items-center justify-center w-9 h-9 rounded-full bg-orange-950 border-2 border-orange-650 font-black text-xs text-orange-400 shadow-md mb-2">
                                                                3rd
                                                            </div>
                                                            <div class="text-xs font-bold text-orange-355 leading-tight">
                                                                {{ getPodiumWinners(currTournament).third?.name || 'Đang đấu...' }}
                                                            </div>
                                                            <div *ngIf="currTournament.type === 'team' && getPodiumWinners(currTournament).third?.id" class="text-[10px] text-slate-400 font-normal leading-snug mt-1 block">
                                                                {{ getTeamPlayersText(getPodiumWinners(currTournament).third?.id || '') }}
                                                            </div>
                                                        </div>
                                                        <!-- Podium block -->
                                                        <div class="w-full h-16 bg-gradient-to-t from-orange-800/80 to-amber-750/80 border border-orange-650 rounded-t-xl flex items-center justify-center shadow-lg text-center">
                                                            <div class="flex flex-col items-center px-1">
                                                                <i class="pi pi-medal text-xl text-orange-400"></i>
                                                                <span class="text-[10px] text-orange-200 font-bold mt-1">{{ getPodiumWinners(currTournament).hasTwoThirds ? 'ĐỒNG GIẢI BA' : 'GIẢI BA' }}</span>
                                                                <span class="text-[10px] text-amber-300 font-black mt-0.5" *ngIf="getPrizeForPodium(currTournament, 'third')">
                                                                    {{ getPrizeForPodium(currTournament, 'third') }}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <!-- 3rd Place 2 (Only if 2 Third Places exist) -->
                                                    <div *ngIf="getPodiumWinners(currTournament).hasTwoThirds" class="flex flex-col items-center flex-1 min-w-[130px] max-w-[190px]">
                                                        <div class="text-center mb-3 w-full px-1">
                                                            <div class="inline-flex items-center justify-center w-9 h-9 rounded-full bg-orange-950 border-2 border-orange-650 font-black text-xs text-orange-400 shadow-md mb-2">
                                                                3rd
                                                            </div>
                                                            <div class="text-xs font-bold text-orange-355 leading-tight">
                                                                {{ getPodiumWinners(currTournament).third2?.name || 'Đang đấu...' }}
                                                            </div>
                                                            <div *ngIf="currTournament.type === 'team' && getPodiumWinners(currTournament).third2?.id" class="text-[10px] text-slate-400 font-normal leading-snug mt-1 block">
                                                                {{ getTeamPlayersText(getPodiumWinners(currTournament).third2?.id || '') }}
                                                            </div>
                                                        </div>
                                                        <!-- Podium block -->
                                                        <div class="w-full h-16 bg-gradient-to-t from-orange-800/80 to-amber-750/80 border border-orange-650 rounded-t-xl flex items-center justify-center shadow-lg text-center">
                                                            <div class="flex flex-col items-center px-1">
                                                                <i class="pi pi-medal text-xl text-orange-400"></i>
                                                                <span class="text-[10px] text-orange-200 font-bold mt-1">ĐỒNG GIẢI BA</span>
                                                                <span class="text-[10px] text-amber-300 font-black mt-0.5" *ngIf="getPrizeForPodium(currTournament, 'third')">
                                                                    {{ getPrizeForPodium(currTournament, 'third') }}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                </div>
                                            </div>
                                        </div>

                                        <!-- Stats Cards Row -->
                                        <div class="grid grid-cols-1 md:grid-cols-3 gap-4" *ngIf="currTournament.status !== 'draft'">
                                            <div class="p-4 bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-transparent dark:from-indigo-950/20 dark:via-purple-950/5 dark:to-transparent rounded-xl border border-indigo-500/20 dark:border-indigo-900/30 flex items-center justify-between shadow-sm">
                                                <div class="space-y-1">
                                                    <span class="text-indigo-650 dark:text-indigo-400 text-[10px] uppercase font-black tracking-wider">Tiến Độ Giải Đấu</span>
                                                    <h3 class="text-xl font-black m-0 text-slate-800 dark:text-slate-100">
                                                        {{ getTournamentProgressPercent(currTournament) }}%
                                                    </h3>
                                                </div>
                                                <div class="w-11 h-11 bg-gradient-to-br from-indigo-500 to-purple-655 text-white rounded-xl flex items-center justify-center text-lg shadow-md shadow-indigo-500/20">
                                                    <i class="pi pi-chart-bar"></i>
                                                </div>
                                            </div>

                                            <div class="p-4 bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-transparent dark:from-emerald-950/20 dark:via-teal-950/5 dark:to-transparent rounded-xl border border-emerald-500/20 dark:border-emerald-900/30 flex items-center justify-between shadow-sm">
                                                <div class="space-y-1">
                                                    <span class="text-emerald-600 dark:text-emerald-400 text-[10px] uppercase font-black tracking-wider">Số Trận Đã Đấu</span>
                                                    <h3 class="text-xl font-black m-0 text-slate-800 dark:text-slate-100">
                                                        {{ getCompletedMatchesCount(currTournament) }} / {{ getTotalMatchesCount(currTournament) }}
                                                    </h3>
                                                </div>
                                                <div class="w-11 h-11 bg-gradient-to-br from-emerald-500 to-teal-655 text-white rounded-xl flex items-center justify-center text-lg shadow-md shadow-emerald-500/20">
                                                    <i class="pi pi-check-square"></i>
                                                </div>
                                            </div>

                                            <div class="p-4 bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-transparent dark:from-amber-950/20 dark:via-orange-950/5 dark:to-transparent rounded-xl border border-amber-500/20 dark:border-amber-900/30 flex items-center justify-between shadow-sm">
                                                <div class="space-y-1">
                                                    <span class="text-amber-600 dark:text-amber-400 text-[10px] uppercase font-black tracking-wider">Tổng Đấu Thủ</span>
                                                    <h3 class="text-xl font-black m-0 text-slate-800 dark:text-slate-100">
                                                        {{ currTournament.participants?.length || 0 }} VĐV
                                                    </h3>
                                                </div>
                                                <div class="w-11 h-11 bg-gradient-to-br from-amber-500 to-orange-600 text-white rounded-xl flex items-center justify-center text-lg shadow-md shadow-amber-500/20">
                                                    <i class="pi pi-users"></i>
                                                </div>
                                            </div>
                                        </div>

                                        <!-- Progress Bar Card -->
                                        <div class="card p-4 shadow-inner border border-surface-200" *ngIf="currTournament.status !== 'draft'">
                                            <div class="flex items-center justify-between text-xs font-bold mb-1.5 text-slate-600 dark:text-slate-350">
                                                <span>TIẾN ĐỘ TRẬN ĐẤU HOÀN THÀNH</span>
                                                <span>{{ getCompletedMatchesCount(currTournament) }} / {{ getTotalMatchesCount(currTournament) }} TRẬN</span>
                                            </div>
                                            <div class="w-full bg-slate-200 dark:bg-slate-850 h-3 rounded-full overflow-hidden">
                                                <div class="bg-primary h-full transition-all duration-500" [style.width]="getTournamentProgressPercent(currTournament) + '%'"></div>
                                            </div>
                                        </div>

                                    </div>

                                    <!-- Content Tab 1: Players -->
                                    <div *ngIf="detailTab === 'players'" class="space-y-4">
                                        <!-- Section 1: Individual list (hidden once teams exist) -->
                                        <div *ngIf="!currTournament.teams || currTournament.teams.length === 0">
                                            <h4 class="text-base font-bold flex items-center gap-2 m-0 text-slate-800 dark:text-slate-100">
                                                <i class="pi pi-users text-primary"></i> Vận động viên tham gia giải đấu
                                            </h4>
                                            <div class="overflow-auto border rounded-lg max-h-[350px]">
                                                <table class="w-full border-collapse text-left text-xs">
                                                    <thead>
                                                        <tr class="bg-surface-50 border-b">
                                                            <th class="py-2.5 px-3">Họ và tên</th>
                                                            <th class="py-2.5 px-3">Phòng ban</th>
                                                            <th class="py-2.5 px-3 text-center">Phân hạng</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        <tr *ngFor="let pid of getSortedParticipants()" class="border-b hover:bg-surface-50">
                                                            <td class="py-2.5 px-3 font-semibold text-slate-800 dark:text-slate-100">{{ memberName(pid) }}</td>
                                                            <td class="py-2.5 px-3">{{ getMemberDepartment(pid) }}</td>
                                                            <td class="py-2.5 px-3 text-center font-bold text-primary">Hạng {{ getMemberRank(pid) }}</td>
                                                        </tr>
                                                        <tr *ngIf="!currTournament.participants?.length">
                                                            <td colspan="3" class="text-center py-8 text-slate-400">
                                                                Chưa có đấu thủ nào đăng ký tham gia.
                                                            </td>
                                                        </tr>
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>

                                        <!-- Section 2: Team/Pair details -->
                                        <div *ngIf="currTournament.type === 'team' || currTournament.type === 'double'" class="space-y-4">
                                            
                                            <!-- Sub-state A: Teams generated but groups NOT drawn yet -->
                                            <div *ngIf="currTournament.teams && currTournament.teams.length > 0 && (!currTournament.groups || currTournament.groups.length === 0)">
                                                <h4 class="text-base font-bold flex items-center gap-2 m-0 text-slate-800 dark:text-slate-100 mb-3">
                                                    <i class="pi pi-users text-primary"></i> Danh sách các đội thi đấu đã phân chia
                                                </h4>

                                                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    <div *ngFor="let team of currTournament.teams" class="p-3.5 border rounded-xl bg-surface-50 dark:bg-slate-900/60 shadow-sm space-y-3">
                                                        <div class="font-extrabold text-sm text-indigo-600 flex justify-between items-center border-b pb-1.5">
                                                            <span>{{ team.name }}</span>
                                                            <span class="text-xxs px-2 py-0.5 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400 rounded-full font-bold">Đội đồng bộ</span>
                                                        </div>
                                                        <div class="space-y-2">
                                                            <div *ngFor="let p of team.players; let pIdx = index" class="flex justify-between items-center text-xs">
                                                                <span class="font-semibold flex items-center" [class.text-primary]="pIdx === 0" [class.font-bold]="pIdx === 0">
                                                                    <i class="pi" [class.pi-star-fill]="pIdx === 0" [class.text-amber-500]="pIdx === 0" [class.pi-user]="pIdx > 0" [class.text-slate-400]="pIdx > 0" class="mr-1.5 text-xs"></i>
                                                                    {{ p.name }} <span class="text-slate-400 font-normal ml-1">(Hạng {{ getMemberRank(p.id) }})</span>
                                                                </span>
                                                                <span class="text-[10px] px-1.5 py-0.2 rounded font-bold" [class.bg-amber-100]="pIdx === 0" [class.text-amber-800]="pIdx === 0" [class.bg-slate-100]="pIdx > 0" [class.text-slate-500]="pIdx > 0">
                                                                    {{ pIdx === 0 ? 'Đội trưởng' : 'Thành viên' }}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            <!-- Sub-state B: Groups drawn -->
                                            <div *ngIf="currTournament.groups && currTournament.groups.length > 0" class="space-y-4">
                                                <h4 class="text-base font-bold flex items-center gap-2 m-0 text-slate-800 dark:text-slate-100 border-b pb-2">
                                                    <i class="pi pi-sitemap text-primary"></i> Kết quả phân bảng thi đấu các đội
                                                </h4>

                                                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                    <div *ngFor="let g of currTournament.groups" class="p-4 border border-surface-200 rounded-xl bg-surface-50 dark:bg-surface-800 shadow-inner space-y-3">
                                                        <div class="font-black text-sm text-primary pb-1.5 border-b border-surface-200 flex justify-between items-center">
                                                            <span>BẢNG {{ g.groupName }}</span>
                                                            <span class="text-xxs px-2.5 py-0.5 bg-primary/10 text-primary rounded-full font-bold">Vòng loại</span>
                                                        </div>
                                                        <div class="space-y-2">
                                                            <div *ngFor="let comp of g.competitors"
                                                                 [title]="getTeamPlayersText(comp.id) ? ('Thành viên: ' + getTeamPlayersText(comp.id)) : comp.name"
                                                                 class="p-3 bg-white dark:bg-slate-900 border border-surface-200 rounded-lg flex flex-col gap-2 shadow-sm hover:border-primary/40 transition-colors">
                                                                <div class="flex items-center justify-between gap-2 font-bold text-xs text-slate-800 dark:text-slate-200">
                                                                    <div class="flex items-center gap-2">
                                                                        <i class="pi pi-shield text-slate-400 text-xs"></i>
                                                                        <span>{{ comp.name }}</span>
                                                                    </div>
                                                                    <span *ngIf="getTeamPlayersText(comp.id)" class="text-[10px] font-normal text-slate-400">
                                                                        {{ getTeamPlayersText(comp.id) }}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            <!-- Sub-state C: Draft, no teams divided yet -->
                                            <div *ngIf="(!currTournament.teams || currTournament.teams.length === 0) && currTournament.status === 'draft'" class="py-6 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-slate-400 text-xs">
                                                Chưa tiến hành bốc thăm phân chia đội hình/cặp đấu đồng bộ.
                                            </div>
                                        </div>
                                    </div>

                                <!-- Content Tab 2: Group Stage -->
                                <div *ngIf="detailTab === 'group'" class="space-y-6">
                                    <!-- Live Standings with Highlighting -->
                                    <div *ngIf="currTournament.standings?.length">
                                        <h3 class="text-lg font-bold mb-3 flex items-center gap-2">
                                            <i class="pi pi-table text-primary"></i> Bảng Điểm & Thứ Hạng Live
                                        </h3>
                                        <div *ngFor="let standing of currTournament.standings" class="mb-6">
                                            <h4 class="font-bold text-xs bg-slate-100 dark:bg-slate-800 p-2 rounded mb-2 flex items-center justify-between">
                                                <span>Bảng {{ standing.groupName }}</span>
                                                <span class="text-[10px] text-indigo-600 font-bold bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded">Vòng loại</span>
                                            </h4>
                                            <div class="overflow-auto border border-surface-200 rounded-lg shadow-sm">
                                                <table class="w-full border-collapse text-xs text-left">
                                                    <thead>
                                                        <tr class="bg-surface-50 border-b border-surface-200 text-slate-500 font-semibold">
                                                            <th class="py-2.5 px-3 text-center" style="width: 3rem">Hạng</th>
                                                            <th class="py-2.5 px-3">Đối thủ / Đội đồng bộ</th>
                                                            <th class="py-2.5 px-3 text-center">Trận</th>
                                                            <th class="py-2.5 px-3 text-center">Thắng</th>
                                                            <th class="py-2.5 px-3 text-center">Thua</th>
                                                            <th class="py-2.5 px-3 text-center">Hiệu số</th>
                                                            <th class="py-2.5 px-3 text-center font-bold">Điểm số</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        <tr *ngFor="let row of standing.rows" class="border-b border-surface-100 transition-all text-xs"
                                                            [title]="getTeamPlayersText(row.competitor.id) ? ('Thành viên: ' + getTeamPlayersText(row.competitor.id)) : row.competitor.name"
                                                            [class.bg-green-50/40]="row.rank <= 2" [class.dark:bg-green-950/10]="row.rank <= 2"
                                                            [class.bg-red-50/5]="row.rank > 2" [class.dark:bg-red-950/5]="row.rank > 2">
                                                            <td class="py-2.5 px-3 text-center font-extrabold" [class.text-green-600]="row.rank <= 2" [class.text-slate-400]="row.rank > 2">{{ row.rank }}</td>
                                                            <td class="py-2.5 px-3 font-bold flex items-center">
                                                                <span [class.text-green-700]="row.rank <= 2" [class.dark:text-green-400]="row.rank <= 2" [class.text-slate-400]="row.rank > 2" [class.line-through]="row.rank > 2">
                                                                    {{ row.competitor.name }}
                                                                </span>
                                                                <span *ngIf="row.rank <= 2" class="ml-2 text-[9px] font-bold bg-green-100 text-green-700 dark:bg-green-900/60 dark:text-green-300 px-1.5 py-0.5 rounded-full flex items-center gap-0.5"><i class="pi pi-check text-[8px]"></i>Đi Tiếp</span>
                                                                <span *ngIf="row.rank > 2" class="ml-2 text-[9px] font-bold bg-red-50 text-red-500 dark:bg-red-950/60 dark:text-red-400 px-1.5 py-0.5 rounded-full flex items-center gap-0.5"><i class="pi pi-times text-[8px]"></i>Bị Loại</span>
                                                            </td>
                                                            <td class="py-2.5 px-3 text-center" [class.text-slate-400]="row.rank > 2">{{ row.played }}</td>
                                                            <td class="py-2.5 px-3 text-center text-green-600 font-medium" [class.text-slate-400]="row.rank > 2">{{ row.won }}</td>
                                                            <td class="py-2.5 px-3 text-center text-red-500" [class.text-slate-400]="row.rank > 2">{{ row.lost }}</td>
                                                            <td class="py-2.5 px-3 text-center text-slate-500" [class.text-slate-400]="row.rank > 2">{{ row.pointsFor }}-{{ row.pointsAgainst }}</td>
                                                            <td class="py-2.5 px-3 text-center font-extrabold text-primary" [class.text-slate-400]="row.rank > 2">{{ row.matchPoints }}</td>
                                                        </tr>
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    </div>

                                    <!-- Group matches details with Switcher -->
                                    <div *ngIf="currTournament.scores?.length">
                                        <div class="flex items-center justify-between mb-4 border-b pb-3 flex-wrap gap-3">
                                            <h3 class="text-lg font-bold m-0 flex items-center gap-2">
                                                <i class="pi pi-calendar text-primary"></i> Danh Sách Trận Đấu Vòng Bảng
                                            </h3>
                                            
                                            <!-- Group filter dropdown & Sort dropdown -->
                                            <div class="flex items-center gap-4 flex-wrap">
                                                <div class="flex items-center gap-2">
                                                    <span class="text-xs font-bold text-slate-500">Xem theo bảng:</span>
                                                    <select class="p-1.5 bg-white dark:bg-slate-850 border border-slate-350 dark:border-slate-700 text-slate-850 dark:text-slate-200 rounded text-xs cursor-pointer font-bold" [(ngModel)]="selectedGroupFilter">
                                                        <option value="All">Tất cả các bảng</option>
                                                        <option *ngFor="let g of currTournament.groups" [value]="g.groupName">Bảng {{ g.groupName }}</option>
                                                    </select>
                                                </div>
                                                <div class="flex items-center gap-2">
                                                    <span class="text-xs font-bold text-slate-500">Sắp xếp:</span>
                                                    <select class="p-1.5 bg-white dark:bg-slate-850 border border-slate-350 dark:border-slate-700 text-slate-850 dark:text-slate-200 rounded text-xs cursor-pointer font-bold" [(ngModel)]="selectedMatchSortOrder">
                                                        <option value="group">Theo Bảng đấu (A-Z)</option>
                                                        <option value="status-unplayed">Chưa thi đấu trước</option>
                                                        <option value="status-played">Đã hoàn thành trước</option>
                                                    </select>
                                                </div>
                                            </div>
                                        </div>

                                        <div class="overflow-auto border border-surface-200 rounded-xl bg-white dark:bg-slate-900 shadow-sm mb-6">
                                            <table class="w-full border-collapse text-xs text-left">
                                                <thead>
                                                    <tr class="bg-surface-50 border-b border-surface-200 text-slate-550 font-semibold">
                                                        <th class="py-3 px-4 text-center" style="width: 90px">Bảng</th>
                                                        <th class="py-3 px-4 text-right" style="width: 26%">Đội / VĐV</th>
                                                        <th class="py-3 px-4 text-center font-bold" style="width: 110px">Tỷ số</th>
                                                        <th class="py-3 px-4 text-left" style="width: 26%">Đội / VĐV</th>
                                                        <th class="py-3 px-4 text-center" style="width: 22%">Tỷ lệ chấp</th>
                                                        <th class="py-3 px-4 text-center" *ngIf="currTournament.type === 'team'" style="width: 130px">Chi tiết</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    <ng-container *ngFor="let match of getSortedMatches()">
                                                        <ng-container *ngIf="selectedGroupFilter === 'All' || selectedGroupFilter === match.groupName">
                                                            <!-- Main Team Match Row -->
                                                            <tr class="border-b border-surface-100 hover:bg-surface-50/50 dark:hover:bg-slate-800/45 transition-all font-semibold"
                                                                [class.bg-slate-50/50]="currTournament.type === 'team' && match.lineup"
                                                                [class.dark:bg-slate-800/40]="currTournament.type === 'team' && match.lineup">
                                                                
                                                                <!-- Group -->
                                                                <td class="py-3 px-4 text-center font-bold text-slate-500">
                                                                    <div class="flex items-center justify-center gap-1">
                                                                        <button *ngIf="currTournament.type === 'team' && match.lineup" 
                                                                                class="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded transition text-slate-500 cursor-pointer flex items-center justify-center border-none bg-transparent"
                                                                                (click)="toggleMatchExpansion(match)">
                                                                            <i class="pi" [class.pi-chevron-right]="!isMatchExpanded(match)" [class.pi-chevron-down]="isMatchExpanded(match)"></i>
                                                                        </button>
                                                                        <span>Bảng {{ match.groupName }}</span>
                                                                    </div>
                                                                    <div *ngIf="currTournament.type === 'team' && match.lineup" class="mt-1">
                                                                        <span class="px-1.5 py-0.2 rounded-full text-[9px] font-extrabold bg-indigo-100 text-indigo-700 dark:bg-indigo-950/45 dark:text-indigo-300">
                                                                            Trận đội
                                                                        </span>
                                                                    </div>
                                                                </td>
                                                                
                                                                <!-- Home Competitor -->
                                                                <td class="py-3 px-4 text-right">
                                                                    <div class="font-bold text-slate-800 dark:text-slate-200" [class.text-green-600]="match.homeScore > match.awayScore">
                                                                        {{ getCompetitorDetailText(match.homeCompetitorId) }}
                                                                        <span *ngIf="match.lineup" class="ml-1.5 px-1.5 py-0.2 bg-teal-100 text-teal-800 dark:bg-teal-950/40 dark:text-teal-300 rounded text-[9px] font-extrabold uppercase">
                                                                            {{ match.lineup.isHomeABC !== false ? 'ABC' : 'XYZ' }}
                                                                        </span>
                                                                    </div>
                                                                    <div class="text-[10px] text-slate-400 font-normal mt-1 flex flex-col items-end gap-0.5" *ngIf="currTournament.type === 'team'">
                                                                        <div *ngFor="let p of getTeamPlayers(match.homeCompetitorId)">
                                                                            {{ p.name }} <span class="text-[9px] text-slate-400">(Hạng {{ getMemberRank(p.id) }})</span>
                                                                        </div>
                                                                    </div>
                                                                </td>
                                                                
                                                                <!-- Score Display -->
                                                                <td class="py-3 px-4 text-center">
                                                                    <div class="flex flex-col items-center gap-0.5">
                                                                        <span class="font-bold bg-surface-100 dark:bg-surface-700 px-3 py-1 rounded text-xs">
                                                                            {{ match.homeScore || 0 }} - {{ match.awayScore || 0 }}
                                                                        </span>
                                                                        <div *ngIf="match.setScores && match.setScores.length > 0" class="text-[9px] text-slate-400 font-normal">
                                                                            (<span *ngFor="let set of match.setScores; let last = last">{{ set.home }}-{{ set.away }}{{ last ? '' : ', ' }}</span>)
                                                                        </div>
                                                                    </div>
                                                                </td>
                                                                
                                                                <!-- Away Competitor -->
                                                                <td class="py-3 px-4 text-left">
                                                                    <div class="font-bold text-slate-800 dark:text-slate-200" [class.text-green-600]="match.awayScore > match.homeScore">
                                                                        {{ getCompetitorDetailText(match.awayCompetitorId) }}
                                                                        <span *ngIf="match.lineup" class="ml-1.5 px-1.5 py-0.2 bg-teal-100 text-teal-800 dark:bg-teal-950/40 dark:text-teal-300 rounded text-[9px] font-extrabold uppercase">
                                                                            {{ match.lineup.isHomeABC !== false ? 'XYZ' : 'ABC' }}
                                                                        </span>
                                                                    </div>
                                                                    <div class="text-[10px] text-slate-400 font-normal mt-1 flex flex-col items-start gap-0.5" *ngIf="currTournament.type === 'team'">
                                                                        <div *ngFor="let p of getTeamPlayers(match.awayCompetitorId)">
                                                                            {{ p.name }} <span class="text-[9px] text-slate-400">(Hạng {{ getMemberRank(p.id) }})</span>
                                                                        </div>
                                                                    </div>
                                                                </td>
                                                                
                                                                <!-- Handicap ratio -->
                                                                <td class="py-3 px-4 text-center">
                                                                    <span class="px-2 py-0.5 bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 rounded font-bold text-[10px]">
                                                                        {{ getMatchHandicapText(match) }}
                                                                    </span>
                                                                </td>
                                                                
                                                                <!-- Detail Action for Team -->
                                                                <td class="py-3 px-4 text-center" *ngIf="currTournament.type === 'team'">
                                                                    <button class="px-2.5 py-1 bg-primary text-white rounded text-xxs font-bold hover:bg-primary-600 transition flex items-center gap-0.5 justify-center mx-auto" *ngIf="match.lineup" (click)="openTeamDetails(match)">
                                                                        Xem tỷ số
                                                                    </button>
                                                                </td>
                                                            </tr>
                                                            
                                                            <!-- Collapsible team sub-matches rows -->
                                                            <ng-container *ngIf="currTournament.type === 'team' && match.lineup && isMatchExpanded(match)">
                                                                <tr *ngFor="let sub of match.subMatches; let subIdx = index" 
                                                                    class="bg-cyan-50/55 dark:bg-slate-900/85 border-b border-cyan-100 dark:border-slate-800 text-[10.5px] text-slate-550 dark:text-slate-350 hover:bg-cyan-50/80 dark:hover:bg-slate-800/70 transition">
                                                                    <td class="py-1.5 px-4 text-center text-slate-450 dark:text-slate-350 font-semibold">
                                                                        <div class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-cyan-100 text-cyan-700 dark:bg-cyan-950/35 dark:text-cyan-300 text-[9px] font-extrabold">
                                                                            <i class="pi pi-angle-double-right text-[8px]"></i>
                                                                            Trận con {{ subIdx + 1 }}
                                                                        </div>
                                                                    </td>
                                                                    <td class="py-1.5 px-4 text-right pr-6">
                                                                        <div class="flex flex-col items-end gap-0.5">
                                                                            <div *ngFor="let pid of sub.homePlayers" class="font-semibold text-slate-700 dark:text-slate-200">
                                                                                {{ memberName(pid) }} <span class="text-slate-400 font-normal">(Hạng {{ getMemberRank(pid) }})</span>
                                                                            </div>
                                                                        </div>
                                                                    </td>
                                                                    <td class="py-1.5 px-4 text-center">
                                                                        <span class="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded font-semibold text-slate-750 dark:text-slate-300">
                                                                            {{ sub.homeScore }} - {{ sub.awayScore }}
                                                                        </span>
                                                                        <div *ngIf="sub.setScores && sub.setScores.length > 0" class="text-[9px] text-slate-400 font-normal mt-0.5 whitespace-nowrap">
                                                                            <span *ngFor="let set of sub.setScores; let setIdx = index; let last = last">
                                                                                {{ set.home }}-{{ set.away }}{{ last ? '' : ', ' }}
                                                                            </span>
                                                                        </div>
                                                                    </td>
                                                                    <td class="py-1.5 px-4 text-left pl-6">
                                                                        <div class="flex flex-col items-start gap-0.5">
                                                                            <div *ngFor="let pid of sub.awayPlayers" class="font-semibold text-slate-700 dark:text-slate-200">
                                                                                {{ memberName(pid) }} <span class="text-slate-400 font-normal">(Hạng {{ getMemberRank(pid) }})</span>
                                                                            </div>
                                                                        </div>
                                                                    </td>
                                                                    <td class="py-1.5 px-4 text-center">
                                                                        <span class="px-1.5 py-0.2 bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 rounded font-extrabold text-[9px]">
                                                                            {{ getTeamSubMatchHandicapText(sub.handicapText) }}
                                                                        </span>
                                                                    </td>
                                                                    <td class="py-1.5 px-4 text-center">
                                                                        <span class="text-[9px] px-1.5 py-0.2 bg-cyan-100 text-cyan-700 dark:bg-cyan-950/35 dark:text-cyan-300 rounded font-bold">
                                                                            {{ sub.matchType === 'double' ? 'Đánh đôi' : 'Đánh đơn' }}
                                                                        </span>
                                                                    </td>
                                                                </tr>
                                                            </ng-container>
                                                        </ng-container>
                                                    </ng-container>
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>

                                <!-- Content Tab 3: Knockout Stage -->
                                <div *ngIf="detailTab === 'knockout'" class="space-y-6">
                                    <h3 class="text-lg font-bold mb-3 flex items-center gap-2 border-b border-surface-200 pb-2 m-0 text-slate-800 dark:text-slate-100">
                                        <i class="pi pi-sitemap text-primary"></i> Nhánh Đấu Trực Tiếp (Knockout Bracket)
                                    </h3>

                                    <div class="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
                                        <!-- Column 1: Semifinals -->
                                        <div class="space-y-4">
                                            <div class="text-center font-bold text-xs uppercase tracking-wider text-slate-500 bg-slate-100 dark:bg-slate-800 py-1.5 rounded-lg">Vòng Bán Kết</div>
                                            
                                            <div *ngFor="let m of getKnockoutMatchesByRound('Semifinals')" class="p-4 border border-surface-200 dark:border-surface-800 bg-surface-50 dark:bg-surface-900/40 rounded-xl space-y-2.5 shadow-inner animate-fadein">
                                                <div class="text-xs text-primary font-bold">Mã trận: {{ m.id.toUpperCase() }}</div>
                                                <div class="space-y-1.5">
                                                    <div class="flex items-center justify-between text-sm">
                                                        <span class="text-xs font-semibold w-36 truncate flex items-center" [title]="competitorName(m.homeCompetitorId)" 
                                                              [class.text-green-600]="m.winnerId === m.homeCompetitorId" [class.font-bold]="m.winnerId === m.homeCompetitorId"
                                                              [class.text-slate-400]="m.winnerId && m.winnerId !== m.homeCompetitorId" [class.line-through]="m.winnerId && m.winnerId !== m.homeCompetitorId">
                                                            <i *ngIf="m.winnerId === m.homeCompetitorId" class="pi pi-check-circle text-green-600 mr-1"></i>
                                                            <i *ngIf="m.winnerId && m.winnerId !== m.homeCompetitorId" class="pi pi-times-circle text-slate-400 mr-1"></i>
                                                            <i *ngIf="!m.winnerId" class="pi pi-user text-slate-400 mr-1"></i>
                                                            {{ competitorName(m.homeCompetitorId) }}
                                                        </span>
                                                        <span class="font-bold bg-white dark:bg-slate-900 px-2 py-0.5 rounded text-xs">{{ m.homeScore }}</span>
                                                    </div>
                                                    <div class="flex items-center justify-between text-sm">
                                                        <span class="text-xs font-semibold w-36 truncate flex items-center" [title]="competitorName(m.awayCompetitorId)" 
                                                              [class.text-green-600]="m.winnerId === m.awayCompetitorId" [class.font-bold]="m.winnerId === m.awayCompetitorId"
                                                              [class.text-slate-400]="m.winnerId && m.winnerId !== m.awayCompetitorId" [class.line-through]="m.winnerId && m.winnerId !== m.awayCompetitorId">
                                                            <i *ngIf="m.winnerId === m.awayCompetitorId" class="pi pi-check-circle text-green-600 mr-1"></i>
                                                            <i *ngIf="m.winnerId && m.winnerId !== m.awayCompetitorId" class="pi pi-times-circle text-slate-400 mr-1"></i>
                                                            <i *ngIf="!m.winnerId" class="pi pi-user text-slate-400 mr-1"></i>
                                                            {{ competitorName(m.awayCompetitorId) }}
                                                        </span>
                                                        <span class="font-bold bg-white dark:bg-slate-900 px-2 py-0.5 rounded text-xs">{{ m.awayScore }}</span>
                                                    </div>
                                                    <!-- Show brief set points if any -->
                                                    <div *ngIf="m.setScores && m.setScores.length > 0" class="text-[9px] text-slate-400 font-normal mt-0.5 text-center">
                                                        (<span *ngFor="let set of m.setScores; let last = last">{{ set.home }}-{{ set.away }}{{ last ? '' : ', ' }}</span>)
                                                    </div>
                                                </div>
                                                <div class="flex justify-end pt-1" *ngIf="currTournament.type === 'team'">
                                                    <button class="px-2 py-0.5 bg-primary text-white rounded text-[10px] font-bold hover:bg-primary-600 transition flex items-center gap-1" *ngIf="m.lineup" (click)="openTeamDetails(m)">
                                                        <i class="pi pi-eye text-[9px]"></i> Chi tiết trận đồng đội
                                                    </button>
                                                </div>
                                            </div>

                                            <div *ngIf="!getKnockoutMatchesByRound('Semifinals').length" class="py-12 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-slate-400 text-xs">
                                                Không có trận bán kết.
                                            </div>
                                        </div>

                                        <!-- Column 2: Finals -->
                                        <div class="space-y-4">
                                            <div class="text-center font-bold text-xs uppercase tracking-wider text-slate-500 bg-slate-100 dark:bg-slate-800 py-1.5 rounded-lg">Chung Kết & Tranh Giải Ba</div>
                                            
                                            <ng-container *ngIf="getFinalMatch(); else finalNotGenerated">
                                                <div class="p-4 border-2 border-indigo-200 dark:border-indigo-900 bg-indigo-50/10 rounded-xl space-y-2.5 shadow-md">
                                                    <div class="text-xs text-indigo-600 dark:text-indigo-400 font-extrabold flex items-center gap-1"><i class="pi pi-star-fill"></i> TRANH CÚP VÔ ĐỊCH</div>
                                                    <div class="space-y-1.5">
                                                        <div class="flex items-center justify-between text-sm">
                                                            <span class="text-xs font-semibold w-36 truncate flex items-center" [title]="competitorName(getFinalMatch().homeCompetitorId)" 
                                                                  [class.text-green-600]="getFinalMatch().winnerId === getFinalMatch().homeCompetitorId" [class.font-bold]="getFinalMatch().winnerId === getFinalMatch().homeCompetitorId"
                                                                  [class.text-slate-400]="getFinalMatch().winnerId && getFinalMatch().winnerId !== getFinalMatch().homeCompetitorId" [class.line-through]="getFinalMatch().winnerId && getFinalMatch().winnerId !== getFinalMatch().homeCompetitorId">
                                                                <i *ngIf="getFinalMatch().winnerId === getFinalMatch().homeCompetitorId" class="pi pi-check-circle text-green-600 mr-1"></i>
                                                                <i *ngIf="getFinalMatch().winnerId && getFinalMatch().winnerId !== getFinalMatch().homeCompetitorId" class="pi pi-times-circle text-slate-400 mr-1"></i>
                                                                <i *ngIf="!getFinalMatch().winnerId" class="pi pi-user text-slate-400 mr-1"></i>
                                                                {{ competitorName(getFinalMatch().homeCompetitorId) }}
                                                            </span>
                                                            <span class="font-bold bg-white dark:bg-slate-900 px-2 py-0.5 rounded text-xs">{{ getFinalMatch().homeScore }}</span>
                                                        </div>
                                                        <div class="flex items-center justify-between text-sm">
                                                            <span class="text-xs font-semibold w-36 truncate flex items-center" [title]="competitorName(getFinalMatch().awayCompetitorId)" 
                                                                  [class.text-green-600]="getFinalMatch().winnerId === getFinalMatch().awayCompetitorId" [class.font-bold]="getFinalMatch().winnerId === getFinalMatch().awayCompetitorId"
                                                                  [class.text-slate-400]="getFinalMatch().winnerId && getFinalMatch().winnerId !== getFinalMatch().awayCompetitorId" [class.line-through]="getFinalMatch().winnerId && getFinalMatch().winnerId !== getFinalMatch().awayCompetitorId">
                                                                <i *ngIf="getFinalMatch().winnerId === getFinalMatch().awayCompetitorId" class="pi pi-check-circle text-green-600 mr-1"></i>
                                                                <i *ngIf="getFinalMatch().winnerId && getFinalMatch().winnerId !== getFinalMatch().awayCompetitorId" class="pi pi-times-circle text-slate-400 mr-1"></i>
                                                                <i *ngIf="!getFinalMatch().winnerId" class="pi pi-user text-slate-400 mr-1"></i>
                                                                {{ competitorName(getFinalMatch().awayCompetitorId) }}
                                                            </span>
                                                            <span class="font-bold bg-white dark:bg-slate-900 px-2 py-0.5 rounded text-xs">{{ getFinalMatch().awayScore }}</span>
                                                        </div>
                                                    </div>
                                                    <!-- Show brief set points if any -->
                                                    <div *ngIf="getFinalMatch().setScores && getFinalMatch().setScores.length > 0" class="text-[9px] text-slate-400 font-normal mt-0.5 text-center">
                                                        (<span *ngFor="let set of getFinalMatch().setScores; let last = last">{{ set.home }}-{{ set.away }}{{ last ? '' : ', ' }}</span>)
                                                    </div>
                                                    <div class="flex justify-end pt-1" *ngIf="currTournament.type === 'team'">
                                                        <button class="px-2 py-0.5 bg-primary text-white rounded text-[10px] font-bold hover:bg-primary-600 transition flex items-center gap-1" *ngIf="getFinalMatch().lineup" (click)="openTeamDetails(getFinalMatch())">
                                                            <i class="pi pi-eye text-[9px]"></i> Chi tiết trận đồng đội
                                                        </button>
                                                    </div>
                                                </div>

                                                <!-- 3rd Place Match Card -->
                                                <div *ngIf="getBronzeMatch() as bm" class="p-4 border border-surface-200 dark:border-surface-800 bg-surface-50 dark:bg-surface-900/20 rounded-xl space-y-2.5 shadow-inner mt-4">
                                                    <div class="text-xs text-amber-600 dark:text-amber-400 font-extrabold flex items-center gap-1"><i class="pi pi-star-fill"></i> TRANH GIẢI BA</div>
                                                    <div class="space-y-1.5">
                                                        <div class="flex items-center justify-between text-sm">
                                                            <span class="text-xs font-semibold w-36 truncate flex items-center" [title]="competitorName(bm.homeCompetitorId)" 
                                                                  [class.text-green-600]="bm.winnerId === bm.homeCompetitorId" [class.font-bold]="bm.winnerId === bm.homeCompetitorId"
                                                                  [class.text-slate-400]="bm.winnerId && bm.winnerId !== bm.homeCompetitorId" [class.line-through]="bm.winnerId && bm.winnerId !== bm.homeCompetitorId">
                                                                <i *ngIf="bm.winnerId === bm.homeCompetitorId" class="pi pi-check-circle text-green-600 mr-1"></i>
                                                                <i *ngIf="bm.winnerId && bm.winnerId !== bm.homeCompetitorId" class="pi pi-times-circle text-slate-400 mr-1"></i>
                                                                <i *ngIf="!bm.winnerId" class="pi pi-user text-slate-400 mr-1"></i>
                                                                {{ competitorName(bm.homeCompetitorId) }}
                                                            </span>
                                                            <span class="font-bold bg-white dark:bg-slate-900 px-2 py-0.5 rounded text-xs">{{ bm.homeScore }}</span>
                                                        </div>
                                                        <div class="flex items-center justify-between text-sm">
                                                            <span class="text-xs font-semibold w-36 truncate flex items-center" [title]="competitorName(bm.awayCompetitorId)" 
                                                                  [class.text-green-600]="bm.winnerId === bm.awayCompetitorId" [class.font-bold]="bm.winnerId === bm.awayCompetitorId"
                                                                  [class.text-slate-400]="bm.winnerId && bm.winnerId !== bm.awayCompetitorId" [class.line-through]="bm.winnerId && bm.winnerId !== bm.awayCompetitorId">
                                                                <i *ngIf="bm.winnerId === bm.awayCompetitorId" class="pi pi-check-circle text-green-600 mr-1"></i>
                                                                <i *ngIf="bm.winnerId && bm.winnerId !== bm.awayCompetitorId" class="pi pi-times-circle text-slate-400 mr-1"></i>
                                                                <i *ngIf="!bm.winnerId" class="pi pi-user text-slate-400 mr-1"></i>
                                                                {{ competitorName(bm.awayCompetitorId) }}
                                                            </span>
                                                            <span class="font-bold bg-white dark:bg-slate-900 px-2 py-0.5 rounded text-xs">{{ bm.awayScore }}</span>
                                                        </div>
                                                    </div>
                                                    <!-- Show brief set points if any -->
                                                    <div *ngIf="bm.setScores && bm.setScores.length > 0" class="text-[9px] text-slate-400 font-normal mt-0.5 text-center">
                                                        (<span *ngFor="let set of bm.setScores; let last = last">{{ set.home }}-{{ set.away }}{{ last ? '' : ', ' }}</span>)
                                                    </div>
                                                    <div class="flex justify-end pt-1" *ngIf="currTournament.type === 'team'">
                                                        <button class="px-2 py-0.5 bg-primary text-white rounded text-[10px] font-bold hover:bg-primary-600 transition flex items-center gap-1" *ngIf="bm.lineup" (click)="openTeamDetails(bm)">
                                                            <i class="pi pi-eye text-[9px]"></i> Chi tiết trận đồng đội
                                                        </button>
                                                    </div>
                                                </div>
                                            </ng-container>
                                                
                                                <ng-template #finalNotGenerated>
                                                    <div class="py-16 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-slate-400 text-xs">
                                                        <i class="pi pi-lock block text-xl mb-1"></i>
                                                        Đang chờ kết quả Bán kết...
                                                    </div>
                                                </ng-template>
                                            </div>

                                            <!-- Column 3: Champion -->
                                            <div class="space-y-4">
                                                <div class="text-center font-bold text-xs uppercase tracking-wider text-slate-500 bg-slate-100 dark:bg-slate-800 py-1.5 rounded-lg">Nhà Vô Địch</div>
                                                
                                                <div *ngIf="getFinalMatch()?.winnerId; else championNotResolved" class="p-6 border-2 border-amber-300 dark:border-amber-700 bg-gradient-to-br from-amber-50 to-amber-100/30 dark:from-amber-950/20 dark:to-surface-900 rounded-2xl text-center space-y-4 shadow-lg animate-fadein">
                                                    <div class="flex justify-center">
                                                        <div class="w-16 h-16 bg-amber-500 text-white rounded-full flex items-center justify-center shadow-lg shadow-amber-500/20 font-black text-2xl">
                                                            🏆
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <div class="text-xs text-amber-600 dark:text-amber-400 font-extrabold uppercase tracking-wider">CHAMPION</div>
                                                        <h3 class="text-xl font-black text-slate-900 dark:text-white m-0 mt-1.5">{{ competitorName(getFinalMatch().winnerId) }}</h3>
                                                    </div>
                                                    <div class="text-xs text-slate-500 font-normal">
                                                        Giải đấu {{ currTournament.name }}
                                                    </div>
                                                </div>

                                                <ng-template #championNotResolved>
                                                    <div class="py-20 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-slate-400 text-xs">
                                                        <i class="pi pi-trophy block text-2xl mb-1 text-slate-300"></i>
                                                        Chưa xác định Nhà vô địch...
                                                    </div>
                                                </ng-template>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>




                </div>
            </div>
        </div>

        <!-- Dialog Xem Chi Tiết Đồng Đội ABC-XYZ (Read Only) -->
        <p-dialog [(visible)]="showTeamDetailsDialog" header="Chi Tiết Trận Đấu Đồng Đội ABC-XYZ" [modal]="true" [style]="{ width: '650px' }" [draggable]="false" [resizable]="false">
            <div class="space-y-4 pt-3 text-xs" *ngIf="selectedTeamMatch && currTournament">
                <div class="flex items-center justify-between p-3 bg-surface-100 dark:bg-surface-900 border rounded-lg">
                    <div class="font-black text-slate-800 dark:text-slate-100">
                        {{ competitorName(selectedTeamMatch.homeCompetitorId) }} vs {{ competitorName(selectedTeamMatch.awayCompetitorId) }}
                    </div>
                    <div class="flex items-center gap-2 font-black text-sm text-primary">
                        Tỷ số tổng: {{ selectedTeamMatch.homeScore || 0 }} - {{ selectedTeamMatch.awayScore || 0 }}
                    </div>
                </div>

                <div class="space-y-3">
                    <div *ngFor="let sub of selectedTeamMatch.subMatches" class="p-3 border rounded-xl bg-surface-50 dark:bg-surface-800/40 space-y-2">
                        <div class="flex justify-between items-start">
                            <span class="font-bold text-slate-700 dark:text-slate-300 text-[11px]">{{ sub.label }}</span>
                            <span class="px-2 py-0.5 bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 rounded font-bold text-[10px]" *ngIf="sub.handicapText">
                                {{ getTeamSubMatchHandicapText(sub.handicapText) }}
                            </span>
                        </div>

                        <div class="flex items-center justify-between pt-1 border-t border-dashed border-slate-200 dark:border-slate-700">
                            <div class="font-semibold text-slate-500">Tỉ số séc:</div>
                            <div class="flex flex-col items-center">
                                <div class="font-black text-sm">
                                    <span class="px-2 py-0.5 bg-slate-200 dark:bg-slate-700 rounded text-slate-800 dark:text-slate-200">{{ sub.homeScore || 0 }}</span>
                                    <span class="mx-2 text-slate-400">-</span>
                                    <span class="px-2 py-0.5 bg-slate-200 dark:bg-slate-700 rounded text-slate-800 dark:text-slate-200">{{ sub.awayScore || 0 }}</span>
                                </div>
                                <div *ngIf="sub.setScores && sub.setScores.length > 0" class="text-[9px] text-slate-400 font-normal mt-0.5 whitespace-nowrap">
                                    (
                                    <span *ngFor="let set of sub.setScores; let setIdx = index; let last = last">
                                        {{ set.home }}-{{ set.away }}{{ last ? '' : ', ' }}
                                    </span>
                                    )
                                </div>
                            </div>
                            <div>
                                <span class="text-green-600 font-bold" *ngIf="sub.completed && sub.homeScore > sub.awayScore"><i class="pi pi-check"></i> {{ competitorName(selectedTeamMatch.homeCompetitorId) }} thắng</span>
                                <span class="text-green-600 font-bold" *ngIf="sub.completed && sub.awayScore > sub.homeScore"><i class="pi pi-check"></i> {{ competitorName(selectedTeamMatch.awayCompetitorId) }} thắng</span>
                                <span class="text-slate-400 font-semibold" *ngIf="!sub.completed">Chưa đấu</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="flex justify-end pt-3 border-t">
                    <p-button label="Đóng" severity="secondary" [outlined]="true" (onClick)="showTeamDetailsDialog = false" />
                </div>
            </div>
        </p-dialog>
    `,
    styles: [`
        :host {
            display: block;
        }

        .portal-shell {
            position: relative;
            isolation: isolate;
        }

        .portal-shell .card {
            border-radius: 1rem;
            border: 1px solid rgba(148, 163, 184, 0.34) !important;
            background: linear-gradient(180deg, rgba(255, 255, 255, 0.95), rgba(248, 250, 252, 0.9));
            box-shadow: 0 8px 24px rgba(15, 23, 42, 0.07);
            backdrop-filter: blur(3px);
            transition: box-shadow 0.18s ease, border-color 0.18s ease;
        }

        .portal-shell .card:hover {
            border-color: rgba(14, 165, 233, 0.48) !important;
            box-shadow: 0 14px 32px rgba(15, 23, 42, 0.1);
        }

        .portal-shell h3,
        .portal-shell h4 {
            letter-spacing: 0.01em;
        }

        .portal-shell table th {
            text-transform: uppercase;
            letter-spacing: 0.04em;
            font-size: 0.72rem;
            color: rgb(71 85 105);
        }

        .portal-shell table td {
            vertical-align: middle;
        }

        .portal-shell table tbody tr {
            transition: background-color 0.16s ease;
        }

        .portal-shell table tbody tr:hover {
            background: rgba(56, 189, 248, 0.08) !important;
        }

        .portal-shell input,
        .portal-shell select,
        .portal-shell textarea,
        .portal-shell .p-inputtext {
            border-radius: 0.65rem;
            border-color: rgba(148, 163, 184, 0.5);
        }

        .portal-shell input:focus,
        .portal-shell select:focus,
        .portal-shell textarea:focus,
        .portal-shell .p-inputtext:focus {
            outline: none;
            border-color: rgba(56, 189, 248, 0.7);
            box-shadow: 0 0 0 3px rgba(56, 189, 248, 0.2);
        }

        .portal-shell button {
            border-radius: 0.65rem;
            transition: transform 0.16s ease, box-shadow 0.16s ease;
        }

        .portal-shell button:hover {
            transform: translateY(-1px);
        }

        :host-context(.app-dark) .portal-shell .card {
            border-color: rgba(71, 85, 105, 0.58) !important;
            background: linear-gradient(180deg, rgba(15, 23, 42, 0.78), rgba(2, 6, 23, 0.72));
            box-shadow: 0 12px 30px rgba(2, 6, 23, 0.35);
        }

        :host-context(.app-dark) .portal-shell table th {
            color: rgb(148 163 184);
        }

        :host-context(.app-dark) .portal-shell table tbody tr:hover {
            background: rgba(56, 189, 248, 0.12) !important;
        }

        :host-context(.app-dark) .portal-shell input,
        :host-context(.app-dark) .portal-shell select,
        :host-context(.app-dark) .portal-shell textarea,
        :host-context(.app-dark) .portal-shell .p-inputtext {
            border-color: rgba(100, 116, 139, 0.55);
            background-color: rgba(15, 23, 42, 0.8);
        }

        @media (prefers-reduced-motion: reduce) {
            .portal-shell .card,
            .portal-shell button,
            .portal-shell table tbody tr {
                transition: none !important;
            }

            .portal-shell button:hover {
                transform: none !important;
            }
        }
    `]
})
export class UserPortal implements OnInit {
    isRefreshing = false;

    refreshAllData(): void {
        this.isRefreshing = true;
        this.dataService.reloadAll().then(() => {
            this.allTournaments = this.dataService.getTournaments();
            const currentId = this.currentUser?.id;
            if (currentId) {
                this.currentUser = this.dataService.getMemberById(currentId);
            }
            this.isRefreshing = false;
        }).catch(() => { this.isRefreshing = false; });
    }

    activeTab = 'challenges';
    tabs = [
        { id: 'challenges', label: 'Thách Đấu', icon: 'pi pi-send' },
        { id: 'matches', label: 'Kết Quả & Xác Nhận', icon: 'pi pi-check-circle' },
        { id: 'tournaments', label: 'Giải Đấu', icon: 'pi pi-sitemap' }
    ];

    currentUserId = 'u01'; // Default
    activeMembers: Member[] = [];
    currentUser: Member | null = null;
    opponents: Member[] = [];

    // Personal lists
    myMatches: MatchRecord[] = [];
    myChallenges: ChallengeRequest[] = [];
    myNotifications: AppNotification[] = [];
    pendingApprovals: MatchRecord[] = [];

    // Form states
    challengeForm = {
        opponentId: '',
        preferredTime: this.buildDefaultPreferredTime(),
        bestOf: 5 as 3 | 5 | 7,
        note: ''
    };
    opponentSearchKeyword = '';
    challengeMessage = 'Gửi kèo giao hữu hoặc đấu hạng tính Elo.';

    newMatch = {
        awayPlayerId: '',
        homeScore: 3,
        awayScore: 1,
        notes: ''
    };
    lastMatchMessage = 'Kết quả tự động gửi cho đối thủ để đảm bảo tính minh bạch.';

    // Tournaments lists
    allTournaments: Tournament[] = [];
    selectedTournamentId = '';
    currTournament: Tournament | null = null;
    tournamentViewMode: 'list' | 'detail' = 'list';
    detailTab: 'overview' | 'players' | 'group' | 'knockout' = 'overview';
    selectedGroupFilter = 'All';
    selectedMatchSortOrder = 'group';
    collapsedMatchKeys = new Set<string>();
    tournamentSearchKeyword = '';
    tournamentStatusFilter: 'all' | 'draft' | 'ongoing' | 'finished' = 'all';
    tournamentFormatFilter: 'all' | 'group' | 'round_robin' = 'all';

    // Team tournament match details
    showTeamDetailsDialog = false;
    selectedTeamMatch: any = null;

    // Charts properties
    hasMatches = false;
    eloChartData: any;
    eloChartOptions: any;

    constructor(
        private readonly dataService: EvnictDataService,
        private readonly router: Router,
        private readonly route: ActivatedRoute
    ) {}

    ngOnInit(): void {
        const loggedIn = this.dataService.getLoggedInUserId();
        if (!loggedIn) {
            this.router.navigate(['/auth/login']);
            return;
        }

        const member = this.dataService.getMemberById(loggedIn);
        if (!member || !member.roles.includes('player')) {
            alert('Ban khong co quyen truy cap trang thanh vien!');
            this.router.navigate(['/admin']);
            return;
        }

        this.currentUserId = loggedIn;
        this.reloadAll();

        // Listen to tab query parameter
        this.route.queryParams.subscribe(params => {
            const tab = (params['tab'] || '').toString();
            const validTabs = ['challenges', 'matches', 'tournaments'];
            this.activeTab = validTabs.includes(tab) ? tab : 'challenges';
        });
    }

    switchUser(newUserId: string): void {
        this.currentUserId = newUserId;
        this.dataService.setLoggedInUserForTest(newUserId);
        this.reloadAll();
    }

    async createChallenge(): Promise<void> {
        if (!this.challengeForm.opponentId) {
            this.challengeMessage = 'Vui lòng chọn đối thủ!';
            return;
        }

        try {
            await this.dataService.createChallenge({
                challengerId: this.currentUserId,
                opponentId: this.challengeForm.opponentId,
                preferredTime: this.challengeForm.preferredTime,
                bestOf: this.challengeForm.bestOf,
                note: this.challengeForm.note
            });

            this.challengeMessage = 'Đã gửi lời mời thách đấu thành công!';
            this.challengeForm.note = '';
            this.reloadAll();
        } catch (error) {
            console.error('Create challenge failed', error);
            this.challengeMessage = 'Không thể lưu lời mời thách đấu. Vui lòng kiểm tra lại thời gian hoặc kết nối backend.';
        }
    }

    get filteredOpponents(): Member[] {
        const keyword = this.opponentSearchKeyword.trim().toLowerCase();
        if (!keyword) {
            return this.opponents;
        }

        return this.opponents.filter((member) =>
            member.fullName.toLowerCase().includes(keyword) || (member.department || '').toLowerCase().includes(keyword)
        );
    }

    private buildDefaultPreferredTime(): string {
        const d = new Date();
        d.setHours(d.getHours() + 1, 0, 0, 0);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        const hh = String(d.getHours()).padStart(2, '0');
        const min = String(d.getMinutes()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
    }

    acceptChallenge(id: string): void {
        this.dataService.acceptChallenge(id);
        this.reloadAll();
    }

    declineChallenge(id: string): void {
        this.dataService.declineChallenge(id);
        this.reloadAll();
    }

    cancelChallenge(id: string): void {
        this.dataService.cancelChallenge(id);
        this.reloadAll();
    }

    recordMatch(): void {
        if (!this.newMatch.awayPlayerId) {
            this.lastMatchMessage = 'Vui lòng chọn đối thủ.';
            return;
        }

        if (this.newMatch.awayPlayerId === this.currentUserId) {
            this.lastMatchMessage = 'Không thể tự thách đấu chính mình.';
            return;
        }

        if (this.newMatch.homeScore === this.newMatch.awayScore) {
            this.lastMatchMessage = 'Không chấp nhận kết quả hòa.';
            return;
        }

        this.dataService.recordMatch({
            source: 'challenge',
            homePlayerId: this.currentUserId,
            awayPlayerId: this.newMatch.awayPlayerId,
            homeScore: this.newMatch.homeScore,
            awayScore: this.newMatch.awayScore,
            status: 'pending', // 2-way approval queue
            recordedById: this.currentUserId,
            notes: this.newMatch.notes
        });

        this.lastMatchMessage = 'Đã gửi kết quả thành công. Đang chờ đối thủ xác nhận!';
        this.newMatch.notes = '';
        this.reloadAll();
    }

    confirmMatch(matchId: string): void {
        this.dataService.confirmMatch(matchId, this.currentUserId);
        this.reloadAll();
    }

    disputeMatch(matchId: string): void {
        this.dataService.disputeMatch(matchId, this.currentUserId);
        this.reloadAll();
    }


    markNotificationsRead(): void {
        this.dataService.markAllNotificationsAsRead(this.currentUserId);
        this.myNotifications = this.dataService.getNotifications(this.currentUserId);
    }

    loadTournamentDetail(tid: string): void {
        this.selectedTournamentId = tid;
        const found = this.allTournaments.find((x) => x.id === tid);
        this.currTournament = found ? { ...found } : null;
    }

    selectTournament(tid: string): void {
        this.loadTournamentDetail(tid);
        this.tournamentViewMode = 'detail';
        this.detailTab = this.currTournament?.status === 'draft' ? 'players' : 'overview';
    }

    backToList(): void {
        this.tournamentViewMode = 'list';
    }

    get tournamentDraftCount(): number {
        return this.allTournaments.filter((t) => (t.status || 'draft') === 'draft').length;
    }

    get tournamentOngoingCount(): number {
        return this.allTournaments.filter((t) => (t.status || 'draft') === 'ongoing').length;
    }

    get tournamentFinishedCount(): number {
        return this.allTournaments.filter((t) => (t.status || 'draft') === 'finished').length;
    }

    get registeredTournamentCount(): number {
        return this.allTournaments.filter((t) => !!t.participants?.includes(this.currentUserId)).length;
    }

    get prizeTournamentCount(): number {
        return this.allTournaments.filter((t) => !!t.prizes?.length).length;
    }

    get filteredTournaments(): Tournament[] {
        const query = this.tournamentSearchKeyword.trim().toLowerCase();

        return this.allTournaments.filter((t) => {
            const status = t.status || 'draft';
            if (this.tournamentStatusFilter !== 'all' && status !== this.tournamentStatusFilter) {
                return false;
            }

            const format = t.format || 'group';
            if (this.tournamentFormatFilter !== 'all' && format !== this.tournamentFormatFilter) {
                return false;
            }

            if (!query) {
                return true;
            }

            const typeLabel = this.getTournamentTypeLabel(t.type).toLowerCase();
            return t.name.toLowerCase().includes(query) || typeLabel.includes(query) || (t.location || '').toLowerCase().includes(query);
        });
    }

    trackByTournamentId(_: number, tournament: Tournament): string {
        return tournament.id;
    }

    openTeamDetails(match: any): void {
        this.selectedTeamMatch = match;
        this.showTeamDetailsDialog = true;
    }

    isRegistered(tid: string): boolean {
        const t = this.allTournaments.find(x => x.id === tid);
        return !!(t && t.participants?.includes(this.currentUserId));
    }

    registerTournament(tid: string): void {
        this.dataService.registerPlayerForTournament(tid, this.currentUserId);
        this.reloadAll();
        const updated = this.allTournaments.find(x => x.id === tid);
        this.currTournament = updated ? { ...updated } : null;
    }

    deregisterTournament(tid: string): void {
        this.dataService.removePlayerFromTournament(tid, this.currentUserId);
        this.reloadAll();
        const updated = this.allTournaments.find(x => x.id === tid);
        this.currTournament = updated ? { ...updated } : null;
    }

    getMemberDepartment(pid: string): string {
        const m = this.activeMembers.find(x => x.id === pid);
        if (pid === this.currentUserId) {
            return this.currentUser?.department || 'Phong CNTT';
        }
        return m?.department || 'Phong CNTT';
    }

    getMemberElo(pid: string): number {
        if (this.currTournament && this.currTournament.registrations) {
            const reg = this.currTournament.registrations.find((r: any) => r.memberId === pid);
            if (reg && reg.eloSnapshot !== undefined) {
                return reg.eloSnapshot;
            }
        }
        const m = this.activeMembers.find(x => x.id === pid);
        if (pid === this.currentUserId) {
            return this.currentUser?.elo || 1500;
        }
        return m?.elo || 1500;
    }

    getMemberRank(pid: string): string {
        if (this.currTournament && this.currTournament.registrations) {
            const reg = this.currTournament.registrations.find((r: any) => r.memberId === pid);
            if (reg && reg.rankSnapshot) {
                return reg.rankSnapshot;
            }
        }
        const m = this.activeMembers.find(x => x.id === pid);
        if (pid === this.currentUserId) {
            return this.currentUser?.rankTier || 'A5';
        }
        return m?.rankTier || 'A5';
    }

    getSortedParticipants(): string[] {
        if (!this.currTournament || !this.currTournament.participants) return [];
        return [...this.currTournament.participants].sort((a, b) => {
            const rankA = this.getMemberRank(a);
            const rankB = this.getMemberRank(b);
            const getRankVal = (r: string) => {
                switch (r) {
                    case 'A0': return 100;
                    case 'A1': return 90;
                    case 'A2': return 80;
                    case 'A3': return 70;
                    case 'A4': return 60;
                    case 'A5': return 50;
                    case 'A6': return 40;
                    default: return 50;
                }
            };
            return getRankVal(rankB) - getRankVal(rankA);
        });
    }

    getMemberDoublePoints(pid: string): number {
        const rank = this.getMemberRank(pid);
        switch(rank) {
            case 'A0': return 0;
            case 'A1': return 1;
            case 'A2': return 2;
            case 'A3': return 3;
            case 'A4': return 4;
            case 'A5': return 5;
            case 'A6': return 6;
            default: return 5;
        }
    }

    getCompetitorDetailText(id: string): string {
        if (!this.currTournament) return id;
        if (this.currTournament.type === 'single') {
            const rank = this.getMemberRank(id);
            return `${this.memberName(id)} (Hạng ${rank})`;
        } else if (this.currTournament.type === 'double') {
            const team = this.currTournament.teams?.find(t => t.id === id);
            if (!team) return this.competitorName(id);
            const playersStr = team.players.map(p => `${p.name} (Hạng ${this.getMemberRank(p.id)})`).join(' + ');
            return `${team.name} [${playersStr}]`;
        } else {
            // For team format, we only show the team name on the main row. The players are listed under it.
            return this.competitorName(id);
        }
    }

    getTeamPlayers(teamId: string): any[] {
        if (!this.currTournament) return [];
        const team = this.currTournament.teams?.find(t => t.id === teamId);
        return team ? team.players : [];
    }

    getTeamPlayersText(teamId: string): string {
        if (!this.currTournament || !this.currTournament.teams) return '';
        const team = this.currTournament.teams.find((t: any) => t.id === teamId);
        if (!team) return '';
        return team.players.map((p: any) => p.name).join(', ');
    }

    getSubMatchPlayerNames(players: string[]): string {
        if (!players || players.length === 0) return 'Chưa đăng ký';
        return players.map(pid => `${this.memberName(pid)} (Hạng ${this.getMemberRank(pid)})`).join(' + ');
    }

    getMatchHandicapText(match: any): string {
        if (!this.currTournament) return '';
        if (this.currTournament.type === 'single') {
            const hRank = this.getMemberRank(match.homeCompetitorId);
            const aRank = this.getMemberRank(match.awayCompetitorId);
            return this.dataService.getSingleHandicap(hRank, aRank);
        } else if (this.currTournament.type === 'double') {
            const homeTeam = this.currTournament.teams?.find(t => t.id === match.homeCompetitorId);
            const awayTeam = this.currTournament.teams?.find(t => t.id === match.awayCompetitorId);
            if (homeTeam && awayTeam) {
                const p1 = homeTeam.players.map(p => p.id);
                const p2 = awayTeam.players.map(p => p.id);
                return this.dataService.getDoubleHandicap(p1, p2);
            }
        } else if (this.currTournament.type === 'team') {
            return 'Tính theo trận con';
        }
        return '';
    }

    getTeamSubMatchHandicapText(text?: string): string {
        if (!text) return 'Đánh ngang';
        return text.replace(/Bên A/g, 'ABC').replace(/Bên B/g, 'XYZ');
    }

    // Helper functions
    getInitials(): string {
        return this.currentUser?.fullName ? this.currentUser.fullName.charAt(0) : 'U';
    }

    competitorName(id: string): string {
        if (!id) return '';
        if (!this.currTournament) return id;
        for (const group of this.currTournament.groups || []) {
            const comp = group.competitors.find(c => c.id === id);
            if (comp) {
                const idx = comp.name.indexOf(':');
                return idx > -1 ? comp.name.substring(0, idx) : comp.name;
            }
        }
        return this.memberName(id);
    }

    getMatchKey(match: any): string {
        if (!match) return '';
        return match.id || `${match.groupName}-${match.homeCompetitorId}-${match.awayCompetitorId}`;
    }

    toggleMatchExpansion(match: any): void {
        const key = this.getMatchKey(match);
        if (this.collapsedMatchKeys.has(key)) {
            this.collapsedMatchKeys.delete(key);
        } else {
            this.collapsedMatchKeys.add(key);
        }
    }

    isMatchExpanded(match: any): boolean {
        const key = this.getMatchKey(match);
        return !this.collapsedMatchKeys.has(key);
    }

    getSortedMatches(): any[] {
        if (!this.currTournament || !this.currTournament.scores) return [];
        return [...this.currTournament.scores].sort((a, b) => {
            if (this.selectedMatchSortOrder === 'group') {
                const groupCompare = a.groupName.localeCompare(b.groupName);
                if (groupCompare !== 0) return groupCompare;
                
                const homeA = this.competitorName(a.homeCompetitorId);
                const homeB = this.competitorName(b.homeCompetitorId);
                return homeA.localeCompare(homeB);
            } else if (this.selectedMatchSortOrder === 'status-unplayed') {
                const aCompleted = !!(a.completed || a.homeScore >= 3 || a.awayScore >= 3 || (this.currTournament?.type !== 'team' && (a.homeScore > 0 || a.awayScore > 0)));
                const bCompleted = !!(b.completed || b.homeScore >= 3 || b.awayScore >= 3 || (this.currTournament?.type !== 'team' && (b.homeScore > 0 || b.awayScore > 0)));
                if (aCompleted !== bCompleted) {
                    return aCompleted ? 1 : -1;
                }
                return a.groupName.localeCompare(b.groupName);
            } else if (this.selectedMatchSortOrder === 'status-played') {
                const aCompleted = !!(a.completed || a.homeScore >= 3 || a.awayScore >= 3 || (this.currTournament?.type !== 'team' && (a.homeScore > 0 || a.awayScore > 0)));
                const bCompleted = !!(b.completed || b.homeScore >= 3 || b.awayScore >= 3 || (this.currTournament?.type !== 'team' && (b.homeScore > 0 || b.awayScore > 0)));
                if (aCompleted !== bCompleted) {
                    return aCompleted ? -1 : 1;
                }
                return a.groupName.localeCompare(b.groupName);
            }
            return 0;
        });
    }

    getKnockoutMatchesByRound(round: string): any[] {
        if (!this.currTournament || !this.currTournament.knockoutMatches) return [];
        return this.currTournament.knockoutMatches.filter(m => m.roundName === round);
    }

    getFinalMatch(): any | null {
        if (!this.currTournament || !this.currTournament.knockoutMatches) return null;
        return this.currTournament.knockoutMatches.find(m => m.id === 'f-1') || null;
    }

    getBronzeMatch(): any | null {
        if (!this.currTournament || !this.currTournament.knockoutMatches) return null;
        return this.currTournament.knockoutMatches.find(m => m.id === '3rd-1') || null;
    }

    memberName(memberId: string): string {
        if (memberId === this.currentUserId) {
            return this.currentUser?.fullName ?? memberId;
        }
        return this.activeMembers.find((member) => member.id === memberId)?.fullName ?? memberId;
    }
    opponentName(match: MatchRecord): string {
        if (match.homePlayerId === this.currentUserId) {
            return this.memberName(match.awayPlayerId);
        }
        return this.memberName(match.homePlayerId);
    }

    isMatchWon(match: MatchRecord): boolean {
        if (match.homePlayerId === this.currentUserId) {
            return match.homeScore > match.awayScore;
        }
        return match.awayScore > match.homeScore;
    }

    getEloDelta(match: MatchRecord): string {
        if (match.homePlayerId === this.currentUserId) {
            const diff = match.homeEloAfter - match.homeEloBefore;
            return diff >= 0 ? `+${diff}` : `${diff}`;
        } else {
            const diff = match.awayEloAfter - match.awayEloBefore;
            return diff >= 0 ? `+${diff}` : `${diff}`;
        }
    }

    getEloDisplayRange(match: MatchRecord): string {
        if (match.homePlayerId === this.currentUserId) {
            return `${match.homeEloBefore} → ${match.homeEloAfter}`;
        }
        return `${match.awayEloBefore} → ${match.awayEloAfter}`;
    }

    getMatchStatusSeverity(status?: string): 'success' | 'warn' | 'danger' | 'info' {
        switch (status) {
            case 'confirmed': return 'success';
            case 'pending': return 'warn';
            case 'disputed': return 'danger';
            case 'walkover': return 'info';
            default: return 'info';
        }
    }

    getPodiumWinners(t: Tournament): { first?: { id: string, name: string }, second?: { id: string, name: string }, third?: { id: string, name: string }, third2?: { id: string, name: string }, hasTwoThirds: boolean } {
        if (!t) return { hasTwoThirds: false };
        
        const getCompObj = (id: string): { id: string, name: string } => {
            const m = this.dataService.getMemberById(id);
            if (m) return { id, name: m.fullName };
            const team = t.teams?.find((tm: any) => tm.id === id);
            return { id, name: team ? team.name : id };
        };

        if (t.format === 'round_robin') {
            const std = t.standings || [];
            const rows = std[0] ? std[0].rows : [];
            const hasTwo3rdPrizes = (t.prizes || []).filter(p => (p.title || '').toLowerCase().includes('ba')).length >= 2;
            return {
                first: rows[0] ? { id: rows[0].competitor.id, name: rows[0].competitor.name } : undefined,
                second: rows[1] ? { id: rows[1].competitor.id, name: rows[1].competitor.name } : undefined,
                third: rows[2] ? { id: rows[2].competitor.id, name: rows[2].competitor.name } : undefined,
                third2: hasTwo3rdPrizes && rows[3] ? { id: rows[3].competitor.id, name: rows[3].competitor.name } : undefined,
                hasTwoThirds: hasTwo3rdPrizes && !!rows[3]
            };
        }

        const matches = t.knockoutMatches || [];
        const finalMatch = matches.find(m => m.roundName === 'Finals');
        
        let first: { id: string, name: string } | undefined;
        let second: { id: string, name: string } | undefined;
        let third: { id: string, name: string } | undefined;
        let third2: { id: string, name: string } | undefined;
        let hasTwoThirds = false;

        if (finalMatch && finalMatch.winnerId !== undefined) {
            const winnerId = finalMatch.winnerId;
            const loserId = winnerId === finalMatch.homeCompetitorId ? finalMatch.awayCompetitorId : finalMatch.homeCompetitorId;

            first = getCompObj(winnerId);
            second = getCompObj(loserId);

            const bronzeMatch = matches.find(m => m.roundName === 'Bronze' || m.id === '3rd-1');
            if (bronzeMatch && bronzeMatch.winnerId !== undefined) {
                third = getCompObj(bronzeMatch.winnerId);
                hasTwoThirds = false;
            } else {
                const semiMatches = matches.filter(m => m.roundName === 'Semifinals');
                const losers: string[] = [];
                semiMatches.forEach(m => {
                    if (m.winnerId !== undefined) {
                        const lId = m.winnerId === m.homeCompetitorId ? m.awayCompetitorId : m.homeCompetitorId;
                        if (lId) losers.push(lId);
                    }
                });
                if (losers.length > 0) {
                    third = getCompObj(losers[0]);
                }
                if (losers.length > 1) {
                    third2 = getCompObj(losers[1]);
                    hasTwoThirds = true;
                }
            }
        }

        return { first, second, third, third2, hasTwoThirds };
    }

    getTopThreeWinners(t: Tournament): { first?: { id: string, name: string }, second?: { id: string, name: string }, third?: { id: string, name: string } } {
        const res = this.getPodiumWinners(t);
        return { first: res.first, second: res.second, third: res.third };
    }

    getChallengeSeverity(status: string): 'success' | 'warn' | 'danger' | 'info' {
        switch (status) {
            case 'accepted': return 'success';
            case 'pending': return 'warn';
            case 'declined': return 'danger';
            case 'canceled': return 'info';
            default: return 'info';
        }
    }

    getTournamentStatusSeverity(status?: string): 'success' | 'warn' | 'danger' | 'info' {
        switch (status) {
            case 'finished': return 'success';
            case 'ongoing': return 'info';
            case 'draft': return 'warn';
            default: return 'info';
        }
    }

    getTournamentTypeLabel(type: string): string {
        switch (type) {
            case 'single': return 'Đơn';
            case 'double': return 'Đôi';
            case 'team': return 'Đồng đội';
            default: return type;
        }
    }

    getPrizesSummary(prizes?: TournamentPrize[]): string {
        if (!prizes || !prizes.length) return '-';
        return prizes.map(p => `${p.title}: ${p.amount.toLocaleString()}đ`).join(', ');
    }

    getCompletedMatchesCount(t: Tournament): number {
        if (!t || !t.scores) return 0;
        const groupCompleted = t.scores.filter(m => m.completed || (m.homeScore !== 0 || m.awayScore !== 0)).length;
        const knockoutCompleted = (t.knockoutMatches || []).filter(m => m.completed || (m.homeScore !== undefined && m.awayScore !== undefined)).length;
        return groupCompleted + knockoutCompleted;
    }

    getTotalMatchesCount(t: Tournament): number {
        if (!t) return 0;
        const groupTotal = t.scores ? t.scores.length : 0;
        const knockoutTotal = t.knockoutMatches ? t.knockoutMatches.length : 0;
        return groupTotal + knockoutTotal;
    }

    getTournamentProgressPercent(t: Tournament): number {
        const total = this.getTotalMatchesCount(t);
        if (total === 0) return 0;
        const completed = this.getCompletedMatchesCount(t);
        return Math.round((completed / total) * 100);
    }

    getPrizeForPodium(t: Tournament, indexOrKey: number | 'first' | 'second' | 'third'): string {
        if (!t || !t.prizes || t.prizes.length === 0) return '';
        if (typeof indexOrKey === 'number') {
            const p = t.prizes[indexOrKey];
            return p ? `${p.amount.toLocaleString()}đ` : '';
        }
        const prizes = t.prizes;
        if (indexOrKey === 'first') {
            const found = prizes.find(p => /vô địch|nhất|1/i.test(p.title)) || prizes[0];
            return found ? `${found.amount.toLocaleString()}đ` : '';
        }
        if (indexOrKey === 'second') {
            const found = prizes.find(p => /nhì|2/i.test(p.title)) || prizes[1];
            return found ? `${found.amount.toLocaleString()}đ` : '';
        }
        if (indexOrKey === 'third') {
            const found = prizes.find(p => /ba|3/i.test(p.title)) || prizes[2] || prizes[prizes.length - 1];
            return found ? `${found.amount.toLocaleString()}đ` : '';
        }
        return '';
    }

    isSetScoreValid(home: number | null | undefined, away: number | null | undefined): { valid: boolean, error?: string } {
        if (home === null || home === undefined || away === null || away === undefined) {
            return { valid: false };
        }
        const h = Number(home);
        const a = Number(away);
        if (h < 0 || a < 0) {
            return { valid: false, error: 'Không được âm.' };
        }
        if (h < 11 && a < 11) {
            return { valid: false, error: 'Chưa đạt 11 điểm.' };
        }
        
        const max = Math.max(h, a);
        const min = Math.min(h, a);
        
        if (max === 11) {
            if (min > 9) {
                return { valid: false, error: 'Deuce: Điểm thắng tối thiểu phải hơn 2 (ví dụ: 12-10).' };
            }
            if (max - min < 2) {
                return { valid: false, error: 'Phải cách biệt ít nhất 2 điểm.' };
            }
        } else {
            if (max - min !== 2) {
                return { valid: false, error: 'Deuce: Phải cách biệt đúng 2 điểm (ví dụ: 12-10, 13-11).' };
            }
        }
        return { valid: true };
    }

    private reloadAll(): void {
        this.activeMembers = this.dataService.getMembers().filter(m => m.isActive);
        this.currentUser = this.dataService.getMemberById(this.currentUserId);
        
        // Generate opponents list
        this.opponents = this.activeMembers.filter((member) => member.id !== this.currentUserId);
        if (!this.challengeForm.opponentId && this.opponents.length) {
            this.challengeForm.opponentId = this.opponents[0].id;
        }
        if (!this.newMatch.awayPlayerId && this.opponents.length) {
            this.newMatch.awayPlayerId = this.opponents[0].id;
        }

        // Get personal history lists
        this.myMatches = this.dataService.getMatchesByMember(this.currentUserId);
        this.myChallenges = this.dataService.getChallengesByMember(this.currentUserId);
        this.myNotifications = this.dataService.getNotifications(this.currentUserId);
        
        // Get matches pending current user's approval
        this.pendingApprovals = this.dataService.getMatches().filter(
            (m) => m.status === 'pending' && m.awayPlayerId === this.currentUserId
        );



        // Get tournaments list
        this.allTournaments = this.dataService.getTournaments();
        if (this.allTournaments.length && !this.selectedTournamentId) {
            this.selectedTournamentId = this.allTournaments[0].id;
        }
        if (this.selectedTournamentId) {
            this.loadTournamentDetail(this.selectedTournamentId);
        }

        // Setup Chart
        this.setupEloChart();
    }

    private setupEloChart(): void {
        const confirmedMatches = this.myMatches
            .filter((m) => m.status === 'confirmed')
            .reverse(); // Chronological order

        this.hasMatches = confirmedMatches.length > 0;
        if (!this.hasMatches) return;

        // Build data points
        const labels: string[] = ['Bắt đầu'];
        const data: number[] = [1200]; // Default start point

        // Find initial Elo before the first match
        if (confirmedMatches.length) {
            const first = confirmedMatches[0];
            const startElo = first.homePlayerId === this.currentUserId ? first.homeEloBefore : first.awayEloBefore;
            data[0] = startElo;
        }

        confirmedMatches.forEach((match, index) => {
            const eloAfter = match.homePlayerId === this.currentUserId ? match.homeEloAfter : match.awayEloAfter;
            labels.push(`Trận ${index + 1}`);
            data.push(eloAfter);
        });

        const documentStyle = getComputedStyle(document.documentElement);
        const textColor = documentStyle.getPropertyValue('--text-color') || '#495057';
        const gridColor = documentStyle.getPropertyValue('--surface-border') || '#dfe7ef';
        const primaryColor = documentStyle.getPropertyValue('--p-primary-500') || '#3B82F6';

        this.eloChartData = {
            labels,
            datasets: [
                {
                    label: 'Điểm Elo',
                    data,
                    fill: false,
                    borderColor: primaryColor,
                    tension: 0.4,
                    pointBackgroundColor: primaryColor,
                    pointHoverRadius: 6
                }
            ]
        };

        this.eloChartOptions = {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                x: {
                    grid: {
                        color: gridColor
                    },
                    ticks: {
                        color: textColor
                    }
                },
                y: {
                    grid: {
                        color: gridColor
                    },
                    ticks: {
                        color: textColor
                    }
                }
            }
        };
    }
}
