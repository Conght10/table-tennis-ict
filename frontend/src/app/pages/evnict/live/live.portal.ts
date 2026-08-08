import { CommonModule } from '@angular/common';
import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { RouterModule, Router, ActivatedRoute } from '@angular/router';
import { Tournament, TournamentPrize, Member } from '../domain/evnict.models';
import { EvnictDataService } from '../domain/evnict-data.service';
import { Subscription, interval } from 'rxjs';

@Component({
    selector: 'app-evnict-live-portal',
    standalone: true,
    imports: [CommonModule, FormsModule, TableModule, ButtonModule, TagModule, DialogModule, InputTextModule, RouterModule],
    template: `
        <div class="portal-shell grid grid-cols-12 gap-6">

            <div class="col-span-12 screen-hero">
                <div class="flex items-center justify-between flex-wrap gap-2 mb-2">
                    <h2 class="screen-hero__title m-0">Trực Tiếp Bảng Điểm & Kết Quả Giải Đấu</h2>
                    <div class="flex items-center gap-3">
                        <span class="text-xs font-bold text-slate-350 bg-slate-800/80 px-3 py-1.5 rounded-full flex items-center gap-1.5">
                            <span class="w-2 h-2 bg-green-500 rounded-full animate-ping"></span>
                            Live: Tự động cập nhật ({{ countdown }}s)
                        </span>
                        <button class="px-3 py-1.5 bg-primary text-white hover:bg-primary-600 rounded-lg text-xs font-extrabold transition flex items-center gap-1.5 border-none shadow-sm cursor-pointer" (click)="refreshAllData()">
                            <i class="pi pi-refresh" [class.pi-spin]="isRefreshing"></i> Làm mới
                        </button>
                    </div>
                </div>
                <p class="screen-hero__subtitle text-xs">Vãng lai truy cập. Theo dõi sơ đồ nhánh đấu trực tiếp knockout, danh sách đội hình và bảng xếp hạng vòng bảng thời gian thực.</p>
            </div>

            <!-- Tab Content: Tournaments -->
            <div class="col-span-12">
                <!-- LIST VIEW -->
                <div *ngIf="tournamentViewMode === 'list'" class="space-y-6 animate-fadein">
                    <div class="flex items-center justify-between border-b border-surface-200 pb-3">
                        <div>
                            <h3 class="text-xl font-extrabold m-0 flex items-center gap-2">
                                <i class="pi pi-trophy text-primary"></i> Giải Đấu Đang Diễn Ra
                            </h3>
                            <p class="text-xs text-slate-500 mt-1">Danh sách các giải đấu đang mở đăng ký, đang tranh tài hoặc đã kết thúc.</p>
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
                                <input type="text" [(ngModel)]="tournamentSearchKeyword" placeholder="Tìm giải đấu..." />
                            </label>
                            <select class="tournament-filter-select" [(ngModel)]="tournamentFormatFilter">
                                <option value="all">Mọi thể thức</option>
                                <option value="group">Chia bảng + Knockout</option>
                                <option value="round_robin">Vòng tròn tính điểm</option>
                            </select>
                        </div>
                    </div>

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

                            <div class="flex items-center justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
                                <button class="px-4 py-2 bg-primary text-white hover:bg-primary-600 rounded text-xs font-bold transition flex items-center gap-1" (click)="selectTournament(t.id)">
                                    <i class="pi pi-eye"></i> Xem trực tiếp
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
                </div>

                <!-- DETAIL VIEW -->
                <div *ngIf="tournamentViewMode === 'detail' && currTournament" class="grid grid-cols-12 gap-6 animate-fadein">
                    
                    <!-- Top Summary Card -->
                    <div class="col-span-12">
                        <div class="card shadow-sm border border-surface-200 p-4 mb-2 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-slate-50/50 dark:bg-slate-900/40">
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
                                <div *ngIf="currTournament.status !== 'draft'" class="bg-gradient-to-br from-indigo-900 via-slate-900 to-indigo-950 text-white rounded-2xl p-6 shadow-xl relative overflow-hidden border border-indigo-950">
                                    <div class="absolute -top-24 -left-24 w-48 h-48 bg-primary-500 rounded-full blur-3xl opacity-20"></div>
                                    <div class="absolute -bottom-24 -right-24 w-48 h-48 bg-amber-500 rounded-full blur-3xl opacity-20"></div>

                                    <div class="relative flex flex-col items-center">
                                        <h4 class="text-sm uppercase tracking-widest text-amber-400 font-black mb-1">Bảng Vàng Danh Dự</h4>
                                        <h3 class="text-xl font-extrabold text-slate-100 mb-6 text-center">BỤC VINH QUANG GIẢI ĐẤU</h3>

                                        <div class="flex items-end justify-center w-full max-w-4xl mx-auto pt-6 pb-2 gap-3 md:gap-5 flex-wrap">
                                            <!-- 2nd Place -->
                                            <div class="flex flex-col items-center flex-1 min-w-[130px] max-w-[190px]">
                                                <div class="text-center mb-3 w-full px-1">
                                                    <div class="inline-flex items-center justify-center w-9 h-9 rounded-full bg-slate-800 border-2 border-slate-350 font-black text-xs text-slate-200 shadow-md mb-2">2nd</div>
                                                    <div class="text-xs font-bold text-slate-200 leading-tight">
                                                        {{ getPodiumWinners(currTournament).second?.name || 'Đang đấu...' }}
                                                    </div>
                                                    <div *ngIf="currTournament.type === 'team' && getPodiumWinners(currTournament).second?.id" class="text-[10px] text-slate-400 font-normal leading-snug mt-1 block">
                                                        {{ getTeamPlayersText(getPodiumWinners(currTournament).second?.id || '') }}
                                                    </div>
                                                </div>
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

                                            <!-- 1st Place -->
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

                                            <!-- 3rd Place 1 -->
                                            <div class="flex flex-col items-center flex-1 min-w-[130px] max-w-[190px]">
                                                <div class="text-center mb-3 w-full px-1">
                                                    <div class="inline-flex items-center justify-center w-9 h-9 rounded-full bg-orange-950 border-2 border-orange-650 font-black text-xs text-orange-400 shadow-md mb-2">3rd</div>
                                                    <div class="text-xs font-bold text-orange-355 leading-tight">
                                                        {{ getPodiumWinners(currTournament).third?.name || 'Đang đấu...' }}
                                                    </div>
                                                    <div *ngIf="currTournament.type === 'team' && getPodiumWinners(currTournament).third?.id" class="text-[10px] text-slate-400 font-normal leading-snug mt-1 block">
                                                        {{ getTeamPlayersText(getPodiumWinners(currTournament).third?.id || '') }}
                                                    </div>
                                                </div>
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

                                            <!-- 3rd Place 2 -->
                                            <div *ngIf="getPodiumWinners(currTournament).hasTwoThirds" class="flex flex-col items-center flex-1 min-w-[130px] max-w-[190px]">
                                                <div class="text-center mb-3 w-full px-1">
                                                    <div class="inline-flex items-center justify-center w-9 h-9 rounded-full bg-orange-950 border-2 border-orange-650 font-black text-xs text-orange-400 shadow-md mb-2">3rd</div>
                                                    <div class="text-xs font-bold text-orange-355 leading-tight">
                                                        {{ getPodiumWinners(currTournament).third2?.name || 'Đang đấu...' }}
                                                    </div>
                                                    <div *ngIf="currTournament.type === 'team' && getPodiumWinners(currTournament).third2?.id" class="text-[10px] text-slate-400 font-normal leading-snug mt-1 block">
                                                        {{ getTeamPlayersText(getPodiumWinners(currTournament).third2?.id || '') }}
                                                    </div>
                                                </div>
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

                                <div class="grid grid-cols-1 md:grid-cols-3 gap-4" *ngIf="currTournament.status !== 'draft'">
                                    <div class="p-4 bg-indigo-500/10 rounded-xl border border-indigo-500/20 flex items-center justify-between shadow-sm">
                                        <div class="space-y-1">
                                            <span class="text-indigo-600 text-[10px] uppercase font-black tracking-wider">Tiến Độ Giải Đấu</span>
                                            <h3 class="text-xl font-black m-0">{{ getTournamentProgressPercent(currTournament) }}%</h3>
                                        </div>
                                        <div class="w-10 h-10 bg-indigo-500 text-white rounded-lg flex items-center justify-center text-lg"><i class="pi pi-chart-bar"></i></div>
                                    </div>
                                    <div class="p-4 bg-emerald-500/10 rounded-xl border border-emerald-500/20 flex items-center justify-between shadow-sm">
                                        <div class="space-y-1">
                                            <span class="text-emerald-600 text-[10px] uppercase font-black tracking-wider">Số Trận Đã Đấu</span>
                                            <h3 class="text-xl font-black m-0">{{ getCompletedMatchesCount(currTournament) }} / {{ getTotalMatchesCount(currTournament) }}</h3>
                                        </div>
                                        <div class="w-10 h-10 bg-emerald-500 text-white rounded-lg flex items-center justify-center text-lg"><i class="pi pi-check-square"></i></div>
                                    </div>
                                    <div class="p-4 bg-amber-500/10 rounded-xl border border-amber-500/20 flex items-center justify-between shadow-sm">
                                        <div class="space-y-1">
                                            <span class="text-amber-600 text-[10px] uppercase font-black tracking-wider">Tổng Đấu Thủ</span>
                                            <h3 class="text-xl font-black m-0">{{ currTournament.participants?.length || 0 }} VĐV</h3>
                                        </div>
                                        <div class="w-10 h-10 bg-amber-500 text-white rounded-lg flex items-center justify-center text-lg"><i class="pi pi-user-plus"></i></div>
                                    </div>
                                </div>

                                <div class="p-4 bg-surface-50 dark:bg-slate-900 rounded-xl border border-surface-200">
                                    <h4 class="font-bold text-sm mb-3">Thông Tin Giải Đấu</h4>
                                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                                        <div><strong>Địa điểm:</strong> {{ currTournament.location || 'N/A' }}</div>
                                        <div><strong>Ngày bắt đầu:</strong> {{ currTournament.startedAt | date:'dd/MM/yyyy' }}</div>
                                        <div><strong>Hình thức:</strong> {{ currTournament.format === 'round_robin' ? 'Vòng tròn tính điểm' : 'Chia bảng + Knockout' }}</div>
                                        <div><strong>Đồng đội / Cá nhân:</strong> {{ getTournamentTypeLabel(currTournament.type) }}</div>
                                    </div>
                                </div>
                            </div>

                            <!-- Content Tab 1: Players -->
                            <div *ngIf="detailTab === 'players'" class="space-y-6">
                                <h3 class="text-lg font-bold mb-3 flex items-center gap-2">
                                    <i class="pi pi-users text-primary"></i> Đội hình & VĐV Tham Gia
                                </h3>

                                <div *ngIf="currTournament.type !== 'team'" class="overflow-auto border border-surface-200 rounded-lg">
                                    <table class="w-full border-collapse text-xs text-left">
                                        <thead>
                                            <tr class="bg-surface-50 border-b text-slate-500 font-semibold">
                                                <th class="py-2 px-3 text-center" style="width: 4rem">STT</th>
                                                <th class="py-2 px-3">Họ và Tên</th>
                                                <th class="py-2 px-3">Phòng ban</th>
                                                <th class="py-2 px-3 text-center">Elo hiện tại</th>
                                                <th class="py-2 px-3 text-center">Hạng hạt giống</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr *ngFor="let pid of getSortedParticipants(); let idx = index" class="border-b hover:bg-slate-100/50">
                                                <td class="py-2 px-3 text-center font-bold">{{ idx + 1 }}</td>
                                                <td class="py-2 px-3 font-bold">{{ memberName(pid) }}</td>
                                                <td class="py-2 px-3">{{ getMemberDepartment(pid) }}</td>
                                                <td class="py-2 px-3 text-center font-extrabold text-primary">{{ getMemberElo(pid) }}</td>
                                                <td class="py-2 px-3 text-center">
                                                    <span class="px-2 py-0.5 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 font-black rounded-full">{{ getMemberRank(pid) }}</span>
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>

                                <div *ngIf="currTournament.type === 'team'" class="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                                    <div *ngFor="let team of currTournament.teams; let idx = index" class="p-4 border rounded-xl bg-slate-50/50 dark:bg-slate-900/40 space-y-3">
                                        <div class="flex items-center justify-between border-b pb-2">
                                            <span class="font-extrabold text-sm text-primary flex items-center gap-1.5">
                                                <i class="pi pi-shield"></i> {{ team.name }}
                                            </span>
                                            <span class="text-xxs px-2 py-0.5 bg-slate-200 dark:bg-slate-700 rounded-full font-bold">Tổng điểm: {{ getTeamTotalPoints(team) }}đ</span>
                                        </div>
                                        <div class="space-y-1.5 text-xs">
                                            <div *ngFor="let p of team.players" class="flex justify-between items-center bg-white dark:bg-slate-900 p-2 rounded border">
                                                <span class="font-bold">{{ p.name }}</span>
                                                <span class="px-1.5 py-0.2 bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 rounded font-black text-[10px]">Hạng {{ getMemberRank(p.id) }} ({{ getMemberDoublePoints(p.id) }}đ)</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <!-- Content Tab 2: Group Stage -->
                            <div *ngIf="detailTab === 'group'" class="space-y-6">
                                <div *ngIf="currTournament.standings?.length">
                                    <h3 class="text-lg font-bold mb-3 flex items-center gap-2">
                                        <i class="pi pi-table text-primary"></i> Bảng Điểm & Thứ Hạng Live
                                    </h3>
                                    <div *ngFor="let standing of currTournament.standings" class="mb-6">
                                        <h4 class="font-bold text-xs bg-slate-100 dark:bg-slate-800 p-2 rounded mb-2 flex items-center justify-between">
                                            <span>Bảng {{ standing.groupName }}</span>
                                            <span class="text-[10px] text-indigo-600 font-bold bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded">Vòng bảng</span>
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

                                <div *ngIf="currTournament.scores?.length">
                                    <div class="flex items-center justify-between mb-4 border-b pb-3 flex-wrap gap-3">
                                        <h3 class="text-lg font-bold m-0 flex items-center gap-2">
                                            <i class="pi pi-calendar text-primary"></i> Danh Sách Trận Đấu Vòng Bảng
                                        </h3>
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
                                                <tr class="bg-surface-50 border-b border-surface-200 text-slate-500 font-semibold">
                                                    <th class="py-2.5 px-4" style="width: 6rem">Bảng đấu</th>
                                                    <th class="py-2.5 px-4 text-right" style="width: 32%">Bên nhà</th>
                                                    <th class="py-2.5 px-4 text-center" style="width: 14%">Tỉ số</th>
                                                    <th class="py-2.5 px-4 text-left" style="width: 32%">Bên khách</th>
                                                    <th class="py-2.5 px-4 text-center">Chấp điểm</th>
                                                    <th class="py-2.5 px-4 text-center">Trạng thái</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                <ng-container *ngFor="let match of getSortedMatches(); let idx = index">
                                                    <tr *ngIf="selectedGroupFilter === 'All' || match.groupName === selectedGroupFilter" class="border-b border-surface-150 hover:bg-slate-50 dark:hover:bg-slate-850/60 font-semibold">
                                                        <td class="py-3 px-4 font-bold text-indigo-600">Bảng {{ match.groupName }}</td>
                                                        <td class="py-3 px-4 text-right pr-6" [class.text-green-600]="match.completed && match.homeScore > match.awayScore">
                                                            <div class="flex items-center justify-end gap-1.5">
                                                                <span class="truncate max-w-[180px]">{{ competitorName(match.homeCompetitorId) }}</span>
                                                                <i class="pi pi-check-circle text-green-500 text-[10px]" *ngIf="match.completed && match.homeScore > match.awayScore"></i>
                                                            </div>
                                                            <div *ngIf="currTournament.type === 'team' && getTeamPlayersText(match.homeCompetitorId)" class="text-[10px] text-slate-400 font-normal leading-snug mt-1">
                                                                {{ getTeamPlayersText(match.homeCompetitorId) }}
                                                            </div>
                                                        </td>
                                                        <td class="py-3 px-4 text-center">
                                                            <div class="flex flex-col items-center justify-center">
                                                                <span class="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded font-black text-sm text-slate-850 dark:text-slate-200">
                                                                    {{ match.homeScore }} - {{ match.awayScore }}
                                                                </span>
                                                                <div *ngIf="match.setScores && match.setScores.length > 0 && currTournament.type !== 'team'" class="text-[9px] text-slate-400 font-normal mt-0.5 whitespace-nowrap">
                                                                    (
                                                                    <span *ngFor="let set of match.setScores; let setIdx = index; let last = last">
                                                                        {{ set.home }}-{{ set.away }}{{ last ? '' : ', ' }}
                                                                    </span>
                                                                    )
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td class="py-3 px-4 text-left pl-6" [class.text-green-600]="match.completed && match.awayScore > match.homeScore">
                                                            <div class="flex items-center justify-start gap-1.5">
                                                                <i class="pi pi-check-circle text-green-500 text-[10px]" *ngIf="match.completed && match.awayScore > match.homeScore"></i>
                                                                <span class="truncate max-w-[180px]">{{ competitorName(match.awayCompetitorId) }}</span>
                                                            </div>
                                                            <div *ngIf="currTournament.type === 'team' && getTeamPlayersText(match.awayCompetitorId)" class="text-[10px] text-slate-400 font-normal leading-snug mt-1">
                                                                {{ getTeamPlayersText(match.awayCompetitorId) }}
                                                            </div>
                                                        </td>
                                                        <td class="py-3 px-4 text-center font-bold text-amber-600 text-xxs">
                                                            <span *ngIf="currTournament.type !== 'team'">{{ getMatchHandicapText(match) }}</span>
                                                            <span *ngIf="currTournament.type === 'team'">Tính theo trận con</span>
                                                        </td>
                                                        <td class="py-3 px-4 text-center">
                                                            <div class="flex items-center justify-center gap-2">
                                                                <span *ngIf="match.isWalkover" class="px-2 py-0.5 bg-red-100 text-red-700 text-[9px] font-extrabold rounded-full"><i class="pi pi-ban text-[8px]"></i> Bỏ cuộc</span>
                                                                <span *ngIf="match.completed && !match.isWalkover" class="px-2 py-0.5 bg-green-100 text-green-700 text-[9px] font-extrabold rounded-full"><i class="pi pi-check text-[8px]"></i> Hoàn thành</span>
                                                                <span *ngIf="!match.completed" class="px-2 py-0.5 bg-yellow-100 text-yellow-750 text-[9px] font-extrabold rounded-full"><i class="pi pi-clock text-[8px]"></i> Chưa đấu</span>
                                                                <button class="px-2 py-0.5 bg-primary text-white rounded text-[10px] font-bold hover:bg-primary-600 transition flex items-center gap-1" *ngIf="currTournament.type === 'team' && match.subMatches && match.subMatches.length > 0" (click)="openTeamDetails(match)">
                                                                    <i class="pi pi-eye text-[9px]"></i> Xem trận con
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
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
                                                <div *ngIf="getFinalMatch().setScores && getFinalMatch().setScores.length > 0" class="text-[9px] text-slate-400 font-normal mt-0.5 text-center">
                                                    (<span *ngFor="let set of getFinalMatch().setScores; let last = last">{{ set.home }}-{{ set.away }}{{ last ? '' : ', ' }}</span>)
                                                </div>
                                                <div class="flex justify-end pt-1" *ngIf="currTournament.type === 'team'">
                                                    <button class="px-2 py-0.5 bg-primary text-white rounded text-[10px] font-bold hover:bg-primary-600 transition flex items-center gap-1" *ngIf="getFinalMatch().lineup" (click)="openTeamDetails(getFinalMatch())">
                                                        <i class="pi pi-eye text-[9px]"></i> Chi tiết trận đồng đội
                                                    </button>
                                                </div>
                                            </div>

                                            <!-- 3rd Place Match -->
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
                                                <div class="w-16 h-16 bg-amber-500 text-white rounded-full flex items-center justify-center shadow-lg shadow-amber-500/20 font-black text-2xl">🏆</div>
                                            </div>
                                            <div>
                                                <div class="text-xs text-amber-600 dark:text-amber-400 font-extrabold uppercase tracking-wider">CHAMPION</div>
                                                <h3 class="text-lg font-black text-slate-900 dark:text-white m-0 mt-1">
                                                    {{ competitorName(getFinalMatch().winnerId) }}
                                                </h3>
                                            </div>
                                        </div>

                                        <ng-template #championNotResolved>
                                            <div class="py-16 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-slate-400 text-xs">
                                                Chưa xác định nhà vô địch.
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

        <!-- Dialog Xem Chi Tiết Đồng Đội -->
        <p-dialog [(visible)]="showTeamDetailsDialog" header="Chi Tiết Trận Đấu Đồng Đội (Vãng Lai)" [modal]="true" [style]="{ width: '650px' }" [draggable]="false" [resizable]="false">
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
                    <div *ngFor="let sub of selectedTeamMatch.subMatches; let subIdx = index" class="p-3 border rounded-xl bg-surface-50 dark:bg-surface-800/40 space-y-2">
                        <div class="flex justify-between items-start">
                            <span class="font-bold text-slate-700 dark:text-slate-350 text-[11px]">{{ sub.label || ('Trận con ' + (subIdx + 1)) }}</span>
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

        .portal-shell select,
        .portal-shell .p-inputtext {
            border-radius: 0.65rem;
            border-color: rgba(148, 163, 184, 0.5);
        }

        .portal-shell select:focus,
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

        :host-context(.app-dark) .portal-shell select,
        :host-context(.app-dark) .portal-shell .p-inputtext {
            border-color: rgba(100, 116, 139, 0.55);
            background-color: rgba(15, 23, 42, 0.8);
        }
    `]
})
export class LivePortal implements OnInit, OnDestroy {
    isRefreshing = false;
    countdown = 10;
    private pollingSubscription: Subscription | null = null;
    private timerSubscription: Subscription | null = null;

    allTournaments: Tournament[] = [];
    activeMembers: Member[] = [];
    selectedTournamentId = '';
    currTournament: Tournament | null = null;
    tournamentViewMode: 'list' | 'detail' = 'list';
    detailTab: 'overview' | 'players' | 'group' | 'knockout' = 'overview';

    selectedGroupFilter = 'All';
    selectedMatchSortOrder = 'group';
    tournamentSearchKeyword = '';
    tournamentStatusFilter: 'all' | 'draft' | 'ongoing' | 'finished' = 'all';
    tournamentFormatFilter: 'all' | 'group' | 'round_robin' = 'all';

    showTeamDetailsDialog = false;
    selectedTeamMatch: any = null;

    constructor(
        private readonly dataService: EvnictDataService,
        private readonly router: Router,
        private readonly route: ActivatedRoute
    ) {}

    ngOnInit(): void {
        this.refreshAllData();

        // 10s polling interval
        this.pollingSubscription = interval(10000).subscribe(() => {
            this.refreshAllData();
            this.countdown = 10;
        });

        // 1s countdown timer
        this.timerSubscription = interval(1000).subscribe(() => {
            if (this.countdown > 0) {
                this.countdown--;
            }
        });
    }

    ngOnDestroy(): void {
        if (this.pollingSubscription) {
            this.pollingSubscription.unsubscribe();
        }
        if (this.timerSubscription) {
            this.timerSubscription.unsubscribe();
        }
    }

    refreshAllData(): void {
        this.isRefreshing = true;
        this.dataService.reloadAll().then(() => {
            this.activeMembers = this.dataService.getMembers().filter(m => m.isActive);
            this.allTournaments = this.dataService.getTournaments();
            if (this.selectedTournamentId) {
                const found = this.allTournaments.find((x) => x.id === this.selectedTournamentId);
                this.currTournament = found ? { ...found } : null;
            }
            this.isRefreshing = false;
        }).catch(() => {
            this.isRefreshing = false;
        });
    }

    selectTournament(tid: string): void {
        this.selectedTournamentId = tid;
        const found = this.allTournaments.find((x) => x.id === tid);
        this.currTournament = found ? { ...found } : null;
        this.tournamentViewMode = 'detail';
        this.detailTab = 'overview';
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

    getMemberDepartment(pid: string): string {
        const m = this.activeMembers.find(x => x.id === pid);
        return m?.department || 'Phòng CNTT';
    }

    getMemberElo(pid: string): number {
        if (this.currTournament && this.currTournament.registrations) {
            const reg = this.currTournament.registrations.find((r: any) => r.memberId === pid);
            if (reg && reg.eloSnapshot !== undefined) {
                return reg.eloSnapshot;
            }
        }
        const m = this.activeMembers.find(x => x.id === pid);
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

    getTeamTotalPoints(team: any): number {
        if (!team || !team.players) return 0;
        return team.players.reduce((sum: number, p: any) => sum + this.getMemberDoublePoints(p.id), 0);
    }

    getTeamPlayersText(teamId: string): string {
        if (!this.currTournament || !this.currTournament.teams) return '';
        const team = this.currTournament.teams.find((t: any) => t.id === teamId);
        if (!team) return '';
        return team.players.map((p: any) => p.name).join(', ');
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

    memberName(memberId: string): string {
        return this.activeMembers.find((member) => member.id === memberId)?.fullName ?? memberId;
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

    getPodiumWinners(t: Tournament): { first?: { id: string, name: string }, second?: { id: string, name: string }, third?: { id: string, name: string }, third2?: { id: string, name: string }, hasTwoThirds: boolean } {
        if (!t) return { hasTwoThirds: false };
        
        const getCompObj = (id: string): { id: string, name: string } => {
            const m = this.activeMembers.find(x => x.id === id);
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
}
