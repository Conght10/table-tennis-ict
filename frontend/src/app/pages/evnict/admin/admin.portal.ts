import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { CdkDragDrop, moveItemInArray, DragDropModule } from '@angular/cdk/drag-drop';
import { FormsModule } from '@angular/forms';
import { ChartModule } from 'primeng/chart';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { TagModule } from 'primeng/tag';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { DatePickerModule } from 'primeng/datepicker';
import { InputNumberModule } from 'primeng/inputnumber';
import { Member, MatchRecord, Tournament, AuditLog, CourtBooking, RankTier, TournamentType, TournamentPrize } from '../domain/evnict.models';
import { EvnictDataService } from '../domain/evnict-data.service';
import { Router, ActivatedRoute } from '@angular/router';

@Component({
    selector: 'app-evnict-admin-portal',
    standalone: true,
    imports: [CommonModule, FormsModule, ChartModule, TableModule, ButtonModule, SelectModule, TagModule, DialogModule, InputTextModule, DatePickerModule, InputNumberModule, DragDropModule],
    template: `
        <div class="portal-shell grid grid-cols-12 gap-6">

            <!-- Tab 1: Member Management -->
            <div class="col-span-12" *ngIf="activeTab === 'members'">
                <div class="grid grid-cols-12 gap-6">
                    <!-- Member Lists -->
                    <div class="col-span-12 xl:col-span-8">
                        <div class="card shadow-sm border border-surface-200">
                            <div class="flex items-center justify-between mb-4">
                                <h3 class="text-xl font-bold m-0 flex items-center gap-2">
                                    <i class="pi pi-users text-primary"></i> Thành viên câu lạc bộ
                                </h3>
                                <div class="flex items-center gap-2">
                                    <!-- Export Excel simulation -->
                                    <button class="px-3 py-2 bg-green-700 text-white rounded text-sm hover:bg-green-800 flex items-center gap-1 font-semibold" (click)="exportCSV()">
                                        <i class="pi pi-file-excel"></i> Xuất Excel
                                    </button>
                                    <button class="px-3 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 rounded text-sm font-bold hover:bg-slate-200 transition flex items-center gap-1 cursor-pointer" (click)="reloadMembers()">
                                        <i class="pi pi-refresh" [class.pi-spin]="isReloadingMembers"></i> Tải lại
                                    </button>
                                    <!-- Import Excel simulation -->
                                    <div class="relative">
                                        <button class="px-3 py-2 border border-surface-300 hover:bg-surface-100 rounded text-sm flex items-center gap-1 font-semibold dark:bg-surface-800 dark:border-surface-600">
                                            <i class="pi pi-upload"></i> Nhập Excel (CSV)
                                        </button>
                                        <input type="file" class="absolute inset-0 opacity-0 cursor-pointer" (change)="importCSV($event)" accept=".csv, .txt" />
                                    </div>
                                </div>
                            </div>

                            <p class="text-sm text-surface-500 mb-4" *ngIf="importMessage">{{ importMessage }}</p>

                            <!-- Mini Tabs for Member status -->
                            <div class="flex gap-4 border-b border-surface-200 pb-2 mb-4">
                                <button class="pb-2 font-bold text-sm" [class.border-b-2]="memberFilter === 'all'" [class.border-primary]="memberFilter === 'all'" [class.text-primary]="memberFilter === 'all'" (click)="memberFilter = 'all'">Tất cả ({{ allMembersCount }})</button>
                                <button class="pb-2 font-bold text-sm" [class.border-b-2]="memberFilter === 'pending'" [class.border-primary]="memberFilter === 'pending'" [class.text-primary]="memberFilter === 'pending'" (click)="memberFilter = 'pending'">Đang chờ duyệt ({{ pendingApprovalsCount }})</button>
                            </div>

                            <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                                <input
                                    pInputText
                                    type="text"
                                    class="w-full"
                                    placeholder="Tìm theo tên hoặc username..."
                                    [(ngModel)]="memberNameSearch"
                                />
                                <input
                                    pInputText
                                    type="text"
                                    class="w-full"
                                    placeholder="Tìm theo phòng/ban..."
                                    [(ngModel)]="memberDepartmentSearch"
                                />
                            </div>

                            <div class="overflow-auto border border-surface-200 rounded-lg">
                                <table class="w-full border-collapse text-left text-sm">
                                    <thead>
                                        <tr class="bg-surface-100 dark:bg-surface-800 border-b border-surface-200">
                                            <th class="py-2 px-3">Họ Tên, Username & Email</th>
                                            <th class="py-2 px-3">Phòng/Ban</th>
                                            <th class="py-2 px-3 text-center">Elo</th>
                                            <th class="py-2 px-3 text-center">Hạng</th>
                                            <th class="py-2 px-3">Trạng thái</th>
                                            <th class="py-2 px-3 text-center">Hành động</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr *ngFor="let member of filteredMembers" class="border-b border-surface-100 hover:bg-surface-50">
                                            <td class="py-2 px-3">
                                                <div class="font-semibold text-surface-900 dark:text-surface-0">{{ member.fullName }}</div>
                                                <small class="text-primary font-semibold">&#64;{{ member.username || '-' }}</small>
                                                <br />
                                                <small class="text-surface-500">{{ member.email }}</small>
                                            </td>
                                            <td class="py-2 px-3">{{ member.department || 'N/A' }}</td>
                                            <td class="py-2 px-3 text-center font-bold">{{ member.elo }}</td>
                                            <td class="py-2 px-3 text-center"><p-tag [value]="member.rankTier" severity="info" /></td>
                                            <td class="py-2 px-3">
                                                <p-tag [value]="member.isActive ? 'Active' : 'Pending'" [severity]="member.isActive ? 'success' : 'warn'" />
                                            </td>
                                            <td class="py-2 px-3 text-center">
                                                <div class="flex items-center justify-center gap-2" *ngIf="!member.isActive">
                                                    <button class="px-2 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-xs" (click)="approveMember(member.id)">Duyệt</button>
                                                    <button class="px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs" (click)="rejectMember(member.id)">Từ chối</button>
                                                </div>
                                                <div class="flex items-center justify-center gap-2" *ngIf="member.isActive">
                                                    <button class="px-2 py-1 border border-primary text-primary hover:bg-primary-50 dark:hover:bg-primary-950 rounded text-xs font-semibold" (click)="openOverrideDialog(member)">Điều chỉnh Elo/Hạng</button>
                                                </div>
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    <!-- Side bar stats -->
                    <div class="col-span-12 xl:col-span-4">
                        <div class="card shadow-sm border border-surface-200">
                            <h3 class="text-xl font-bold mb-4 flex items-center gap-2">
                                <i class="pi pi-chart-pie text-primary"></i> Phân Bổ Trình Độ (Rank)
                            </h3>
                            <div class="h-60 flex items-center justify-center bg-surface-50 dark:bg-surface-800 rounded-lg p-2">
                                <p-chart type="doughnut" [data]="rankChartData" [options]="rankChartOptions" class="w-full h-full" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Tab 2: Match Recording & Disputes -->
            <div class="col-span-12" *ngIf="activeTab === 'matches'">
                <div class="grid grid-cols-12 gap-6">
                    <!-- Left: direct scoring and walkover forms -->
                    <div class="col-span-12 lg:col-span-5 space-y-6">
                        <!-- Direct scoring -->
                        <div class="card shadow-sm border border-surface-200">
                            <h3 class="text-xl font-bold mb-4 flex items-center gap-2">
                                <i class="pi pi-plus-circle text-primary"></i> Ghi nhận trận đấu trực tiếp
                            </h3>
                            <div class="space-y-4">
                                <div class="grid grid-cols-2 gap-4">
                                    <div class="flex flex-col gap-1">
                                        <label class="block text-sm font-medium">Người chơi A</label>
                                        <p-select [options]="activeMembers" [(ngModel)]="newMatch.homePlayerId" optionLabel="fullName" optionValue="id" [filter]="true" placeholder="Chọn người chơi A" class="w-full"></p-select>
                                    </div>
                                    <div class="flex flex-col gap-1">
                                        <label class="block text-sm font-medium">Người chơi B</label>
                                        <p-select [options]="activeMembers" [(ngModel)]="newMatch.awayPlayerId" optionLabel="fullName" optionValue="id" [filter]="true" placeholder="Chọn người chơi B" class="w-full"></p-select>
                                    </div>
                                </div>
                                <div class="grid grid-cols-2 gap-4">
                                    <div class="flex flex-col gap-1">
                                        <label class="block text-sm font-medium">Điểm số A</label>
                                        <p-inputnumber [(ngModel)]="newMatch.homeScore" [min]="0" class="w-full" mode="decimal"></p-inputnumber>
                                    </div>
                                    <div class="flex flex-col gap-1">
                                        <label class="block text-sm font-medium">Điểm số B</label>
                                        <p-inputnumber [(ngModel)]="newMatch.awayScore" [min]="0" class="w-full" mode="decimal"></p-inputnumber>
                                    </div>
                                </div>
                                <div class="flex flex-col gap-1">
                                    <label class="block text-sm font-medium">Ghi chú (bắt buộc)</label>
                                    <input pInputText class="w-full" type="text" [(ngModel)]="newMatch.notes" placeholder="Lý do cập nhật hoặc tên trọng tài" />
                                </div>
                                <p-button label="Ghi Nhận & Tính Elo Tức Thì" icon="pi pi-check-circle" severity="primary" (onClick)="recordMatch()" class="w-full"></p-button>
                                <p class="text-sm text-surface-500 mt-2">{{ matchRecordMessage }}</p>
                            </div>
                        </div>

                        <!-- Walkover form -->
                        <div class="card border border-red-200 bg-red-50/5 dark:bg-surface-900 dark:border-red-900">
                            <h3 class="text-xl font-bold text-red-500 mb-4 flex items-center gap-2">
                                <i class="pi pi-exclamation-triangle"></i> Xử lý Vắng Mặt (Walkover)
                            </h3>
                            <div class="space-y-4">
                                <div class="grid grid-cols-2 gap-4">
                                    <div class="flex flex-col gap-1">
                                        <label class="block text-sm font-medium">Đấu thủ A</label>
                                        <p-select [options]="activeMembers" [(ngModel)]="walkover.homeId" optionLabel="fullName" optionValue="id" [filter]="true" placeholder="Chọn đấu thủ A" class="w-full"></p-select>
                                    </div>
                                    <div class="flex flex-col gap-1">
                                        <label class="block text-sm font-medium">Đấu thủ B</label>
                                        <p-select [options]="activeMembers" [(ngModel)]="walkover.awayId" optionLabel="fullName" optionValue="id" [filter]="true" placeholder="Chọn đấu thủ B" class="w-full"></p-select>
                                    </div>
                                </div>
                                <div class="flex flex-col gap-1">
                                    <label class="block text-sm font-medium">Quyết định xử thắng cho:</label>
                                    <p-select [options]="getWalkoverWinnerOptions()" [(ngModel)]="walkover.winnerId" optionLabel="label" optionValue="value" placeholder="Chọn đấu thủ thắng cuộc" class="w-full"></p-select>
                                </div>
                                <div class="flex flex-col gap-1">
                                    <label class="block text-sm font-medium">Lý do vắng mặt / Walkover (bắt buộc)</label>
                                    <input pInputText class="w-full" type="text" [(ngModel)]="walkover.reason" placeholder="e.g. No-show quá 15 phút" />
                                </div>
                                <p-button label="Ghi nhận Thắng Walkover (3-0, Không Elo)" icon="pi pi-exclamation-triangle" severity="danger" (onClick)="recordWalkover()" class="w-full"></p-button>
                                <p class="text-sm text-red-500 mt-2">{{ walkoverMessage }}</p>
                            </div>
                        </div>
                    </div>

                    <!-- Right: Pending disputes queues & match history -->
                    <div class="col-span-12 lg:col-span-7 space-y-6">
                        <!-- Disputed Queue -->
                        <div class="card shadow-sm border border-surface-200" *ngIf="disputedMatches.length">
                            <h3 class="text-xl font-bold text-red-600 mb-4 flex items-center gap-2">
                                <i class="pi pi-bell"></i> Hộp thư giải quyết khiếu nại ({{ disputedMatchesCount }} trận)
                            </h3>
                            <div class="space-y-4">
                                <div *ngFor="let disputed of disputedMatches" class="p-4 border border-red-300 dark:border-red-900 rounded-lg bg-red-50/10 space-y-3">
                                    <div class="flex items-center justify-between">
                                        <strong class="text-base">{{ memberName(disputed.homePlayerId) }} vs {{ memberName(disputed.awayPlayerId) }}</strong>
                                        <p-tag value="TRANH CHẤP" severity="danger" />
                                    </div>
                                    <div class="text-sm">Tỷ số ghi nhận: <span class="font-bold">{{ disputed.homeScore }} - {{ disputed.awayScore }}</span></div>
                                    <small class="text-surface-500 block">Lúc: {{ disputed.playedAt | date: 'dd/MM/yyyy HH:mm' }}</small>
                                    
                                    <div class="grid grid-cols-2 gap-3 bg-surface-0 dark:bg-surface-800 p-3 rounded border border-surface-200">
                                        <div>
                                            <label class="block text-xs font-semibold mb-1">Cập nhật tỉ số A</label>
                                            <input type="number" class="w-full p-2 border rounded text-sm" [(ngModel)]="disputedForm.homeScore" />
                                        </div>
                                        <div>
                                            <label class="block text-xs font-semibold mb-1">Cập nhật tỉ số B</label>
                                            <input type="number" class="w-full p-2 border rounded text-sm" [(ngModel)]="disputedForm.awayScore" />
                                        </div>
                                    </div>

                                    <div>
                                        <label class="block text-xs font-semibold mb-1">Lý do giải quyết (bắt buộc lưu audit log)</label>
                                        <input class="w-full p-2 border rounded text-sm" type="text" [(ngModel)]="disputedForm.reason" placeholder="e.g. Nhập nhầm điểm, trọng tài đã kiểm tra lại biên bản" />
                                    </div>

                                    <div class="flex justify-end gap-2 pt-2">
                                        <button class="px-3 py-1.5 bg-green-600 text-white rounded text-xs font-bold hover:bg-green-700" (click)="resolveDispute(disputed.id, 'confirm')">Giữ Nguyên & Xác Nhận</button>
                                        <button class="px-3 py-1.5 bg-blue-600 text-white rounded text-xs font-bold hover:bg-blue-700" (click)="resolveDispute(disputed.id, 'modify')">Sửa Đổi & Xác Nhận</button>
                                        <button class="px-3 py-1.5 bg-red-600 text-white rounded text-xs font-bold hover:bg-red-700" (click)="resolveDispute(disputed.id, 'cancel')">Hủy Trận Đấu</button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Match History -->
                        <div class="card shadow-sm border border-surface-200">
                            <h3 class="text-xl font-bold mb-4 flex items-center gap-2">
                                <i class="pi pi-history text-primary"></i> Nhật ký lịch sử thi đấu toàn hệ thống
                            </h3>
                            <div class="overflow-auto border border-surface-200 rounded-lg">
                                <table class="w-full border-collapse text-sm text-left">
                                    <thead>
                                        <tr class="bg-surface-50 border-b border-surface-200">
                                            <th class="py-2 px-3">Thời gian</th>
                                            <th class="py-2 px-3">Đầu thủ A vs B</th>
                                            <th class="py-2 px-3 text-center">Tỷ số</th>
                                            <th class="py-2 px-3 text-center">Elo thay đổi</th>
                                            <th class="py-2 px-3">Loại</th>
                                            <th class="py-2 px-3">Trạng thái</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr *ngFor="let m of recentMatches" class="border-b border-surface-100 hover:bg-surface-50">
                                            <td class="py-2 px-3 text-xs">{{ m.playedAt | date: 'dd/MM/yyyy HH:mm' }}</td>
                                            <td class="py-2 px-3 font-semibold">{{ memberName(m.homePlayerId) }} vs {{ memberName(m.awayPlayerId) }}</td>
                                            <td class="py-2 px-3 text-center font-bold">{{ m.homeScore }} - {{ m.awayScore }}</td>
                                            <td class="py-2 px-3 text-center text-xs">
                                                <span *ngIf="m.status === 'confirmed'">
                                                    {{ m.homeEloBefore }}→{{ m.homeEloAfter }} / {{ m.awayEloBefore }}→{{ m.awayEloAfter }}
                                                </span>
                                                <span *ngIf="m.status !== 'confirmed'">--</span>
                                            </td>
                                            <td class="py-2 px-3 text-xs capitalize">{{ m.source }}</td>
                                            <td class="py-2 px-3">
                                                <p-tag [value]="(m.status || 'CONFIRMED').toUpperCase()" [severity]="getMatchStatusSeverity(m.status)" />
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Tab 3: Tournament Engine -->
            <div class="col-span-12" *ngIf="activeTab === 'tournaments'">
                <!-- LIST VIEW -->
                <div *ngIf="tournamentViewMode === 'list'" class="card shadow-sm border border-surface-200 space-y-6">
                    <div class="flex items-center justify-between border-b border-surface-200 pb-4">
                        <div>
                            <h3 class="text-xl font-bold m-0 flex items-center gap-2">
                                <i class="pi pi-sitemap text-primary"></i> Quản Lý Giải Đấu CLB EVNICT
                            </h3>
                            <p class="text-xs text-slate-500 mt-1">Khởi tạo giải đấu mới, theo dõi lịch thi đấu vòng bảng và nhánh đấu trực tiếp (Knockout).</p>
                        </div>
                        <div class="flex items-center gap-2">
                            <button class="px-3.5 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 rounded text-sm font-bold hover:bg-slate-200 transition flex items-center gap-1.5 cursor-pointer" (click)="reloadTournaments()">
                                <i class="pi pi-refresh" [class.pi-spin]="isReloadingTournaments"></i> Tải lại danh sách
                            </button>
                            <button class="px-4 py-2 bg-primary text-white rounded text-sm font-semibold hover:bg-primary-600 transition flex items-center gap-2 cursor-pointer border-none" (click)="openCreateTournamentDialog()">
                                <i class="pi pi-plus"></i> Tạo giải đấu mới
                            </button>
                        </div>
                    </div>

                    <div class="tournament-toolbar">
                        <div class="tournament-toolbar__left">
                            <button type="button" class="tournament-chip" [class.is-active]="tournamentStatusFilter === 'all'" (click)="tournamentStatusFilter = 'all'">
                                Tất cả ({{ allTournaments.length }})
                            </button>
                            <button type="button" class="tournament-chip" [class.is-active]="tournamentStatusFilter === 'draft'" (click)="tournamentStatusFilter = 'draft'">
                                Draft ({{ tournamentDraftCount }})
                            </button>
                            <button type="button" class="tournament-chip" [class.is-active]="tournamentStatusFilter === 'ongoing'" (click)="tournamentStatusFilter = 'ongoing'">
                                Ongoing ({{ tournamentOngoingCount }})
                            </button>
                            <button type="button" class="tournament-chip" [class.is-active]="tournamentStatusFilter === 'finished'" (click)="tournamentStatusFilter = 'finished'">
                                Finished ({{ tournamentFinishedCount }})
                            </button>
                        </div>
                        <div class="tournament-toolbar__right">
                            <label class="tournament-search">
                                <i class="pi pi-search"></i>
                                <input type="text" [(ngModel)]="tournamentSearchKeyword" placeholder="Tìm theo tên giải, thể thức, địa điểm..." />
                            </label>
                            <select class="tournament-filter-select" [(ngModel)]="tournamentFormatFilter">
                                <option value="all">Mọi thể thức</option>
                                <option value="group">Chia bảng + Knockout</option>
                                <option value="round_robin">Vòng tròn tính điểm</option>
                            </select>
                        </div>
                    </div>

                    <div class="tournament-toolbar-divider" aria-hidden="true"></div>

                    <div class="overflow-auto border border-surface-200 rounded-lg">
                        <table class="w-full border-collapse text-left text-sm">
                            <thead>
                                <tr class="bg-surface-50 border-b border-surface-200">
                                    <th class="py-3 px-4">Tên giải đấu</th>
                                    <th class="py-3 px-4">Thể thức & Hình thức</th>
                                    <th class="py-3 px-4">Thời gian & Địa điểm</th>
                                    <th class="py-3 px-4">Giải thưởng</th>
                                    <th class="py-3 px-4 text-center">Đã đăng ký</th>
                                    <th class="py-3 px-4">Trạng thái</th>
                                    <th class="py-3 px-4 text-right">Hành động</th>
                                  </tr>
                              </thead>
                              <tbody>
                                  <tr *ngFor="let t of filteredTournaments; trackBy: trackByTournamentId" class="border-b border-surface-100 hover:bg-surface-50">
                                      <td class="py-3 px-4 font-bold text-slate-800 dark:text-slate-200">{{ t.name }}</td>
                                      <td class="py-3 px-4 font-medium text-xs">
                                          <div>{{ getTournamentTypeLabel(t.type) }}</div>
                                          <div class="text-[10px] text-slate-400 mt-0.5">{{ t.format === 'round_robin' ? 'Vòng tròn tính điểm' : 'Chia bảng + Knockout' }}</div>
                                      </td>
                                      <td class="py-3 px-4 text-xs">
                                          <div class="font-semibold text-slate-800 dark:text-slate-200">
                                              {{ t.startedAt | date:'dd/MM/yyyy' }}<span *ngIf="t.finishedAt"> - {{ t.finishedAt | date:'dd/MM/yyyy' }}</span>
                                          </div>
                                          <div class="text-[10px] text-slate-400 flex items-center gap-0.5 mt-0.5" *ngIf="t.location">
                                              <i class="pi pi-map-marker text-[9px]"></i> {{ t.location }}
                                          </div>
                                      </td>
                                      <td class="py-3 px-4 text-xs font-semibold text-amber-600 dark:text-amber-400" [title]="getPrizesSummary(t.prizes)">
                                          {{ getPrizesSummary(t.prizes) }}
                                      </td>
                                      <td class="py-3 px-4 text-center">
                                          <span class="px-2 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400">
                                              {{ t.participants?.length || 0 }} VĐV
                                          </span>
                                      </td>
                                      <td class="py-3 px-4">
                                          <p-tag [value]="(t.status || 'DRAFT').toUpperCase()" [severity]="getTournamentStatusSeverity(t.status)" />
                                      </td>
                                      <td class="py-3 px-4 text-right flex items-center justify-end gap-1.5">
                                          <button class="px-3 py-1 bg-surface-100 text-surface-700 hover:bg-surface-200 dark:bg-surface-800 dark:text-surface-200 dark:hover:bg-surface-700 rounded text-xs font-bold transition flex items-center gap-0.5" (click)="selectTournament(t.id)">
                                              Chi tiết <i class="pi pi-angle-right"></i>
                                          </button>
                                          <button class="p-2 text-red-550 hover:bg-red-50 dark:hover:bg-red-950/20 rounded transition cursor-pointer flex items-center justify-center border-none bg-transparent" 
                                                  title="Xóa giải đấu" (click)="deleteTournament(t.id)">
                                              <i class="pi pi-trash text-sm"></i>
                                          </button>
                                      </td>
                                  </tr>
                                  <tr *ngIf="!allTournaments.length">
                                      <td colspan="7" class="text-center py-10 text-slate-400">
                                          Chưa có giải đấu nào được tạo.
                                      </td>
                                  </tr>
                                  <tr *ngIf="allTournaments.length && !filteredTournaments.length">
                                      <td colspan="7" class="text-center py-10 text-slate-400">
                                          Không tìm thấy giải đấu phù hợp với bộ lọc hiện tại.
                                      </td>
                                  </tr>
                              </tbody>
                          </table>
                      </div>

                    <div class="tournament-metrics tournament-metrics--after-table">
                        <span class="tournament-metric">Đang hiển thị: {{ filteredTournaments.length }} giải</span>
                        <span class="tournament-metric">Đội hình Team: {{ teamTournamentCount }}</span>
                        <span class="tournament-metric">Giải cá nhân/đôi: {{ nonTeamTournamentCount }}</span>
                    </div>
                  </div>

                <!-- DETAIL VIEW -->
                <div *ngIf="tournamentViewMode === 'detail' && currTournament" class="grid grid-cols-12 gap-6 animate-fadein">
                    <!-- Left Column: Details & Controls (Only shown for draft setup) -->
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
                                    <span class="font-medium text-slate-400">Giai đoạn:</span>
                                    <span class="font-bold text-indigo-600 uppercase">{{ currTournament.stage || 'group' }}</span>
                                </div>
                                <div class="flex flex-col border-b pb-2 gap-1.5">
                                    <span class="font-medium text-slate-400">Hình thức thi đấu:</span>
                                    <select class="w-full p-2 border rounded bg-surface-0 dark:bg-surface-900 text-xs" [(ngModel)]="currTournament.format" (change)="updateTournamentConfig()">
                                        <option value="group">Chia bảng đấu + Knockout</option>
                                        <option value="round_robin">Vòng tròn tính điểm</option>
                                    </select>
                                </div>
                                <div class="flex flex-col border-b pb-2 gap-1.5" *ngIf="currTournament.format !== 'round_robin'">
                                    <span class="font-medium text-slate-400">Quy mô mỗi bảng (VĐV/Đội):</span>
                                    <input type="number" class="w-full p-2 border rounded bg-surface-0 dark:bg-surface-900 text-xs" min="2" max="10" [(ngModel)]="currTournament.groupSize" (change)="updateTournamentConfig()" />
                                </div>
                                <div class="flex flex-col border-b pb-2 gap-1.5" *ngIf="currTournament.type === 'team'">
                                    <span class="font-medium text-slate-400">Số lượng VĐV / Đội:</span>
                                    <input type="number" class="w-full p-2 border rounded bg-surface-0 dark:bg-surface-900 text-xs" min="2" max="5" [(ngModel)]="currTournament.teamSize" (change)="updateTournamentConfig()" />
                                </div>
                                <div class="flex items-center justify-between">
                                    <span class="font-medium text-slate-400">Đã tham gia:</span>
                                    <span class="font-bold text-indigo-600">{{ currTournament.participants?.length || 0 }} VĐV</span>
                                </div>
                            </div>
                            
                            <!-- Edit / Delete actions inside Draft Sidebar -->
                            <div class="mt-4 pt-3 border-t flex flex-col gap-2" *ngIf="currTournament.status === 'draft'">
                                <button class="w-full py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-750 dark:bg-indigo-950/20 dark:hover:bg-indigo-950/40 dark:text-indigo-300 rounded text-xs font-bold transition flex items-center justify-center gap-1.5 border-none cursor-pointer"
                                        (click)="openEditTournamentDialog(currTournament)">
                                    <i class="pi pi-pencil"></i> Chỉnh sửa thông tin
                                </button>
                                <button class="w-full py-2 bg-red-50 hover:bg-red-100 text-red-650 dark:bg-red-950/20 dark:hover:bg-red-950/40 dark:text-red-300 rounded text-xs font-bold transition flex items-center justify-center gap-1.5 border-none cursor-pointer"
                                        (click)="deleteTournament(currTournament.id)">
                                    <i class="pi pi-trash"></i> Xóa giải đấu
                                </button>
                            </div>
                        </div>

                        <!-- Manual Add Players for Draft Tournament (Batch Select) -->
                        <div class="card shadow-sm border border-surface-200" *ngIf="currTournament.status === 'draft'">
                            <h4 class="text-sm font-bold uppercase tracking-wider text-slate-500 mb-2">Thêm vận động viên</h4>
                            
                            <!-- Search Query Input -->
                            <div class="mb-3">
                                <input class="w-full p-2 text-xs border rounded bg-surface-0 dark:bg-surface-900" type="text" [(ngModel)]="addPlayerSearchQuery" placeholder="Tìm tên hoặc phòng ban..." />
                            </div>

                            <!-- Select All toggle checkbox -->
                            <div class="flex items-center justify-between mb-2 px-1">
                                <div class="flex items-center gap-1.5">
                                    <input type="checkbox" id="select-all-add-players" [checked]="isAllFilteredPlayersChecked()" (change)="toggleAllFilteredPlayers($event)" class="rounded text-primary focus:ring-primary cursor-pointer w-3.5 h-3.5" />
                                    <label for="select-all-add-players" class="cursor-pointer font-bold text-[10.5px] text-slate-650 dark:text-slate-350 select-none">Chọn tất cả</label>
                                </div>
                                <span class="text-[9px] text-slate-450 font-semibold" *ngIf="getFilteredAvailablePlayers().length > 0">
                                    {{ getFilteredAvailablePlayers().length }} VĐV
                                </span>
                            </div>

                            <!-- Checklist container -->
                            <div class="border border-surface-200 dark:border-surface-700 rounded-lg p-2 max-h-48 overflow-y-auto space-y-2 mb-3 bg-slate-50/50 dark:bg-slate-900/40">
                                <div *ngFor="let m of getFilteredAvailablePlayers()" class="flex items-center justify-between text-xs hover:bg-slate-100/50 dark:hover:bg-slate-800/50 p-1.5 rounded transition">
                                    <div class="flex items-center gap-2">
                                        <input type="checkbox" [id]="'add-p-' + m.id" [checked]="isAddPlayerChecked(m.id)" (change)="toggleAddPlayerCheckbox(m.id)" class="rounded text-primary focus:ring-primary cursor-pointer w-4 h-4" />
                                        <label [for]="'add-p-' + m.id" class="cursor-pointer font-medium text-slate-800 dark:text-slate-200">
                                            {{ m.fullName }} <span class="text-slate-400 font-bold">(Hạng {{ m.rankTier }} - {{ m.elo }} Elo)</span>
                                        </label>
                                    </div>
                                    <span class="text-[10px] text-slate-400">{{ m.department || 'Phong CNTT' }}</span>
                                </div>
                                <div *ngIf="!getFilteredAvailablePlayers().length" class="text-center py-4 text-slate-400 text-xs">
                                    Không tìm thấy VĐV khả dụng.
                                </div>
                            </div>

                            <button class="w-full py-2 bg-primary text-white rounded text-sm font-bold hover:bg-primary-600 transition flex items-center justify-center gap-2" [disabled]="!selectedAddPlayerIds.length" (click)="addSelectedPlayersToTournament()">
                                <i class="pi pi-user-plus"></i> Thêm VĐV đã chọn ({{ selectedAddPlayerIds.length }})
                            </button>
                        </div>
                    </div>

                    <!-- Right Column: Detail Content (Full-width for active tournaments) -->
                    <div [class]="currTournament.status === 'draft' ? 'col-span-12 lg:col-span-8 space-y-6' : 'col-span-12 space-y-6'">
                        
                        <!-- Horizontal Header for Ongoing/Finished Tournament -->
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
                            
                             <!-- Header actions -->
                             <div class="flex items-center gap-2">
                                 <button class="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded text-xs font-bold transition flex items-center gap-1.5 shadow border-none cursor-pointer" (click)="resetTournamentDraw(currTournament.id)">
                                     <i class="pi pi-refresh"></i> Chia Lại Giải Đấu
                                 </button>
                                 <button *ngIf="currTournament.stage === 'group' && currTournament.status === 'ongoing'" class="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-bold transition flex items-center gap-1.5 shadow border-none cursor-pointer" (click)="startKnockoutStage(currTournament.id)">
                                     <i class="pi pi-sitemap"></i> Bốc Thăm Nhánh Đấu Trực Tiếp
                                 </button>
                                 <button *ngIf="currTournament.stage === 'knockout' && isFinalMatchResolved() && currTournament.status === 'ongoing'" class="px-3.5 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded text-xs font-bold transition flex items-center gap-1.5 shadow border-none cursor-pointer" (click)="finishTournament(currTournament.id)">
                                     <i class="pi pi-check-circle"></i> Kết Thúc Giải & Trao Huy Chương
                                 </button>
                                 <button class="p-2 bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-950/20 dark:hover:bg-red-950/40 rounded transition border-none cursor-pointer flex items-center justify-center" 
                                         title="Xóa giải đấu" (click)="deleteTournament(currTournament.id)">
                                     <i class="pi pi-trash text-xs"></i>
                                 </button>
                             </div>
                        </div>
                        <!-- Navigation tabs for details -->
                        <div class="card shadow-sm border border-surface-200">
                             <!-- Detail Tabs Header -->
                             <div class="tournament-tabs">
                                 <button type="button" class="tournament-tab-btn" [class.is-active]="detailTab === 'overview'" (click)="detailTab = 'overview'">
                                     Tổng Quan & Giải Thưởng
                                 </button>
                                 <button type="button" class="tournament-tab-btn" [class.is-active]="detailTab === 'players'" (click)="detailTab = 'players'">
                                     VĐV & Đội Hình ({{ currTournament.participants?.length || 0 }})
                                 </button>
                                 <button type="button" class="tournament-tab-btn" [class.is-active]="detailTab === 'group'" [disabled]="currTournament.status === 'draft'" (click)="detailTab = 'group'">
                                     Vòng Bảng & Kết Quả
                                 </button>
                                 <button type="button" class="tournament-tab-btn" [class.is-active]="detailTab === 'knockout'" [disabled]="currTournament.status === 'draft' || currTournament.stage !== 'knockout'" (click)="detailTab = 'knockout'">
                                     Vòng Loại Trực Tiếp
                                 </button>
                             </div>

                             <!-- Detail Tab Content: Overview -->
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
                                         <div class="flex items-end justify-center w-full max-w-3xl mx-auto pt-6 pb-2 gap-6">
                                             
                                             <!-- 2nd Place: Left Column -->
                                              <div class="flex flex-col items-center flex-1 min-w-[150px] max-w-[220px]">
                                                  <div class="text-center mb-3 w-full px-1">
                                                      <div class="inline-flex items-center justify-center w-9 h-9 rounded-full bg-slate-800 border-2 border-slate-350 font-black text-xs text-slate-200 shadow-md mb-2">
                                                          2nd
                                                      </div>
                                                      <div class="text-xs font-bold text-slate-200 leading-tight">
                                                          {{ getTopThreeWinners(currTournament).second?.name || 'Đang đấu...' }}
                                                      </div>
                                                      <div *ngIf="currTournament.type === 'team' && getTopThreeWinners(currTournament).second?.id" class="text-[10px] text-slate-400 font-normal leading-snug mt-1 block">
                                                          {{ getTeamPlayersText(getTopThreeWinners(currTournament).second?.id || '') }}
                                                      </div>
                                                  </div>
                                                 <!-- Podium block -->
                                                 <div class="w-full h-24 bg-gradient-to-t from-slate-700/80 to-slate-500/80 border border-slate-500 rounded-t-xl flex items-center justify-center shadow-lg text-center">
                                                     <div class="flex flex-col items-center px-1">
                                                         <i class="pi pi-medal text-xl text-slate-300"></i>
                                                         <span class="text-[10px] text-slate-200 font-bold mt-1">GIẢI NHÌ</span>
                                                         <span class="text-[10px] text-amber-300 font-black mt-0.5" *ngIf="getPrizeForPodium(currTournament, 1)">
                                                             {{ getPrizeForPodium(currTournament, 1) }}
                                                         </span>
                                                     </div>
                                                 </div>
                                             </div>

                                             <!-- 1st Place: Center Column -->
                                              <div class="flex flex-col items-center flex-1 min-w-[170px] max-w-[240px]">
                                                  <div class="text-center mb-3 w-full px-1 scale-105 transform">
                                                      <div class="inline-flex items-center justify-center w-11 h-11 rounded-full bg-amber-950 border-2 border-amber-400 font-black text-sm text-amber-400 shadow-lg relative mb-2">
                                                          <i class="pi pi-prime absolute -top-3 text-yellow-400 text-xs animate-bounce"></i>
                                                          1st
                                                      </div>
                                                      <div class="text-sm font-black text-amber-300 leading-tight">
                                                          {{ getTopThreeWinners(currTournament).first?.name || 'Đang đấu...' }}
                                                      </div>
                                                      <div *ngIf="currTournament.type === 'team' && getTopThreeWinners(currTournament).first?.id" class="text-[11px] text-amber-400 font-medium leading-snug mt-1 block">
                                                          {{ getTeamPlayersText(getTopThreeWinners(currTournament).first?.id || '') }}
                                                      </div>
                                                  </div>
                                                 <!-- Podium block -->
                                                 <div class="w-full h-32 bg-gradient-to-t from-amber-700/90 to-yellow-500/90 border border-amber-400 rounded-t-xl flex items-center justify-center shadow-2xl relative text-center">
                                                     <div class="absolute inset-0 bg-yellow-400/10 animate-pulse rounded-t-xl"></div>
                                                     <div class="flex flex-col items-center px-1">
                                                         <i class="pi pi-trophy text-3xl text-yellow-350 drop-shadow"></i>
                                                         <span class="text-xs text-white font-black mt-1">VÔ ĐỊCH</span>
                                                         <span class="text-xs text-yellow-250 font-black mt-0.5 animate-pulse" *ngIf="getPrizeForPodium(currTournament, 0)">
                                                             {{ getPrizeForPodium(currTournament, 0) }}
                                                         </span>
                                                     </div>
                                                 </div>
                                             </div>

                                             <!-- 3rd Place: Right Column -->
                                              <div class="flex flex-col items-center flex-1 min-w-[150px] max-w-[220px]">
                                                  <div class="text-center mb-3 w-full px-1">
                                                      <div class="inline-flex items-center justify-center w-9 h-9 rounded-full bg-orange-950 border-2 border-orange-650 font-black text-xs text-orange-400 shadow-md mb-2">
                                                          3rd
                                                      </div>
                                                      <div class="text-xs font-bold text-orange-355 leading-tight">
                                                          {{ getTopThreeWinners(currTournament).third?.name || 'Đang đấu...' }}
                                                      </div>
                                                      <div *ngIf="currTournament.type === 'team' && getTopThreeWinners(currTournament).third?.id" class="text-[10px] text-slate-400 font-normal leading-snug mt-1 block">
                                                          {{ getTeamPlayersText(getTopThreeWinners(currTournament).third?.id || '') }}
                                                      </div>
</div>
                                                 <!-- Podium block -->
                                                 <div class="w-full h-16 bg-gradient-to-t from-orange-800/80 to-amber-750/80 border border-orange-650 rounded-t-xl flex items-center justify-center shadow-lg text-center">
                                                     <div class="flex flex-col items-center px-1">
                                                         <i class="pi pi-medal text-xl text-orange-400"></i>
                                                         <span class="text-[10px] text-orange-200 font-bold mt-1">GIẢI BA</span>
                                                         <span class="text-[10px] text-amber-300 font-black mt-0.5" *ngIf="getPrizeForPodium(currTournament, 2)">
                                                             {{ getPrizeForPodium(currTournament, 2) }}
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
                                             <span class="text-indigo-600 dark:text-indigo-400 text-[10px] uppercase font-black tracking-wider">Tiến Độ Giải Đấu</span>
                                             <h3 class="text-xl font-black m-0 text-slate-800 dark:text-slate-100">
                                                 {{ getTournamentProgressPercent(currTournament) }}%
                                             </h3>
                                         </div>
                                         <div class="w-11 h-11 bg-gradient-to-br from-indigo-500 to-purple-650 text-white rounded-xl flex items-center justify-center text-lg shadow-md shadow-indigo-500/20">
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
                                         <div class="w-11 h-11 bg-gradient-to-br from-emerald-500 to-teal-650 text-white rounded-xl flex items-center justify-center text-lg shadow-md shadow-emerald-500/20">
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

                              <div *ngIf="detailTab === 'players'" class="space-y-6">
                                  <!-- Warning Banner for deficit teams -->
                                  <div class="p-4 bg-orange-50/80 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-900 rounded-xl mb-4 flex items-center justify-between" *ngIf="hasDeficitTeams() && currTournament.status === 'ongoing'">
                                      <div class="flex items-center gap-3">
                                          <i class="pi pi-exclamation-triangle text-orange-500 text-xl animate-pulse"></i>
                                          <div>
                                              <h5 class="text-sm font-bold text-orange-850 dark:text-orange-300 m-0">Đội hình giải đấu đang bị thiếu người!</h5>
                                              <p class="text-xs text-orange-650 dark:text-orange-400 m-0 mt-0.5">
                                                  Có đội bóng thiếu thành viên do có VĐV rút giải. Các bảng đấu liên quan cần được tái cấu trúc lịch thi đấu.
                                              </p>
                                          </div>
                                      </div>
                                      <div class="flex items-center gap-2">
                                          <button class="px-3.5 py-2 bg-orange-600 text-white rounded text-xs font-bold hover:bg-orange-700 transition cursor-pointer border-none shadow-sm flex items-center gap-1.5" (click)="rebalanceDeficitTeams()">
                                              <i class="pi pi-sync"></i> Tái cấu trúc đội + bảng
                                          </button>
                                          <button class="px-3.5 py-2 bg-white text-orange-700 border border-orange-300 rounded text-xs font-bold hover:bg-orange-50 transition cursor-pointer shadow-sm flex items-center gap-1.5" (click)="toggleManualRestructureMode()">
                                              <i class="pi pi-sliders-h"></i> Chỉnh tay kéo-thả
                                          </button>
                                      </div>
                                  </div>

                                  <div class="p-4 border border-primary-200 dark:border-primary-900 rounded-xl bg-primary-50/40 dark:bg-primary-950/20 space-y-4 mb-5" *ngIf="showManualRestructure && currTournament.type === 'team' && currTournament.status === 'ongoing'">
                                      <div class="flex items-center justify-between">
                                          <div>
                                              <h5 class="m-0 text-sm font-black text-primary-700 dark:text-primary-300">Chỉnh tay đội/bảng bằng kéo-thả</h5>
                                              <p class="m-0 mt-1 text-xs text-slate-600 dark:text-slate-300">
                                                  Bước 1: Kéo VĐV sang đội khác để cân lại quân số. Bước 2: Kéo đội sang bảng khác để cân bảng. Sau cùng bấm nút dựng lại lịch đấu.
                                              </p>
                                          </div>
                                          <button class="px-2.5 py-1 border border-slate-300 dark:border-slate-700 rounded text-[11px] font-bold bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800" (click)="showManualRestructure = false">
                                              Đóng
                                          </button>
                                      </div>

                                      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                          <div class="space-y-3">
                                              <h6 class="m-0 text-xs font-black uppercase tracking-wide text-slate-700 dark:text-slate-200">Kéo VĐV để chỉnh đội</h6>
                                              <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                  <div *ngFor="let team of currTournament.teams" class="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 space-y-2"
                                                       (dragover)="allowDrop($event)" (drop)="onDropPlayerToTeam($event, team.id)">
                                                      <div class="text-xs font-extrabold text-indigo-600 dark:text-indigo-355 flex items-center justify-between">
                                                          <span>{{ team.name }}</span>
                                                          <span class="px-1.5 py-0.2 bg-slate-100 dark:bg-slate-800 rounded text-[10px]">{{ team.players.length }}/{{ currTournament.teamSize || 3 }}</span>
                                                      </div>
                                                      <div class="space-y-1.5 min-h-[56px]">
                                                          <div *ngFor="let p of team.players"
                                                               draggable="true"
                                                               (dragstart)="onPlayerDragStart(team.id, p.id)"
                                                               class="px-2 py-1 rounded bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] font-semibold text-slate-700 dark:text-slate-200 cursor-move flex items-center justify-between">
                                                              <span>{{ p.name }}</span>
                                                              <i class="pi pi-arrows-alt text-[10px] text-slate-400"></i>
                                                          </div>
                                                          <div *ngIf="!team.players.length" class="text-[10px] text-slate-400 italic">Thả VĐV vào đây</div>
                                                      </div>
                                                  </div>
                                              </div>
                                          </div>

                                          <div class="space-y-3">
                                              <h6 class="m-0 text-xs font-black uppercase tracking-wide text-slate-700 dark:text-slate-200">Kéo đội để chỉnh bảng</h6>
                                              <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                  <div *ngFor="let g of currTournament.groups" class="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 space-y-2"
                                                       (dragover)="allowDrop($event)" (drop)="onDropCompetitorToGroup($event, g.groupName)">
                                                      <div class="text-xs font-extrabold text-emerald-650 dark:text-emerald-350">Bảng {{ g.groupName }}</div>
                                                      <div class="space-y-1.5 min-h-[56px]">
                                                          <div *ngFor="let comp of g.competitors"
                                                               draggable="true"
                                                               (dragstart)="onCompetitorDragStart(g.groupName, comp.id)"
                                                               [title]="getTeamPlayersText(comp.id) ? ('Thành viên: ' + getTeamPlayersText(comp.id)) : comp.name"
                                                               class="px-2 py-1 rounded bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900 text-[11px] font-semibold text-emerald-800 dark:text-emerald-250 cursor-move flex items-center justify-between">
                                                              <span>{{ comp.name }}</span>
                                                              <span class="text-[10px] text-emerald-700 dark:text-emerald-350">{{ getTeamPlayerCount(comp.id) }} VĐV</span>
                                                          </div>
                                                          <div *ngIf="!g.competitors.length" class="text-[10px] text-slate-400 italic">Thả đội vào đây</div>
                                                      </div>
                                                  </div>
                                              </div>
                                          </div>
                                      </div>

                                      <div class="flex justify-end pt-2 border-t border-slate-200 dark:border-slate-800">
                                          <button class="px-3.5 py-2 bg-primary text-white rounded text-xs font-bold hover:bg-primary-600 transition cursor-pointer border-none shadow-sm flex items-center gap-1.5" (click)="rebuildGroupScheduleFromCurrentGroups()">
                                              <i class="pi pi-refresh"></i> Dựng lại lịch bảng từ cấu hình hiện tại
                                          </button>
                                      </div>
                                  </div>

                                  <!-- Section 1: Unified Registered VĐV & Seeding Table -->
                                  <div class="card shadow-sm border border-surface-200 p-4">
                                      <div class="flex items-center justify-between mb-4 flex-wrap gap-2">
                                          <h4 class="text-base font-bold flex items-center gap-2 m-0 text-slate-800 dark:text-slate-100">
                                              <i class="pi pi-users text-primary"></i> 1. Danh sách VĐV & Thứ tự hạt giống
                                          </h4>
                                          <div class="flex items-center gap-2">
                                               <button type="button" class="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 rounded text-xs font-bold hover:bg-slate-200 transition cursor-pointer flex items-center gap-1" (click)="reloadTournaments()">
                                                   <i class="pi pi-refresh" [class.pi-spin]="isReloadingTournaments"></i> Tải lại
                                               </button>
                                              <button type="button" 
                                                      class="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded transition flex items-center gap-1.5 cursor-pointer shadow-sm border-none disabled:opacity-50 disabled:cursor-not-allowed" 
                                                      [disabled]="!hasPendingSeedChanges" 
                                                      (click)="savePendingSeedChanges()">
                                                  <i class="pi pi-save"></i> Lưu thay đổi hạt giống
                                                  <span *ngIf="hasPendingSeedChanges" class="w-2.5 h-2.5 bg-amber-300 rounded-full animate-ping"></span>
                                              </button>
                                              <button type="button" class="px-3 py-1.5 bg-indigo-600 text-white rounded text-xs font-bold hover:bg-indigo-700 transition cursor-pointer border-none flex items-center gap-1" (click)="triggerImportRegistrations()">
                                                  <i class="pi pi-file-import"></i> Nhập Đăng Ký (CSV)
                                              </button>
                                          </div>
                                      </div>

                                      <div class="overflow-auto border rounded-lg max-h-[350px]">
                                          <table class="w-full border-collapse text-left text-xs">
                                              <thead>
                                                  <tr class="bg-surface-50 border-b">
                                                      <th *ngIf="currTournament.status === 'draft'" class="py-2 px-2 w-8 text-center text-slate-400" title="Kéo để sắp xếp thứ tự hạt giống">
                                                          <i class="pi pi-sort-alt text-xs"></i>
                                                      </th>
                                                      <th class="py-2.5 px-3">Họ và tên</th>
                                                      <th class="py-2.5 px-3">Phòng ban</th>
                                                      <th class="py-2.5 px-3 text-center">Giới tính</th>
                                                      <th class="py-2.5 px-3 text-center">ELO</th>
                                                      <th class="py-2.5 px-3 text-center">Phân hạng</th>
                                                      <th class="py-2.5 px-3 text-center">Hạt giống (Seed)</th>
                                                      <th class="py-2.5 px-3 text-center" *ngIf="currTournament.type === 'team' && currTournament.status === 'draft'">Đội trưởng</th>
                                                      <th class="py-2.5 px-3 text-center" *ngIf="currTournament.status !== 'finished'">Thao tác</th>
                                                  </tr>
                                              </thead>
                                              <tbody cdkDropList [cdkDropListDisabled]="currTournament.status !== 'draft'" (cdkDropListDropped)="onSeedDrop($event)" class="[&_.cdk-drag-placeholder]:opacity-30 [&_.cdk-drag-placeholder]:bg-indigo-50">
                                                  <tr *ngFor="let reg of sortedRegistrations" cdkDrag [cdkDragDisabled]="currTournament.status !== 'draft'" class="border-b hover:bg-surface-50 [&.cdk-drag-animating]:transition-transform">
                                                      <!-- Drag handle (only in pre-draw draft mode) -->
                                                      <td *ngIf="currTournament.status === 'draft'" cdkDragHandle class="py-2.5 px-2 text-center cursor-grab active:cursor-grabbing text-slate-300 hover:text-indigo-500 transition-colors select-none">
                                                          <i class="pi pi-bars text-xs"></i>
                                                      </td>
                                                      <td class="py-2.5 px-3 font-semibold text-slate-800 dark:text-slate-100">
                                                          {{ memberName(reg.memberId) }}
                                                      </td>
                                                      <td class="py-2.5 px-3 text-slate-500 dark:text-slate-400">
                                                          {{ reg.departmentSnapshot || getMemberDepartment(reg.memberId) || 'N/A' }}
                                                      </td>
                                                      <td class="py-2.5 px-3 text-center">
                                                          {{ reg.genderSnapshot || getMemberGender(reg.memberId) }}
                                                      </td>
                                                      <td class="py-2.5 px-3 text-center font-bold text-slate-700 dark:text-slate-300">
                                                          {{ reg.eloSnapshot || getMemberElo(reg.memberId) }}
                                                      </td>
                                                      <td class="py-2.5 px-3 text-center">
                                                          <span class="font-bold text-primary">Hạng {{ reg.rankSnapshot || getMemberRank(reg.memberId) }}</span>
                                                      </td>
                                                      <td class="py-2.5 px-3 text-center">
                                                          <!-- Inline Seeding Editor for Draft / Pre-draw stage -->
                                                          <ng-container *ngIf="currTournament.status === 'draft'; else postDrawSeeding">
                                                              <input type="number" min="1" [value]="reg.seed" (change)="onSeedInlineChange(reg, $event)" 
                                                                     class="w-14 px-1.5 py-0.5 text-xs border rounded text-center font-extrabold text-indigo-600 bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" />
                                                          </ng-container>
                                                          <!-- Dialog/History Seeding Editor for Post-draw stage -->
                                                          <ng-template #postDrawSeeding>
                                                              <span class="inline-flex items-center gap-1 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 px-2 py-1 rounded" (click)="openSeedEditDialog(reg)">
                                                                  <span class="font-extrabold text-indigo-600">{{ reg.seed }}</span>
                                                                  <i class="pi pi-pencil text-[9px] text-slate-400"></i>
                                                              </span>
                                                          </ng-template>
                                                      </td>
                                                      <td class="py-2.5 px-3 text-center" *ngIf="currTournament.type === 'team' && currTournament.status === 'draft'">
                                                          <input type="checkbox" [checked]="isCaptain(reg.memberId)" (change)="toggleCaptain(reg.memberId)" class="cursor-pointer h-4 w-4 rounded border-slate-350 text-primary" />
                                                      </td>
                                                      <td class="py-2.5 px-3 text-center" *ngIf="currTournament.status !== 'finished'">
                                                          <button class="px-2 py-1 bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-950/40 dark:text-red-400 rounded text-xxs font-bold transition cursor-pointer border-none" (click)="removePlayerFromTournament(reg.memberId)">
                                                              {{ currTournament.status === 'ongoing' ? 'Rút giải' : 'Xóa' }}
                                                          </button>
                                                      </td>
                                                  </tr>
                                                  <tr *ngIf="!currTournament.registrations?.length">
                                                      <td [attr.colspan]="currTournament.type === 'team' ? 8 : 7" class="text-center py-8 text-slate-400">
                                                          Chưa có đấu thủ nào đăng ký tham gia. Sử dụng khung checklist "Thêm vận động viên" ở cột trái để thiết lập danh sách.
                                                      </td>
                                                  </tr>
                                              </tbody>
                                          </table>
                                      </div>
                                  </div>

                                  <!-- Section 2: Teams assignment section (only for Double / Team formats) -->
                                  <div *ngIf="currTournament.type === 'team' || currTournament.type === 'double'" class="space-y-4">
                                      
                                      <!-- Sub-state A: Teams generated but groups NOT drawn yet -->
                                      <div *ngIf="currTournament.teams && currTournament.teams.length > 0 && (!currTournament.groups || currTournament.groups.length === 0)">
                                          <div class="flex items-center justify-between mb-3 border-b pb-2">
                                              <h4 class="text-base font-bold flex items-center gap-2 m-0 text-slate-800 dark:text-slate-100">
                                                  <i class="pi pi-users text-primary"></i> 2. Danh sách các đội đã phân chia
                                              </h4>
                                              <div class="flex items-center gap-2">
                                                  <button *ngIf="currTournament.status === 'draft'" class="px-3 py-1.5 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-700 rounded text-xs font-bold hover:bg-red-100 transition flex items-center gap-1" (click)="clearTeams()">
                                                      <i class="pi pi-trash"></i> Hủy đội hình
                                                  </button>
                                                  <button *ngIf="currTournament.status === 'draft'" class="px-3.5 py-2 bg-indigo-600 text-white rounded text-xs font-bold hover:bg-indigo-700 transition shadow-sm flex items-center gap-1" [disabled]="(currTournament.participants?.length || 0) < 4" (click)="drawTournament(currTournament.id)">
                                                      <i class="pi pi-sitemap"></i> Bốc Thăm Chia Bảng
                                                  </button>
                                              </div>
                                          </div>

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
                                                              {{ p.name }} <span class="text-slate-450 font-normal ml-1">(Hạng {{ getMemberRank(p.id) }})</span>
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
                                           <div class="flex items-center justify-between mb-3 border-b pb-2">
                                               <h4 class="text-base font-bold flex items-center gap-2 m-0 text-slate-800 dark:text-slate-100">
                                                   <i class="pi pi-sitemap text-primary"></i> 2. Kết quả phân bảng thi đấu các đội
                                               </h4>
                                               <div class="flex items-center gap-2 flex-wrap">
                                                   <button *ngIf="currTournament.status === 'draft'" class="px-3 py-1.5 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-700 rounded text-xs font-bold hover:bg-red-100 transition flex items-center gap-1" (click)="clearTeams()">
                                                       <i class="pi pi-trash"></i> Hủy đội hình
                                                   </button>
                                                   <button *ngIf="currTournament.status === 'draft'" class="px-3 py-1.5 bg-amber-100 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-700 rounded text-xs font-bold hover:bg-amber-200 transition flex items-center gap-1" (click)="drawTournament(currTournament.id)">
                                                       <i class="pi pi-sync"></i> Chia lại bảng
                                                   </button>
                                                   <button *ngIf="currTournament.status === 'ongoing' && currTournament.type === 'team'" class="px-2.5 py-1 bg-white text-primary border border-primary/30 rounded text-xxs font-bold hover:bg-primary/5 transition" (click)="toggleManualRestructureMode()">
                                                       {{ showManualRestructure ? 'Ẩn chỉnh tay' : 'Chỉnh tay kéo-thả' }}
                                                   </button>
                                                   <div class="text-xxs px-2.5 py-1 bg-green-50 text-green-700 border border-green-200 rounded-full font-extrabold flex items-center gap-1">
                                                       <i class="pi pi-check"></i> ĐÃ CHIA BẢNG THÀNH CÔNG
                                                   </div>
                                               </div>
                                           </div>
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

                                      <!-- Sub-state C: Draft tournament, no teams created yet -->
                                      <div *ngIf="(!currTournament.teams || currTournament.teams.length === 0) && currTournament.status === 'draft'" class="space-y-4">

                                          <!-- Manual Slot Builder Card -->
                                          <div class="border border-indigo-200 dark:border-indigo-900 rounded-xl overflow-hidden shadow-sm">
                                              <!-- Header (always visible) -->
                                              <div class="flex items-center justify-between px-4 py-3 bg-indigo-50/70 dark:bg-indigo-950/30 cursor-pointer select-none" (click)="toggleManualSlotBuilder()">
                                                  <div class="flex items-center gap-2">
                                                      <i class="pi pi-lock text-indigo-600 text-sm"></i>
                                                      <span class="text-xs font-black text-indigo-800 dark:text-indigo-300 uppercase tracking-wide">Phân đội thủ công (tuỳ chọn)</span>
                                                      <span class="text-[10px] px-2 py-0.5 rounded-full font-bold"
                                                            [class.bg-indigo-100]="getLockedMemberCount() === 0"
                                                            [class.text-indigo-500]="getLockedMemberCount() === 0"
                                                            [class.bg-indigo-600]="getLockedMemberCount() > 0"
                                                            [class.text-white]="getLockedMemberCount() > 0">
                                                          {{ getLockedMemberCount() > 0 ? (getLockedMemberCount() + ' VĐV đã khoá') : 'Chưa khoá ai' }}
                                                      </span>
                                                  </div>
                                                  <i class="pi text-indigo-500 text-xs transition-transform duration-200"
                                                     [class.pi-chevron-down]="!showManualSlotBuilder"
                                                     [class.pi-chevron-up]="showManualSlotBuilder"></i>
                                              </div>

                                              <!-- Expanded body -->
                                              <div *ngIf="showManualSlotBuilder" class="p-4 bg-white dark:bg-slate-900 space-y-4">
                                                  <p class="text-[11px] text-slate-500 dark:text-slate-400 m-0 leading-relaxed">
                                                      Khoá sẵn một số VĐV vào cùng 1 nhóm. Số VĐV còn lại sẽ được thuật toán chia đều theo hạng vào các đội (bao gồm điền nốt chỗ trống trong nhóm khoá).
                                                  </p>

                                                  <!-- Slot list -->
                                                  <div class="space-y-3" *ngIf="currTournament.manualTeamSlots?.length">
                                                      <div *ngFor="let slot of currTournament.manualTeamSlots"
                                                           class="border rounded-lg overflow-hidden transition-all"
                                                           [class.border-indigo-400]="activeSlotId === slot.slotId"
                                                           [class.border-slate-200]="activeSlotId !== slot.slotId"
                                                           [class.dark:border-indigo-700]="activeSlotId === slot.slotId"
                                                           [class.dark:border-slate-800]="activeSlotId !== slot.slotId">

                                                          <!-- Slot header row -->
                                                          <div class="flex items-center gap-2 px-3 py-2 cursor-pointer select-none"
                                                               [class.bg-indigo-50]="activeSlotId === slot.slotId"
                                                               [class.dark:bg-indigo-950/40]="activeSlotId === slot.slotId"
                                                               [class.bg-slate-50]="activeSlotId !== slot.slotId"
                                                               [class.dark:bg-slate-850]="activeSlotId !== slot.slotId"
                                                               (click)="selectSlot(slot.slotId)">
                                                              <i class="pi pi-lock text-[10px]"
                                                                 [class.text-indigo-500]="activeSlotId === slot.slotId"
                                                                 [class.text-slate-400]="activeSlotId !== slot.slotId"></i>
                                                              <!-- Inline editable label -->
                                                              <input type="text"
                                                                     [value]="getSlotLabel(slot.slotId)"
                                                                     (change)="updateSlotLabel(slot.slotId, $event)"
                                                                     (click)="$event.stopPropagation()"
                                                                     placeholder="Tên nhóm (tuỳ chọn)"
                                                                     class="flex-1 text-xs font-semibold bg-transparent border-none outline-none text-slate-800 dark:text-slate-100 placeholder-slate-400 min-w-0" />
                                                              <span class="text-[10px] px-1.5 py-0.5 rounded font-bold flex-shrink-0"
                                                                    [class.bg-indigo-100]="activeSlotId === slot.slotId"
                                                                    [class.text-indigo-700]="activeSlotId === slot.slotId"
                                                                    [class.bg-slate-100]="activeSlotId !== slot.slotId"
                                                                    [class.text-slate-500]="activeSlotId !== slot.slotId">
                                                                  {{ getSlotMemberCount(slot.slotId) }}/{{ currTournament.teamSize || 3 }}
                                                              </span>
                                                              <button class="p-1 hover:bg-red-50 dark:hover:bg-red-950/30 rounded text-slate-400 hover:text-red-500 transition flex-shrink-0 border-none bg-transparent cursor-pointer"
                                                                      (click)="$event.stopPropagation(); removeManualSlot(slot.slotId)" title="Xoá nhóm">
                                                                  <i class="pi pi-times text-[10px]"></i>
                                                              </button>
                                                          </div>

                                                          <!-- Player checklist (visible when slot is active) -->
                                                          <div *ngIf="activeSlotId === slot.slotId" class="p-3 border-t border-indigo-100 dark:border-indigo-900/50 bg-white dark:bg-slate-900">
                                                              <p class="text-[10px] text-slate-400 mb-2 m-0">Chọn VĐV để thêm vào nhóm này:</p>
                                                              <div class="grid grid-cols-2 md:grid-cols-3 gap-1.5 max-h-[180px] overflow-auto">
                                                                  <div *ngFor="let reg of sortedRegistrations"
                                                                       class="flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer border transition-all select-none text-xs"
                                                                       [class.bg-indigo-50]="isPlayerInSlot(slot.slotId, reg.memberId)"
                                                                       [class.border-indigo-300]="isPlayerInSlot(slot.slotId, reg.memberId)"
                                                                       [class.dark:bg-indigo-950/40]="isPlayerInSlot(slot.slotId, reg.memberId)"
                                                                       [class.dark:border-indigo-700]="isPlayerInSlot(slot.slotId, reg.memberId)"
                                                                       [class.bg-white]="!isPlayerInSlot(slot.slotId, reg.memberId)"
                                                                       [class.border-slate-200]="!isPlayerInSlot(slot.slotId, reg.memberId)"
                                                                       [class.dark:bg-slate-850]="!isPlayerInSlot(slot.slotId, reg.memberId)"
                                                                       [class.dark:border-slate-700]="!isPlayerInSlot(slot.slotId, reg.memberId)"
                                                                       [class.opacity-50]="isPlayerInAnySlot(reg.memberId) && !isPlayerInSlot(slot.slotId, reg.memberId)"
                                                                       (click)="togglePlayerInSlot(slot.slotId, reg.memberId)">
                                                                      <i class="pi flex-shrink-0 text-[10px]"
                                                                         [class.pi-check-circle]="isPlayerInSlot(slot.slotId, reg.memberId)"
                                                                         [class.text-indigo-600]="isPlayerInSlot(slot.slotId, reg.memberId)"
                                                                         [class.pi-circle]="!isPlayerInSlot(slot.slotId, reg.memberId)"
                                                                         [class.text-slate-300]="!isPlayerInSlot(slot.slotId, reg.memberId)"></i>
                                                                      <span class="truncate font-medium"
                                                                            [class.text-indigo-700]="isPlayerInSlot(slot.slotId, reg.memberId)"
                                                                            [class.dark:text-indigo-300]="isPlayerInSlot(slot.slotId, reg.memberId)"
                                                                            [class.text-slate-700]="!isPlayerInSlot(slot.slotId, reg.memberId)"
                                                                            [class.dark:text-slate-300]="!isPlayerInSlot(slot.slotId, reg.memberId)">
                                                                          {{ memberName(reg.memberId) }}
                                                                      </span>
                                                                      <span class="text-[9px] text-slate-400 flex-shrink-0">{{ reg.rankSnapshot || getMemberRank(reg.memberId) }}</span>
                                                                  </div>
                                                              </div>
                                                          </div>
                                                      </div>
                                                  </div>

                                                  <!-- Empty state -->
                                                  <div *ngIf="!currTournament.manualTeamSlots?.length" class="py-4 text-center text-[11px] text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-lg">
                                                      Chưa có nhóm khoá nào. Bấm nút bên dưới để thêm.
                                                  </div>

                                                  <!-- Slot actions -->
                                                  <div class="flex items-center gap-2 flex-wrap">
                                                      <button class="px-3 py-1.5 border border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300 rounded text-xs font-bold hover:bg-indigo-50 dark:hover:bg-indigo-950/30 transition cursor-pointer flex items-center gap-1 bg-transparent"
                                                              (click)="addManualSlot()">
                                                          <i class="pi pi-plus text-[10px]"></i> Thêm nhóm khoá mới
                                                      </button>
                                                      <button *ngIf="(currTournament.manualTeamSlots?.length || 0) > 0"
                                                              class="px-3 py-1.5 border border-red-200 text-red-500 rounded text-xs font-bold hover:bg-red-50 transition cursor-pointer flex items-center gap-1 bg-transparent"
                                                              (click)="clearAllManualSlots()">
                                                          <i class="pi pi-trash text-[10px]"></i> Xoá tất cả nhóm
                                                      </button>
                                                  </div>
                                              </div>
                                          </div>

                                          <!-- Generate teams button -->
                                          <div class="py-6 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-slate-400 text-xs space-y-3">
                                              <i class="pi pi-users block text-xl text-slate-350"></i>
                                              <p class="m-0 max-w-xs mx-auto">
                                                  <span *ngIf="getLockedMemberCount() === 0">Chưa phân chia đội hình. Chọn đội trưởng ở trên (nếu có) hoặc thiết lập nhóm khoá thủ công, rồi bấm nút dưới.</span>
                                                  <span *ngIf="getLockedMemberCount() > 0" class="text-indigo-600 dark:text-indigo-400 font-semibold">
                                                      <i class="pi pi-lock text-xs mr-1"></i>
                                                      {{ getLockedMemberCount() }} VĐV đã khoá nhóm – {{ (currTournament.participants?.length || 0) - getLockedMemberCount() }} VĐV còn lại sẽ được chia ngẫu nhiên theo hạng.
                                                  </span>
                                              </p>
                                              <div class="flex justify-center">
                                                  <button class="px-4 py-2 bg-primary text-white rounded text-xs font-bold hover:bg-primary-600 transition flex items-center gap-1 shadow-sm" [disabled]="(currTournament.participants?.length || 0) < 4" (click)="generateTeams()">
                                                      <i class="pi pi-users"></i>
                                                      <span *ngIf="getLockedMemberCount() === 0">Chia Đội Ngẫu Nhiên &amp; Cân Bằng Theo Hạng</span>
                                                      <span *ngIf="getLockedMemberCount() > 0">Chia Đội (Kết hợp Nhóm khoá + Tự động)</span>
                                                  </button>
                                              </div>
                                          </div>
                                      </div>
                                  </div>

                                  <!-- Section 2 Single: Group draw for individual-player tournaments -->
                                  <div *ngIf="currTournament.type === 'single'" class="space-y-4">

                                      <!-- Sub-state: No groups yet -->
                                      <div *ngIf="!currTournament.groups || currTournament.groups.length === 0">
                                          <div class="flex items-center justify-between mb-3 border-b pb-2">
                                              <h4 class="text-base font-bold flex items-center gap-2 m-0 text-slate-800 dark:text-slate-100">
                                                  <i class="pi pi-sitemap text-primary"></i> 2. Bốc Thăm Chia Bảng (Giải Đơn)
                                              </h4>
                                              <button *ngIf="currTournament.status === 'draft'" class="px-3.5 py-2 bg-indigo-600 text-white rounded text-xs font-bold hover:bg-indigo-700 transition shadow-sm flex items-center gap-1" [disabled]="(currTournament.participants?.length || 0) < 4" (click)="drawTournament(currTournament.id)">
                                                  <i class="pi pi-sitemap"></i> Bốc Thăm Chia Bảng
                                              </button>
                                          </div>
                                          <div class="flex flex-col items-center justify-center py-8 text-slate-400 gap-2 border border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
                                              <i class="pi pi-sitemap text-2xl text-slate-300"></i>
                                              <p class="text-xs m-0">Chưa chia bảng. Bấm <strong>"Bốc Thăm Chia Bảng"</strong> để phân bảng thi đấu cho các VĐV.</p>
                                          </div>
                                      </div>

                                      <!-- Sub-state: Groups drawn -->
                                      <div *ngIf="currTournament.groups && currTournament.groups.length > 0" class="space-y-4">
                                          <div class="flex items-center justify-between mb-3 border-b pb-2">
                                              <h4 class="text-base font-bold flex items-center gap-2 m-0 text-slate-800 dark:text-slate-100">
                                                  <i class="pi pi-sitemap text-primary"></i> 2. Kết quả phân bảng cá nhân
                                              </h4>
                                              <div class="flex items-center gap-2 flex-wrap">
                                                  <button *ngIf="currTournament.status === 'draft'" class="px-3 py-1.5 bg-amber-100 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-700 rounded text-xs font-bold hover:bg-amber-200 transition flex items-center gap-1" (click)="drawTournament(currTournament.id)">
                                                      <i class="pi pi-sync"></i> Chia lại bảng
                                                  </button>
                                                  <div class="text-xxs px-2.5 py-1 bg-green-50 text-green-700 border border-green-200 rounded-full font-extrabold flex items-center gap-1">
                                                      <i class="pi pi-check"></i> ĐÃ CHIA BẢNG THÀNH CÔNG
                                                  </div>
                                              </div>
                                          </div>
                                          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                                              <div *ngFor="let g of currTournament.groups" class="p-4 border border-surface-200 rounded-xl bg-surface-50 dark:bg-surface-800 shadow-inner space-y-3">
                                                  <div class="font-black text-sm text-primary pb-1.5 border-b border-surface-200 flex justify-between items-center">
                                                      <span>BẢNG {{ g.groupName }}</span>
                                                      <span class="text-xxs px-2.5 py-0.5 bg-primary/10 text-primary rounded-full font-bold">Vòng loại</span>
                                                  </div>
                                                  <div class="space-y-2">
                                                      <div *ngFor="let comp of g.competitors" class="p-2.5 bg-white dark:bg-slate-900 border border-surface-200 rounded-lg flex items-center gap-2 shadow-sm">
                                                          <i class="pi pi-user text-slate-400 text-xs"></i>
                                                          <span class="text-xs font-semibold text-slate-800 dark:text-slate-200">{{ comp.name }}</span>
                                                          <ng-container *ngIf="getRegSeed(comp.id) as seedVal">
                                                              <span class="ml-auto text-[10px] px-1.5 py-0.2 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400 rounded font-bold">Seed {{ seedVal }}</span>
                                                          </ng-container>
                                                      </div>
                                                  </div>
                                              </div>
                                          </div>
                                      </div>
                                  </div>

                                  <!-- Section 3: History & Draw Revisions (bottom) -->
                                  <div class="grid grid-cols-1 xl:grid-cols-2 gap-6" *ngIf="currTournament.seedOverrideHistory?.length || currTournament.drawRevisions?.length">
                                      <!-- Seed Override History panel -->
                                      <div class="card shadow-sm border border-surface-200 p-4" *ngIf="currTournament.seedOverrideHistory?.length">
                                          <h5 class="text-sm font-bold mb-3 flex items-center gap-2 m-0 text-slate-800 dark:text-slate-100">
                                              <i class="pi pi-history text-slate-500"></i> Lịch sử điều chỉnh Hạt Giống
                                          </h5>
                                          <div class="space-y-3 max-h-[300px] overflow-auto pr-1">
                                              <div *ngFor="let h of currTournament.seedOverrideHistory" class="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg text-xs space-y-1 relative border border-slate-100 dark:border-slate-800">
                                                  <div class="flex items-center justify-between text-[11px] text-slate-450 mb-1">
                                                      <span class="font-bold text-slate-700 dark:text-slate-200">VĐV: {{ memberName(h.memberId) }}</span>
                                                      <span>{{ h.overriddenAt | date:'dd/MM/yyyy HH:mm' }}</span>
                                                  </div>
                                                  <div class="font-medium text-slate-800 dark:text-slate-100">
                                                      Hạt giống: <span class="line-through text-red-500 font-bold mr-1">{{ h.oldSeed }}</span> &rarr; <span class="text-green-600 font-bold ml-1">{{ h.newSeed }}</span>
                                                  </div>
                                                  <div class="text-[11px] text-slate-500 dark:text-slate-400 italic">
                                                      Lý do: {{ h.reason }}
                                                  </div>
                                                  <div class="text-[10px] text-slate-450 text-right mt-1">
                                                      Thực hiện bởi: {{ memberName(h.actorId) }}
                                                  </div>
                                              </div>
                                          </div>
                                      </div>

                                      <!-- Draw Revisions timeline and comparisons -->
                                      <div class="card shadow-sm border border-surface-200 p-4" *ngIf="currTournament.drawRevisions?.length">
                                          <h5 class="text-sm font-bold mb-3 flex items-center gap-2 m-0 text-slate-800 dark:text-slate-100">
                                              <i class="pi pi-clone text-slate-500"></i> Các phiên bản Bốc Thăm (Revisions: {{ currTournament.drawRevisions?.length || 0 }})
                                          </h5>
                                          <div class="space-y-4 max-h-[300px] overflow-auto pr-1">
                                              <div *ngFor="let rev of currTournament.drawRevisions" class="p-3 border rounded-lg bg-surface-50 dark:bg-slate-850 text-xs">
                                                  <div class="flex items-center justify-between border-b pb-2 mb-2">
                                                      <span class="font-extrabold text-slate-800 dark:text-slate-100 text-sm">Bản vẽ #{{ rev.revisionNo }}</span>
                                                      <span class="px-2 py-0.5 rounded text-[10px] font-bold" [ngClass]="{
                                                          'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400': rev.status === 'committed',
                                                          'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400': rev.status === 'dirty'
                                                      }">
                                                          {{ rev.status === 'committed' ? 'Đã Áp Dụng (Committed)' : 'Nháp / Chờ điều chỉnh (Dirty)' }}
                                                      </span>
                                                  </div>
                                                  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                      <div>
                                                          <div class="font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                                                              <i class="pi pi-users text-slate-400"></i> Cơ cấu đội hình:
                                                          </div>
                                                          <ul class="list-disc pl-4 space-y-1 text-slate-600 dark:text-slate-400 m-0">
                                                              <li *ngFor="let team of rev.teams">
                                                                  <strong>{{ team.teamName }}:</strong>
                                                                  <span>{{ getMemberNamesJoined(team.memberIds) }}</span>
                                                                  <span class="ml-1 text-[10px] bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-400 px-1 rounded font-bold">Tổng Seed: {{ team.seedTotal }}</span>
                                                              </li>
                                                          </ul>
                                                      </div>
                                                      <div>
                                                          <div class="font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                                                              <i class="pi pi-sitemap text-slate-400"></i> Cơ cấu bảng đấu:
                                                          </div>
                                                          <ul class="list-disc pl-4 space-y-1 text-slate-600 dark:text-slate-400 m-0">
                                                              <li *ngFor="let g of rev.groups">
                                                                  <strong>Bảng {{ g.groupName }}:</strong>
                                                                  <span>{{ getCompetitorNamesJoined(g.competitorIds) }}</span>
                                                              </li>
                                                          </ul>
                                                      </div>
                                                  </div>
                                                  <div class="mt-2 pt-2 border-t flex justify-between text-[10px] text-slate-400">
                                                      <span>Lý do: {{ rev.reason }}</span>
                                                      <span>Bởi: {{ memberName(rev.actorId) }} lúc {{ rev.createdAt | date:'dd/MM/yyyy HH:mm' }}</span>
                                                  </div>
                                              </div>
                                          </div>
                                      </div>
                                  </div>
                              </div>


                            <!-- Detail Tab Content: Group Stage -->
                            <div *ngIf="detailTab === 'group'" class="space-y-6">
                                <!-- Interactive matches matrix -->
                                <div>
                                    <div class="flex items-center justify-between mb-4 border-b pb-3 flex-wrap gap-3">
                                        <h4 class="text-base font-bold flex items-center gap-2 m-0 text-slate-800 dark:text-slate-100">
                                            <i class="pi pi-pencil text-primary"></i> Nhập Kết Quả Trận Đấu Vòng Bảng
                                        </h4>
                                        
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
                                                    <th class="py-3 px-4 text-center" *ngIf="currTournament.status === 'ongoing'" style="width: 130px">Thao tác</th>
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
                                                                            class="p-1 hover:bg-surface-200 dark:hover:bg-surface-800 rounded transition text-slate-500 cursor-pointer flex items-center justify-center border-none bg-transparent"
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
                                                            
                                                            <!-- Score Inputs / Display -->
                                                            <td class="py-3 px-4 text-center">
                                                                <!-- Normal match score display -->
                                                                <div class="flex flex-col items-center gap-0.5" *ngIf="currTournament.type !== 'team'">
                                                                    <span class="font-extrabold text-sm text-slate-800 dark:text-slate-200" *ngIf="match.completed">
                                                                        {{ match.homeScore }} - {{ match.awayScore }}
                                                                    </span>
                                                                    <span class="text-slate-400 font-semibold text-xs" *ngIf="!match.completed">
                                                                        Chưa đấu
                                                                    </span>
                                                                    <div *ngIf="match.setScores && match.setScores.length > 0" class="text-[9px] text-slate-400 font-normal">
                                                                        (<span *ngFor="let set of match.setScores; let last = last">{{ set.home }}-{{ set.away }}{{ last ? '' : ', ' }}</span>)
                                                                    </div>
                                                                </div>
                                                                
                                                                <!-- Team match score display -->
                                                                <div class="flex items-center justify-center gap-2" *ngIf="currTournament.type === 'team'">
                                                                    <span class="px-2.5 py-0.5 bg-primary text-white rounded text-xs font-extrabold">{{ match.homeScore || 0 }}</span>
                                                                    <span class="text-slate-400 font-bold">:</span>
                                                                    <span class="px-2.5 py-0.5 bg-primary text-white rounded text-xs font-extrabold">{{ match.awayScore || 0 }}</span>
                                                                </div>
                                                            </td>
                                                            
                                                            <!-- Away Competitor -->
                                                            <td class="py-3 px-4 text-left">
                                                                <div class="font-bold text-slate-800 dark:text-slate-200" [class.text-green-600]="match.awayScore > match.homeScore">
                                                                    {{ competitorName(match.awayCompetitorId) }}
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
                                                            
                                                            <!-- Actions -->
                                                            <td class="py-3 px-4 text-center" *ngIf="currTournament.status === 'ongoing'">
                                                                <div class="flex items-center justify-center gap-1">
                                                                    <button *ngIf="currTournament.type !== 'team'" class="px-2.5 py-1 bg-primary text-white rounded text-xxs font-bold hover:bg-primary-600 transition flex items-center gap-1 cursor-pointer border-none" (click)="openSingleSubMatchScoreDialog(match, -1)">
                                                                        <i class="pi pi-pencil text-[9px]"></i> Ghi điểm
                                                                    </button>
                                                                    <ng-container *ngIf="currTournament.type === 'team'">
                                                                        <button class="px-2 py-0.5 border border-primary text-primary rounded text-[10px] font-bold hover:bg-primary/5 transition flex items-center gap-0.5" (click)="openLineupDialog(match, false)">
                                                                            Đội hình
                                                                        </button>
                                                                        <button *ngIf="match.lineup" class="px-2 py-0.5 bg-primary text-white rounded text-[10px] font-bold hover:bg-primary-600 transition flex items-center gap-0.5" (click)="openTeamDetails(match)">
                                                                            Xem tỷ số
                                                                        </button>
                                                                    </ng-container>
                                                                </div>
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
                                                                    <div class="flex flex-col items-center gap-1">
                                                                        <span class="px-1.5 py-0.2 bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 rounded font-extrabold text-[9px]">
                                                                            {{ getTeamSubMatchHandicapText(sub.handicapText) }}
                                                                        </span>
                                                                        <span class="text-[8px] px-1 bg-cyan-100 text-cyan-700 dark:bg-cyan-950/35 dark:text-cyan-300 rounded font-bold">
                                                                            {{ sub.matchType === 'double' ? 'Đôi' : 'Đơn' }}
                                                                        </span>
                                                                    </div>
                                                                </td>
                                                                <td class="py-1.5 px-4 text-center" *ngIf="currTournament.status === 'ongoing'">
                                                                    <button class="px-2 py-0.5 bg-primary text-white rounded text-[9px] font-bold hover:bg-primary-600 transition" 
                                                                            [disabled]="isSubMatchDisabled(match, subIdx, sub)"
                                                                            (click)="openSingleSubMatchScoreDialog(match, subIdx)">
                                                                        Ghi điểm
                                                                    </button>
                                                                </td>
                                                            </tr>
                                                        </ng-container>
                                                    </ng-container>
                                                </ng-container>
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                <!-- Dynamic standings -->
                                <div class="space-y-4">
                                    <h4 class="text-base font-bold flex items-center gap-2 m-0 text-slate-800 dark:text-slate-100">
                                        <i class="pi pi-table text-primary"></i> Bảng Điểm Live & Trạng Thái Suất Đi Tiếp
                                    </h4>
                                    <div *ngFor="let standing of currTournament.standings" class="mb-4">
                                        <h5 class="font-bold text-xs bg-slate-100 dark:bg-slate-800 p-2 rounded mb-2 flex items-center justify-between">
                                            <span>Bảng {{ standing.groupName }}</span>
                                            <span class="text-[10px] text-indigo-600 font-bold bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded">Vòng loại</span>
                                        </h5>
                                        <div class="overflow-auto border border-surface-200 rounded-lg shadow-sm">
                                            <table class="w-full border-collapse text-left text-xs">
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
                                    <p class="text-xs font-semibold text-surface-600 bg-primary-50 dark:bg-surface-850 p-3 rounded border-l-4 border-primary">
                                        Mô tả cơ chế: Kết thúc vòng bảng, 2 đội đứng đầu mỗi bảng (Bảng A, B) sẽ chính thức được **Đi Tiếp** vào vòng bán kết trực tiếp. Các đội xếp sau sẽ **Bị Loại**.
                                    </p>
                                </div>
                            </div>

                            <!-- Detail Tab Content: Knockout Stage -->
                            <div *ngIf="detailTab === 'knockout'" class="space-y-6">
                                <div class="flex items-center justify-between border-b border-surface-200 pb-2">
                                    <h4 class="text-base font-bold flex items-center gap-2 m-0 text-slate-800 dark:text-slate-100">
                                        <i class="pi pi-sitemap text-primary"></i> Sơ Đồ Nhánh Đấu Trực Tiếp (Knockout)
                                    </h4>
                                    <div class="flex items-center gap-2" *ngIf="currTournament.status === 'ongoing'">
                                        <button *ngIf="canGenerateFinal()" class="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-750 text-white rounded text-xs font-bold transition flex items-center gap-1.5" (click)="generateFinal()">
                                            <i class="pi pi-plus-circle"></i> Lập Trận Chung Kết
                                        </button>
                                    </div>
                                </div>

                                <!-- Bracket Columns Grid -->
                                <div class="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
                                    <!-- Column 1: Semifinals -->
                                    <div class="space-y-4">
                                        <div class="text-center font-bold text-xs uppercase tracking-wider text-slate-500 bg-slate-100 dark:bg-slate-800 py-1.5 rounded-lg">Vòng Bán Kết</div>
                                        
                                        <div *ngFor="let m of getKnockoutMatchesByRound('Semifinals')" class="p-4 border border-surface-200 dark:border-surface-800 bg-surface-50 dark:bg-surface-900/40 rounded-xl space-y-3 shadow-inner">
                                            <div class="text-xs text-primary font-bold">Mã trận: {{ m.id.toUpperCase() }}</div>
                                            <div class="space-y-2">
                                                <ng-container *ngIf="currTournament.type !== 'team'">
                                                    <div class="flex items-center justify-between text-sm">
                                                        <span class="text-xs font-semibold w-36 truncate flex items-center" [title]="competitorName(m.homeCompetitorId)" 
                                                              [class.text-green-600]="m.winnerId === m.homeCompetitorId" [class.font-bold]="m.winnerId === m.homeCompetitorId"
                                                              [class.text-slate-400]="m.winnerId && m.winnerId !== m.homeCompetitorId" [class.line-through]="m.winnerId && m.winnerId !== m.homeCompetitorId">
                                                            <i *ngIf="m.winnerId === m.homeCompetitorId" class="pi pi-check-circle text-green-600 mr-1"></i>
                                                            <i *ngIf="m.winnerId && m.winnerId !== m.homeCompetitorId" class="pi pi-times-circle text-slate-400 mr-1"></i>
                                                            <i *ngIf="!m.winnerId" class="pi pi-user text-slate-400 mr-1"></i>
                                                            {{ competitorName(m.homeCompetitorId) }}
                                                        </span>
                                                        <span class="font-bold bg-white dark:bg-slate-900 px-2 py-0.5 rounded text-xs">{{ m.homeScore || 0 }}</span>
                                                    </div>
                                                    <div class="flex items-center justify-between text-sm mt-1">
                                                        <span class="text-xs font-semibold w-36 truncate flex items-center" [title]="competitorName(m.awayCompetitorId)" 
                                                              [class.text-green-600]="m.winnerId === m.awayCompetitorId" [class.font-bold]="m.winnerId === m.awayCompetitorId"
                                                              [class.text-slate-400]="m.winnerId && m.winnerId !== m.awayCompetitorId" [class.line-through]="m.winnerId && m.winnerId !== m.awayCompetitorId">
                                                            <i *ngIf="m.winnerId === m.awayCompetitorId" class="pi pi-check-circle text-green-600 mr-1"></i>
                                                            <i *ngIf="m.winnerId && m.winnerId !== m.awayCompetitorId" class="pi pi-times-circle text-slate-400 mr-1"></i>
                                                            <i *ngIf="!m.winnerId" class="pi pi-user text-slate-400 mr-1"></i>
                                                            {{ competitorName(m.awayCompetitorId) }}
                                                        </span>
                                                        <span class="font-bold bg-white dark:bg-slate-900 px-2 py-0.5 rounded text-xs">{{ m.awayScore || 0 }}</span>
                                                    </div>
                                                    <div *ngIf="m.setScores && m.setScores.length > 0" class="text-[9px] text-slate-400 font-normal mt-1 text-center">
                                                        (<span *ngFor="let set of m.setScores; let last = last">{{ set.home }}-{{ set.away }}{{ last ? '' : ', ' }}</span>)
                                                    </div>
                                                </ng-container>

                                                <ng-container *ngIf="currTournament.type === 'team'">
                                                    <div class="flex items-center justify-between text-xs">
                                                        <span class="font-bold flex items-center" [class.text-green-600]="m.winnerId === m.homeCompetitorId">
                                                            <i *ngIf="m.winnerId === m.homeCompetitorId" class="pi pi-check mr-1 text-green-600"></i>{{ competitorName(m.homeCompetitorId) }}
                                                        </span>
                                                        <span class="px-2 py-0.5 bg-primary text-white rounded font-bold">{{ m.homeScore || 0 }}</span>
                                                    </div>
                                                    <div class="flex items-center justify-between text-xs mt-1">
                                                        <span class="font-bold flex items-center" [class.text-green-600]="m.winnerId === m.awayCompetitorId">
                                                            <i *ngIf="m.winnerId === m.awayCompetitorId" class="pi pi-check mr-1 text-green-600"></i>{{ competitorName(m.awayCompetitorId) }}
                                                        </span>
                                                        <span class="px-2 py-0.5 bg-primary text-white rounded font-bold">{{ m.awayScore || 0 }}</span>
                                                    </div>
                                                </ng-container>
                                            </div>
                                            <div class="flex justify-end pt-1 gap-1.5" *ngIf="currTournament.status === 'ongoing'">
                                                <button *ngIf="currTournament.type !== 'team'" class="px-2.5 py-1 bg-primary text-white rounded text-xxs font-bold hover:bg-primary-600 transition flex items-center gap-1 cursor-pointer border-none" (click)="openSingleSubMatchScoreDialog(m, -1)"><i class="pi pi-pencil text-[9px]"></i> Ghi điểm</button>
                                                
                                                <ng-container *ngIf="currTournament.type === 'team'">
                                                    <button class="px-2 py-1 border border-primary text-primary rounded text-xxs font-bold hover:bg-primary/5 transition flex items-center gap-0.5" (click)="openLineupDialog(m, true)">
                                                        Đội hình
                                                    </button>
                                                    <button *ngIf="m.lineup" class="px-2 py-1 bg-primary text-white rounded text-xxs font-bold hover:bg-primary-600 transition flex items-center gap-0.5" (click)="openTeamDetails(m)">
                                                        Xem tỷ số
                                                    </button>
                                                </ng-container>
                                            </div>
                                        </div>

                                        <div *ngIf="!getKnockoutMatchesByRound('Semifinals').length" class="py-12 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-slate-400 text-xs">
                                            Không có trận bán kết (Vào thẳng chung kết).
                                        </div>
                                    </div>

                                    <!-- Column 2: Finals -->
                                    <div class="space-y-4">
                                        <div class="text-center font-bold text-xs uppercase tracking-wider text-slate-500 bg-slate-100 dark:bg-slate-800 py-1.5 rounded-lg">Chung Kết & Tranh Giải Ba</div>
                                        
                                        <ng-container *ngIf="getFinalMatch(); else finalNotGenerated">
                                            <div class="p-4 border-2 border-indigo-200 dark:border-indigo-900 bg-indigo-50/10 rounded-xl space-y-3 shadow-md">
                                                <div class="text-xs text-indigo-600 dark:text-indigo-400 font-extrabold flex items-center gap-1"><i class="pi pi-star-fill"></i> TRANH CÚP VÔ ĐỊCH</div>
                                                <div class="space-y-2">
                                                    <ng-container *ngIf="currTournament.type !== 'team'">
                                                        <div class="flex items-center justify-between text-sm">
                                                            <span class="text-xs font-semibold w-36 truncate flex items-center" [title]="competitorName(getFinalMatch().homeCompetitorId)" 
                                                                  [class.text-green-600]="getFinalMatch().winnerId === getFinalMatch().homeCompetitorId" [class.font-bold]="getFinalMatch().winnerId === getFinalMatch().homeCompetitorId"
                                                                  [class.text-slate-400]="getFinalMatch().winnerId && getFinalMatch().winnerId !== getFinalMatch().homeCompetitorId" [class.line-through]="getFinalMatch().winnerId && getFinalMatch().winnerId !== getFinalMatch().homeCompetitorId">
                                                                <i *ngIf="getFinalMatch().winnerId === getFinalMatch().homeCompetitorId" class="pi pi-check-circle text-green-600 mr-1"></i>
                                                                <i *ngIf="getFinalMatch().winnerId && getFinalMatch().winnerId !== getFinalMatch().homeCompetitorId" class="pi pi-times-circle text-slate-400 mr-1"></i>
                                                                <i *ngIf="!getFinalMatch().winnerId" class="pi pi-user text-slate-400 mr-1"></i>
                                                                {{ competitorName(getFinalMatch().homeCompetitorId) }}
                                                            </span>
                                                            <span class="font-bold bg-white dark:bg-slate-900 px-2 py-0.5 rounded text-xs">{{ getFinalMatch().homeScore || 0 }}</span>
                                                        </div>
                                                        <div class="flex items-center justify-between text-sm mt-1">
                                                            <span class="text-xs font-semibold w-36 truncate flex items-center" [title]="competitorName(getFinalMatch().awayCompetitorId)" 
                                                                  [class.text-green-600]="getFinalMatch().winnerId === getFinalMatch().awayCompetitorId" [class.font-bold]="getFinalMatch().winnerId === getFinalMatch().awayCompetitorId"
                                                                  [class.text-slate-400]="getFinalMatch().winnerId && getFinalMatch().winnerId !== getFinalMatch().awayCompetitorId" [class.line-through]="getFinalMatch().winnerId && getFinalMatch().winnerId !== getFinalMatch().awayCompetitorId">
                                                                <i *ngIf="getFinalMatch().winnerId === getFinalMatch().awayCompetitorId" class="pi pi-check-circle text-green-600 mr-1"></i>
                                                                <i *ngIf="getFinalMatch().winnerId && getFinalMatch().winnerId !== getFinalMatch().awayCompetitorId" class="pi pi-times-circle text-slate-400 mr-1"></i>
                                                                <i *ngIf="!getFinalMatch().winnerId" class="pi pi-user text-slate-400 mr-1"></i>
                                                                {{ competitorName(getFinalMatch().awayCompetitorId) }}
                                                            </span>
                                                            <span class="font-bold bg-white dark:bg-slate-900 px-2 py-0.5 rounded text-xs">{{ getFinalMatch().awayScore || 0 }}</span>
                                                        </div>
                                                        <div *ngIf="getFinalMatch().setScores && getFinalMatch().setScores.length > 0" class="text-[9px] text-slate-400 font-normal mt-1 text-center">
                                                            (<span *ngFor="let set of getFinalMatch().setScores; let last = last">{{ set.home }}-{{ set.away }}{{ last ? '' : ', ' }}</span>)
                                                        </div>
                                                    </ng-container>

                                                    <ng-container *ngIf="currTournament.type === 'team'">
                                                        <div class="flex items-center justify-between text-xs">
                                                            <span class="font-bold flex items-center" [class.text-green-600]="getFinalMatch().winnerId === getFinalMatch().homeCompetitorId">
                                                                <i *ngIf="getFinalMatch().winnerId === getFinalMatch().homeCompetitorId" class="pi pi-check mr-1 text-green-600"></i>{{ competitorName(getFinalMatch().homeCompetitorId) }}
                                                            </span>
                                                            <span class="px-2 py-0.5 bg-primary text-white rounded font-bold">{{ getFinalMatch().homeScore || 0 }}</span>
                                                        </div>
                                                        <div class="flex items-center justify-between text-xs mt-1">
                                                            <span class="font-bold flex items-center" [class.text-green-600]="getFinalMatch().winnerId === getFinalMatch().awayCompetitorId">
                                                                <i *ngIf="getFinalMatch().winnerId === getFinalMatch().awayCompetitorId" class="pi pi-check mr-1 text-green-600"></i>{{ competitorName(getFinalMatch().awayCompetitorId) }}
                                                            </span>
                                                            <span class="px-2 py-0.5 bg-primary text-white rounded font-bold">{{ getFinalMatch().awayScore || 0 }}</span>
                                                        </div>
                                                    </ng-container>
                                                </div>
                                                <div class="flex justify-end pt-1 gap-1.5" *ngIf="currTournament.status === 'ongoing'">
                                                    <button *ngIf="currTournament.type !== 'team'" class="px-2.5 py-1 bg-primary text-white rounded text-xxs font-bold hover:bg-primary-600 transition flex items-center gap-1 cursor-pointer border-none" (click)="openSingleSubMatchScoreDialog(getFinalMatch(), -1)"><i class="pi pi-pencil text-[9px]"></i> Ghi điểm</button>
                                                    
                                                    <ng-container *ngIf="currTournament.type === 'team'">
                                                        <button class="px-2 py-1 border border-primary text-primary rounded text-xxs font-bold hover:bg-primary/5 transition flex items-center gap-0.5" (click)="openLineupDialog(getFinalMatch(), true)">
                                                            Đội hình
                                                        </button>
                                                        <button class="px-2 py-1 bg-primary text-white rounded text-xxs font-bold hover:bg-primary-600 transition flex items-center gap-0.5" *ngIf="getFinalMatch().lineup" (click)="openTeamDetails(getFinalMatch())">
                                                            Xem tỷ số
                                                        </button>
                                                    </ng-container>
                                                </div>
                                            </div>

                                            <!-- 3rd Place Match Card -->
                                            <div *ngIf="getBronzeMatch() as bm" class="p-4 border border-surface-200 dark:border-surface-800 bg-surface-50 dark:bg-surface-900/20 rounded-xl space-y-3 shadow-inner mt-4">
                                                <div class="text-xs text-amber-600 dark:text-amber-400 font-extrabold flex items-center gap-1"><i class="pi pi-star-fill"></i> TRANH GIẢI BA</div>
                                                <div class="space-y-2">
                                                    <ng-container *ngIf="currTournament.type !== 'team'">
                                                        <div class="flex items-center justify-between text-sm">
                                                            <span class="text-xs font-semibold w-36 truncate flex items-center" [title]="competitorName(bm.homeCompetitorId)" 
                                                                  [class.text-green-600]="bm.winnerId === bm.homeCompetitorId" [class.font-bold]="bm.winnerId === bm.homeCompetitorId"
                                                                  [class.text-slate-400]="bm.winnerId && bm.winnerId !== bm.homeCompetitorId" [class.line-through]="bm.winnerId && bm.winnerId !== bm.homeCompetitorId">
                                                                <i *ngIf="bm.winnerId === bm.homeCompetitorId" class="pi pi-check-circle text-green-600 mr-1"></i>
                                                                <i *ngIf="bm.winnerId && bm.winnerId !== bm.homeCompetitorId" class="pi pi-times-circle text-slate-400 mr-1"></i>
                                                                <i *ngIf="!bm.winnerId" class="pi pi-user text-slate-400 mr-1"></i>
                                                                {{ competitorName(bm.homeCompetitorId) }}
                                                            </span>
                                                            <span class="font-bold bg-white dark:bg-slate-900 px-2 py-0.5 rounded text-xs">{{ bm.homeScore || 0 }}</span>
                                                        </div>
                                                        <div class="flex items-center justify-between text-sm mt-1">
                                                            <span class="text-xs font-semibold w-36 truncate flex items-center" [title]="competitorName(bm.awayCompetitorId)" 
                                                                  [class.text-green-600]="bm.winnerId === bm.awayCompetitorId" [class.font-bold]="bm.winnerId === bm.awayCompetitorId"
                                                                  [class.text-slate-400]="bm.winnerId && bm.winnerId !== bm.awayCompetitorId" [class.line-through]="bm.winnerId && bm.winnerId !== bm.awayCompetitorId">
                                                                <i *ngIf="bm.winnerId === bm.awayCompetitorId" class="pi pi-check-circle text-green-600 mr-1"></i>
                                                                <i *ngIf="bm.winnerId && bm.winnerId !== bm.awayCompetitorId" class="pi pi-times-circle text-slate-400 mr-1"></i>
                                                                <i *ngIf="!bm.winnerId" class="pi pi-user text-slate-400 mr-1"></i>
                                                                {{ competitorName(bm.awayCompetitorId) }}
                                                            </span>
                                                            <span class="font-bold bg-white dark:bg-slate-900 px-2 py-0.5 rounded text-xs">{{ bm.awayScore || 0 }}</span>
                                                        </div>
                                                        <!-- Show brief set points if any -->
                                                        <div *ngIf="bm.setScores && bm.setScores.length > 0" class="text-[9px] text-slate-400 font-normal mt-1 text-center">
                                                            (<span *ngFor="let set of bm.setScores; let last = last">{{ set.home }}-{{ set.away }}{{ last ? '' : ', ' }}</span>)
                                                        </div>
                                                    </ng-container>

                                                    <ng-container *ngIf="currTournament.type === 'team'">
                                                        <div class="flex items-center justify-between text-xs">
                                                            <span class="font-bold flex items-center" [class.text-green-600]="bm.winnerId === bm.homeCompetitorId">
                                                                <i *ngIf="bm.winnerId === bm.homeCompetitorId" class="pi pi-check mr-1 text-green-600"></i>{{ competitorName(bm.homeCompetitorId) }}
                                                            </span>
                                                            <span class="px-2 py-0.5 bg-primary text-white rounded font-bold">{{ bm.homeScore || 0 }}</span>
                                                        </div>
                                                        <div class="flex items-center justify-between text-xs mt-1">
                                                            <span class="font-bold flex items-center" [class.text-green-600]="bm.winnerId === bm.awayCompetitorId">
                                                                <i *ngIf="bm.winnerId === bm.awayCompetitorId" class="pi pi-check mr-1 text-green-600"></i>{{ competitorName(bm.awayCompetitorId) }}
                                                            </span>
                                                            <span class="px-2 py-0.5 bg-primary text-white rounded font-bold">{{ bm.awayScore || 0 }}</span>
                                                        </div>
                                                    </ng-container>
                                                </div>
                                                <div class="flex justify-end pt-1 gap-1.5" *ngIf="currTournament.status === 'ongoing'">
                                                    <button *ngIf="currTournament.type !== 'team'" class="px-2.5 py-1 bg-primary text-white rounded text-xxs font-bold hover:bg-primary-600 transition flex items-center gap-1 cursor-pointer border-none" (click)="openSingleSubMatchScoreDialog(bm, -1)"><i class="pi pi-pencil text-[9px]"></i> Ghi điểm</button>
                                                    
                                                    <ng-container *ngIf="currTournament.type === 'team'">
                                                        <button class="px-2 py-1 border border-primary text-primary rounded text-xxs font-bold hover:bg-primary/5 transition flex items-center gap-0.5" (click)="openLineupDialog(bm, true)">
                                                            Đội hình
                                                        </button>
                                                        <button class="px-2 py-1 bg-primary text-white rounded text-xxs font-bold hover:bg-primary-600 transition flex items-center gap-0.5" *ngIf="bm.lineup" (click)="openTeamDetails(bm)">
                                                            Xem tỷ số
                                                        </button>
                                                    </ng-container>
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

                <!-- CREATE / EDIT DIALOG POPUP (PRIME NG p-dialog emulation) -->
                <p-dialog [header]="tournamentDialogMode === 'create' ? 'Khởi Tạo Giải Đấu Mới' : 'Chỉnh Sửa Giải Đấu'" [(visible)]="showCreateTournamentDialog" [modal]="true" [style]="{ width: '480px' }" [draggable]="false" [resizable]="false">
                    <div class="space-y-4 pt-3">
                        <div class="flex flex-col gap-1.5">
                            <label class="block text-sm font-bold text-slate-700 dark:text-slate-200">Tên giải đấu</label>
                            <input class="w-full" pInputText type="text" [(ngModel)]="tournamentForm.name" placeholder="e.g. Giải Mùa Hè EVNICT 2026" />
                        </div>
                        <div class="grid grid-cols-2 gap-4">
                            <div class="flex flex-col gap-1.5">
                                <label class="block text-sm font-bold text-slate-700 dark:text-slate-200">Thể thức</label>
                                <p-select [options]="typeOptions" [(ngModel)]="tournamentForm.type" optionLabel="label" optionValue="value" placeholder="Chọn thể thức" class="w-full"></p-select>
                            </div>
                            <div class="flex flex-col gap-1.5">
                                <label class="block text-sm font-bold text-slate-700 dark:text-slate-200">Địa điểm tổ chức</label>
                                <input class="w-full" pInputText type="text" [(ngModel)]="tournamentForm.location" placeholder="e.g. Nhà thi đấu EVN" />
                            </div>
                        </div>
                        <div class="grid grid-cols-2 gap-4">
                            <div class="flex flex-col gap-1.5">
                                <label class="block text-sm font-bold text-slate-700 dark:text-slate-200">Ngày bắt đầu</label>
                                <p-datepicker [(ngModel)]="tournamentForm.startedAt" [showIcon]="true" placeholder="Chọn ngày bắt đầu" dateFormat="yy-mm-dd" class="w-full"></p-datepicker>
                            </div>
                            <div class="flex flex-col gap-1.5">
                                <label class="block text-sm font-bold text-slate-700 dark:text-slate-200">Ngày kết thúc</label>
                                <p-datepicker [(ngModel)]="tournamentForm.finishedAt" [showIcon]="true" placeholder="Chọn ngày kết thúc" dateFormat="yy-mm-dd" class="w-full"></p-datepicker>
                            </div>
                        </div>
                        <div class="space-y-1.5">
                            <label class="block text-sm font-bold text-slate-700 dark:text-slate-200">Cơ cấu giải thưởng</label>
                            
                            <!-- Input new prize -->
                            <div class="grid grid-cols-12 gap-2 items-center">
                                <div class="col-span-6">
                                    <input class="w-full" pInputText type="text" [(ngModel)]="newPrizeTitle" placeholder="Tên giải (e.g. Giải Nhất)" />
                                </div>
                                <div class="col-span-4">
                                    <p-inputnumber [(ngModel)]="newPrizeAmount" placeholder="Số tiền (VNĐ)" class="w-full" mode="decimal"></p-inputnumber>
                                </div>
                                <div class="col-span-2">
                                    <p-button label="Thêm" icon="pi pi-plus" severity="primary" (onClick)="addPrizeToForm()" class="w-full"></p-button>
                                </div>
                            </div>

                            <!-- List of added prizes -->
                            <div class="space-y-1.5 max-h-36 overflow-y-auto mt-2" *ngIf="tournamentForm.prizes && tournamentForm.prizes.length > 0">
                                <div *ngFor="let p of tournamentForm.prizes; let i = index" class="flex justify-between items-center text-xs bg-slate-50 dark:bg-slate-900/60 p-2 rounded-lg border border-slate-100 dark:border-slate-800">
                                    <span class="font-semibold text-slate-850 dark:text-slate-150">{{ p.title }}</span>
                                    <div class="flex items-center gap-2">
                                        <span class="font-bold text-amber-600 dark:text-amber-400">{{ p.amount | number:'1.0-0' }}đ</span>
                                        <button class="p-1 hover:bg-red-50 text-red-650 dark:hover:bg-red-950/40 rounded transition border-none cursor-pointer flex items-center justify-center bg-transparent" type="button" (click)="removePrizeFromForm(i)">
                                            <i class="pi pi-trash text-[10px]"></i>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div class="flex justify-end gap-2 pt-4 border-t">
                            <p-button label="Hủy" severity="secondary" [outlined]="true" (onClick)="showCreateTournamentDialog = false"></p-button>
                            <p-button label="Lưu giải đấu" severity="primary" [disabled]="!tournamentForm.name" (onClick)="saveTournament()"></p-button>
                        </div>
                    </div>
                </p-dialog>
            </div>




        </div>

        <!-- Dialog Override rank/Elo -->
        <p-dialog [(visible)]="showOverrideDialog" header="Ghi đè thông số thành viên (Bắt buộc nhập lý do)" [modal]="true" [style]="{ width: '450px' }">
            <div class="space-y-4 pt-3">
                <div class="bg-surface-100 p-3 rounded-lg text-sm mb-2">
                    <strong>Thành viên:</strong> {{ selectedMember?.fullName }} <br />
                    <strong>Thông số hiện tại:</strong> {{ selectedMember?.elo }} Elo | Rank {{ selectedMember?.rankTier }}
                </div>
                
                <div class="grid grid-cols-2 gap-4">
                    <div class="flex flex-col gap-1">
                        <label class="block text-xs font-semibold">Điểm Elo Mới</label>
                        <p-inputnumber [(ngModel)]="overrideForm.elo" class="w-full" mode="decimal"></p-inputnumber>
                    </div>
                    <div class="flex flex-col gap-1">
                        <label class="block text-xs font-semibold">Hạng Rank Mới</label>
                        <p-select [options]="rankTiers" [(ngModel)]="overrideForm.rank" class="w-full"></p-select>
                    </div>
                </div>

                <div class="flex flex-col gap-1">
                    <label class="block text-xs font-semibold">Lý do điều chỉnh (Bắt buộc - ghi vào Audit log)</label>
                    <textarea class="p-inputtext w-full" rows="3" [(ngModel)]="overrideForm.reason" placeholder="e.g. Điểm số sai lệch do lỗi trọng tài nhập hoặc cập nhật thành tích giải đấu ngoài..."></textarea>
                </div>

                <div class="flex justify-end gap-2 pt-2 border-t">
                    <p-button label="Hủy Bỏ" severity="secondary" [outlined]="true" (onClick)="showOverrideDialog = false" />
                    <p-button label="Xác Nhận Thay Đổi" (onClick)="saveOverride()" [disabled]="!overrideForm.reason" />
                </div>
            </div>
        </p-dialog>

        <!-- Dialog Đăng Ký Đội Hình Đồng Đội ABC-XYZ -->
        <p-dialog [(visible)]="showLineupDialog" header="Đăng Ký Đội Hình Đồng Đội ABC-XYZ" [modal]="true" [style]="{ width: '600px' }" [draggable]="false" [resizable]="false">
            <div class="space-y-4 pt-3 text-xs" *ngIf="currTournament">
                <div class="p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-100 rounded-lg text-[11px] leading-relaxed">
                    <span class="font-bold text-blue-800 dark:text-blue-400 block mb-1"><i class="pi pi-info-circle"></i> Nguyên tắc đăng ký:</span>
                    Chọn 3 VĐV chính thức từ mỗi đội đại diện cho các vị trí chiến thuật. Các vị trí sẽ đối đầu tương ứng trong 5 trận đấu nhỏ (Trận 1: Đôi BC vs YZ, Trận 2: Đơn A vs X, Trận 3: Đơn C vs Z, Trận 4: Đơn A vs Y, Trận 5: Đơn B vs X).
                </div>

                <!-- Bốc thăm kết quả -->
                <div class="p-3 bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center justify-between">
                    <span class="font-bold text-slate-700 dark:text-slate-200">Bốc thăm nhóm thi đấu:</span>
                    <div class="flex gap-2">
                        <button type="button" class="px-3 py-1.5 text-xs font-bold rounded border transition-all"
                                [class.bg-indigo-600]="lineupForm.isHomeABC === true"
                                [class.text-white]="lineupForm.isHomeABC === true"
                                [class.bg-white]="lineupForm.isHomeABC === false"
                                [class.text-slate-700]="lineupForm.isHomeABC === false"
                                (click)="lineupForm.isHomeABC = true">
                            Đội nhà ABC | Đội khách XYZ
                        </button>
                        <button type="button" class="px-3 py-1.5 text-xs font-bold rounded border transition-all"
                                [class.bg-indigo-600]="lineupForm.isHomeABC === false"
                                [class.text-white]="lineupForm.isHomeABC === false"
                                [class.bg-white]="lineupForm.isHomeABC === true"
                                [class.text-slate-700]="lineupForm.isHomeABC === true"
                                (click)="lineupForm.isHomeABC = false">
                            Đội nhà XYZ | Đội khách ABC
                        </button>
                    </div>
                </div>

                <div class="grid grid-cols-2 gap-6">
                    <!-- Home Team (ABC) -->
                    <div class="p-3 border rounded-lg bg-surface-50 dark:bg-surface-900/20">
                        <div class="font-bold text-primary mb-3 flex items-center gap-1">
                            <i class="pi pi-home"></i> ĐỘI ABC ({{ lineupForm.isHomeABC ? 'Đội nhà' : 'Đội khách' }})
                        </div>
                        <div class="space-y-3">
                            <div class="flex flex-col gap-1">
                                <label class="block font-bold">Vị trí A (Đơn)</label>
                                <p-select [options]="abcPlayers" [(ngModel)]="lineupForm.aPlayerId" optionLabel="name" optionValue="id" placeholder="Chọn VĐV A" class="w-full"></p-select>
                            </div>
                            <div class="flex flex-col gap-1">
                                <label class="block font-bold">Vị trí B (Đôi, Đơn)</label>
                                <p-select [options]="abcPlayers" [(ngModel)]="lineupForm.bPlayerId" optionLabel="name" optionValue="id" placeholder="Chọn VĐV B" class="w-full"></p-select>
                            </div>
                            <div class="flex flex-col gap-1">
                                <label class="block font-bold">Vị trí C (Đôi, Đơn)</label>
                                <p-select [options]="abcPlayers" [(ngModel)]="lineupForm.cPlayerId" optionLabel="name" optionValue="id" placeholder="Chọn VĐV C" class="w-full"></p-select>
                            </div>
                        </div>
                    </div>

                    <!-- Away Team (XYZ) -->
                    <div class="p-3 border rounded-lg bg-surface-50 dark:bg-surface-900/20">
                        <div class="font-bold text-primary mb-3 flex items-center gap-1">
                            <i class="pi pi-directions"></i> ĐỘI XYZ ({{ lineupForm.isHomeABC ? 'Đội khách' : 'Đội nhà' }})
                        </div>
                        <div class="space-y-3">
                            <div class="flex flex-col gap-1">
                                <label class="block font-bold">Vị trí X (Đơn)</label>
                                <p-select [options]="xyzPlayers" [(ngModel)]="lineupForm.xPlayerId" optionLabel="name" optionValue="id" placeholder="Chọn VĐV X" class="w-full"></p-select>
                            </div>
                            <div class="flex flex-col gap-1">
                                <label class="block font-bold">Vị trí Y (Đôi, Đơn)</label>
                                <p-select [options]="xyzPlayers" [(ngModel)]="lineupForm.yPlayerId" optionLabel="name" optionValue="id" placeholder="Chọn VĐV Y" class="w-full"></p-select>
                            </div>
                            <div class="flex flex-col gap-1">
                                <label class="block font-bold">Vị trí Z (Đôi, Đơn)</label>
                                <p-select [options]="xyzPlayers" [(ngModel)]="lineupForm.zPlayerId" optionLabel="name" optionValue="id" placeholder="Chọn VĐV Z" class="w-full"></p-select>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="flex justify-end gap-2 pt-3 border-t">
                    <p-button label="Hủy" severity="secondary" [outlined]="true" (onClick)="showLineupDialog = false" />
                    <div class="mr-auto self-center text-[11px] text-red-600 font-semibold" *ngIf="lineupValidationMessage">
                        {{ lineupValidationMessage }}
                    </div>
                    <p-button label="Lưu Đội Hình" severity="primary" (onClick)="saveLineup()" 
                              [disabled]="!isLineupFormValid()" />
                </div>
            </div>
        </p-dialog>

        <!-- Dialog Nhập Tỉ Số Trận Đấu Con ABC-XYZ (Single Match Editor) -->
        <p-dialog [(visible)]="showSubScoresDialog" [header]="selectedSubMatchIdx >= 0 ? 'Nhập Kết Quả Trận Đấu Con' : 'Nhập Kết Quả Trận Đấu'" [modal]="true" [style]="{ width: '480px' }" [draggable]="false" [resizable]="false">
            <div class="space-y-4 pt-3 text-xs" *ngIf="selectedSubScoresMatch && currTournament">
                <div class="flex items-center justify-between p-3 bg-surface-100 dark:bg-surface-900 border rounded-lg">
                    <div class="font-black text-slate-800 dark:text-slate-100">
                        {{ competitorName(selectedSubScoresMatch.homeCompetitorId) }} vs {{ competitorName(selectedSubScoresMatch.awayCompetitorId) }}
                    </div>
                    <div class="flex items-center gap-2 font-black text-sm">
                        Tỷ số tổng hiện tại: 
                        <span class="px-2 py-0.5 bg-primary text-white rounded">{{ selectedSubScoresMatch.homeScore || 0 }}</span>
                        -
                        <span class="px-2 py-0.5 bg-primary text-white rounded">{{ selectedSubScoresMatch.awayScore || 0 }}</span>
                    </div>
                </div>

                <div class="p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-100 rounded-lg text-[10px]">
                    <span class="font-bold text-blue-800 dark:text-blue-400 block mb-0.5"><i class="pi pi-exclamation-triangle"></i> Quy định ITTF:</span>
                    * Đấu vòng bảng: đánh 3 séc thắng 2 (Best of 3). Vòng knockout: đánh 5 séc thắng 3 (Best of 5).
                    <br/>* Điểm thắng mỗi séc: tối thiểu 11 điểm và cách biệt ít nhất 2 điểm.
                </div>

                <div class="p-3 border rounded-xl bg-surface-50 dark:bg-surface-800/40 space-y-3">
                    <div class="flex justify-between items-start">
                        <span class="font-bold text-primary text-sm">
                            {{ selectedSubMatchIdx >= 0 ? selectedSubScoresMatch?.subMatches?.[selectedSubMatchIdx]?.label : (isSubScoresMatchKnockout ? 'Trận loại trực tiếp (Best of 5)' : 'Trận vòng bảng (Best of 3)') }}
                        </span>
                        <span class="px-2 py-0.5 bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 rounded font-bold text-[10px]" *ngIf="selectedSubMatchIdx >= 0 && selectedSubScoresMatch?.subMatches?.[selectedSubMatchIdx]?.handicapText">
                            {{ getTeamSubMatchHandicapText(selectedSubScoresMatch?.subMatches?.[selectedSubMatchIdx]?.handicapText) }}
                        </span>
                    </div>

                    <div class="flex flex-col gap-3 pt-2 border-t border-dashed border-slate-200 dark:border-slate-700">
                        <!-- Stack sets vertically -->
                        <div class="space-y-2.5">
                            <div *ngFor="let set of tempSubMatchSetScores; let setIdx = index" class="flex items-center gap-3">
                                <span class="font-extrabold text-slate-555 text-xs w-16 uppercase">Séc {{ setIdx + 1 }}:</span>
                                <input type="number" min="0" class="w-12 p-1.5 text-center border rounded bg-surface-0 dark:bg-surface-900 font-bold text-xs" 
                                       placeholder="H" [(ngModel)]="set.home" (ngModelChange)="autoComputeSingleSubMatch()" [disabled]="isSetDisabled(setIdx)" />
                                <span class="text-slate-400 font-bold">-</span>
                                <input type="number" min="0" class="w-12 p-1.5 text-center border rounded bg-surface-0 dark:bg-surface-900 font-bold text-xs" 
                                       placeholder="A" [(ngModel)]="set.away" (ngModelChange)="autoComputeSingleSubMatch()" [disabled]="isSetDisabled(setIdx)" />
                                
                                <!-- Checkmark or Warning helper -->
                                <span class="flex items-center gap-1.5 text-[10px] font-semibold">
                                    <ng-container *ngIf="set.home !== null && set.away !== null">
                                        <span *ngIf="isSetScoreValid(set.home, set.away).valid" class="text-green-600 flex items-center gap-0.5">
                                            <i class="pi pi-check-circle text-xs"></i> Hợp lệ
                                        </span>
                                        <span *ngIf="!isSetScoreValid(set.home, set.away).valid" class="text-red-500 flex items-center gap-0.5" [title]="isSetScoreValid(set.home, set.away).error">
                                            <i class="pi pi-exclamation-circle text-xs"></i> {{ isSetScoreValid(set.home, set.away).error }}
                                        </span>
                                    </ng-container>
                                    <ng-container *ngIf="isSetDisabled(setIdx)">
                                        <span class="text-slate-400 font-normal italic">(Đã đủ séc thắng)</span>
                                    </ng-container>
                                </span>
                            </div>
                        </div>
                        
                        <!-- High contrast calculated win count display and save button -->
                        <div class="flex items-center justify-between gap-4 mt-2 bg-indigo-50/50 dark:bg-indigo-950/10 p-3 rounded-lg border border-indigo-100">
                            <div class="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                                Tỷ số séc tính toán: 
                                <span class="px-2.5 py-0.5 bg-indigo-100 text-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300 rounded font-extrabold ml-1.5 text-xs">
                                    {{ tempSubMatchHomeWins }} - {{ tempSubMatchAwayWins }}
                                </span>
                            </div>
                            <div class="flex items-center gap-2">
                                <button *ngIf="isMatchOrSubMatchCompleted()" class="px-3 py-1.5 bg-red-650 hover:bg-red-750 text-white rounded font-bold transition flex items-center gap-1 text-xs border-none cursor-pointer" (click)="deleteMatchScore()">
                                    <i class="pi pi-trash text-[10px]"></i> Xóa kết quả
                                </button>
                                <button class="px-4 py-1.5 bg-green-600 text-white rounded hover:bg-green-700 font-extrabold transition flex items-center gap-1.5 text-xs border-none cursor-pointer" 
                                        [disabled]="!isSubMatchScoreValid()" (click)="saveSingleSubMatchScore()">
                                    <i class="pi pi-check text-[10px]"></i> Lưu kết quả
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </p-dialog>

        <!-- Dialog Xem Chi Tiết Đồng Đội ABC-XYZ (Read Only for Admin) -->
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
                    <div *ngFor="let sub of selectedTeamMatch.subMatches; let subIdx = index" class="p-3 border rounded-xl bg-surface-50 dark:bg-surface-800/40 space-y-2">
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
                            <div class="flex items-center gap-2">
                                <span class="text-green-600 font-bold" *ngIf="sub.completed && sub.homeScore > sub.awayScore"><i class="pi pi-check"></i> {{ competitorName(selectedTeamMatch.homeCompetitorId) }} thắng</span>
                                <span class="text-green-600 font-bold" *ngIf="sub.completed && sub.awayScore > sub.homeScore"><i class="pi pi-check"></i> {{ competitorName(selectedTeamMatch.awayCompetitorId) }} thắng</span>
                                <span class="text-slate-400 font-semibold" *ngIf="!sub.completed">Chưa đấu</span>
                                <button *ngIf="currTournament.status === 'ongoing'" 
                                        class="px-2.5 py-0.5 bg-primary text-white rounded text-[10px] font-bold hover:bg-primary-600 transition ml-2 flex items-center gap-0.5" 
                                        [disabled]="isSubMatchDisabled(selectedTeamMatch, subIdx, sub)"
                                        (click)="openSingleSubMatchScoreDialog(selectedTeamMatch, subIdx)">
                                    <i class="pi pi-pencil text-[8px]"></i> Ghi điểm
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="flex justify-end pt-3 border-t">
                    <p-button label="Đóng" severity="secondary" [outlined]="true" (onClick)="showTeamDetailsDialog = false" />
                </div>
            </div>
        </p-dialog>

        <p-dialog [(visible)]="showMessageDialog" [header]="messageDialogTitle" [modal]="true" [style]="{ width: '440px' }" [draggable]="false" [resizable]="false" [appendTo]="'body'">
            <div class="pt-2 text-sm text-slate-700 dark:text-slate-200 whitespace-pre-line">
                {{ messageDialogText }}
            </div>
            <div class="flex justify-end pt-4 border-t mt-4">
                <p-button label="Đã hiểu" severity="primary" (onClick)="showMessageDialog = false"></p-button>
            </div>
        </p-dialog>

        <p-dialog [(visible)]="showConfirmDialog" [header]="confirmDialogTitle" [modal]="true" [style]="{ width: '480px' }" [draggable]="false" [resizable]="false" [appendTo]="'body'">
            <div class="pt-2 text-sm text-slate-700 dark:text-slate-200 whitespace-pre-line">
                {{ confirmDialogText }}
            </div>
            <div class="flex justify-end gap-2 pt-4 border-t mt-4">
                <p-button label="Hủy" severity="secondary" [outlined]="true" (onClick)="cancelConfirmAction()"></p-button>
                <p-button label="Xác nhận" severity="primary" (onClick)="acceptConfirmAction()"></p-button>
            </div>
        </p-dialog>

        <!-- Seed Edit Dialog -->
        <p-dialog [(visible)]="showSeedEditDialog" header="Chỉnh sửa Hạt Giống VĐV" [modal]="true" [style]="{ width: '450px' }" [draggable]="false" [resizable]="false" [appendTo]="'body'">
            <div class="space-y-4 pt-2 text-xs" *ngIf="selectedRegistration">
                <div class="flex items-center gap-2">
                    <span class="font-bold text-slate-500">Vận động viên:</span>
                    <span class="font-bold text-slate-800 dark:text-slate-100 text-sm">{{ memberName(selectedRegistration.memberId) }}</span>
                </div>
                <div class="space-y-1">
                    <label class="block font-bold text-slate-500">Hạt giống mới (Số nguyên dương):</label>
                    <input type="number" class="w-full p-2 border rounded" [(ngModel)]="seedEditForm.newSeed" (ngModelChange)="onSeedChange()" min="1" placeholder="Nhập số hạt giống..." />
                </div>
                <div class="space-y-1">
                    <label class="block font-bold text-slate-500">Lý do điều chỉnh (Bắt buộc):</label>
                    <textarea rows="3" class="w-full p-2 border rounded resize-none" [(ngModel)]="seedEditForm.reason" placeholder="Nhập lý do điều chỉnh hạt giống..."></textarea>
                </div>
                
                <!-- Seed reshuffle preview list -->
                <div class="mt-3 p-3 bg-amber-50 dark:bg-slate-800 rounded border border-amber-200 dark:border-amber-900 text-[11px] space-y-1.5" *ngIf="impactedTeams && impactedTeams.length > 0">
                    <div class="font-bold text-amber-800 dark:text-amber-400 flex items-center gap-1">
                        <i class="pi pi-exclamation-triangle"></i> Xem trước ảnh hưởng chia đội (Reshuffle Preview):
                    </div>
                    <div class="space-y-1 text-slate-700 dark:text-slate-350">
                        <div *ngFor="let imp of impactedTeams">
                            <strong>{{ imp.teamName }}:</strong>
                            <span class="line-through text-slate-400 mr-1">{{ imp.oldPlayers.join(', ') }}</span>
                            &rarr;
                            <span class="text-green-700 dark:text-green-400 font-semibold ml-1">{{ imp.newPlayers.join(', ') }}</span>
                        </div>
                    </div>
                </div>

                <div class="flex justify-end gap-2 pt-4 border-t">
                    <p-button label="Hủy" severity="secondary" [outlined]="true" (onClick)="showSeedEditDialog = false" />
                    <p-button label="Xác nhận" severity="primary" [disabled]="!seedEditForm.reason || seedEditForm.newSeed <= 0" (onClick)="saveSeedOverride()" />
                </div>
            </div>
        </p-dialog>

        <!-- Import Registrations Dialog -->
        <p-dialog [(visible)]="showImportDialog" header="Import Đăng Ký từ JSON" [modal]="true" [style]="{ width: '450px' }" [draggable]="false" [resizable]="false" [appendTo]="'body'">
            <div class="space-y-4 pt-2 text-xs">
                <p class="text-[11px] text-slate-500 m-0 leading-relaxed">Dán danh sách đăng ký dạng mảng JSON. Ví dụ:<br/><code class="bg-slate-100 dark:bg-slate-800 p-1 rounded font-mono block mt-1">[ {{ '{' }} "memberId": "u01", "seed": 1 {{ '}' }} ]</code></p>
                <textarea rows="8" class="w-full text-xs font-mono p-2 border rounded resize-y" [(ngModel)]="importJsonInput" [placeholder]="importJsonPlaceholder"></textarea>
                <div class="flex justify-end gap-2 pt-4 border-t">
                    <p-button label="Hủy" severity="secondary" [outlined]="true" (onClick)="showImportDialog = false" />
                    <p-button label="Import" severity="primary" [disabled]="!importJsonInput" (onClick)="executeImportRegistrations()" />
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
            border-color: rgba(56, 189, 248, 0.48) !important;
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
            background: rgba(14, 165, 233, 0.08) !important;
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
            background: rgba(14, 165, 233, 0.12) !important;
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
export class AdminPortal implements OnInit {
    activeTab = 'members';
    tabs = [
        { id: 'members', label: 'Thành Viên', icon: 'pi pi-users' },
        { id: 'matches', label: 'Kết Quả & Tranh Chấp', icon: 'pi pi-check-circle' },
        { id: 'tournaments', label: 'Giải Đấu Engine', icon: 'pi pi-sitemap' }
    ];

    memberFilter = 'all';
    memberNameSearch = '';
    memberDepartmentSearch = '';
    adminUserId = 'u01';

    members: Member[] = [];
    activeMembers: Member[] = [];
    recentMatches: MatchRecord[] = [];
    disputedMatches: MatchRecord[] = [];
    auditLogs: AuditLog[] = [];

    // Counts for badges
    pendingApprovalsCount = 0;
    disputedMatchesCount = 0;
    allMembersCount = 0;

    // Direct recording Match
    newMatch = {
        homePlayerId: '',
        awayPlayerId: '',
        homeScore: 3,
        awayScore: 1,
        notes: ''
    };
    matchRecordMessage = 'Admin và Trọng tài được phép nhập trực tiếp kết quả đã đấu.';

    // Walkover form
    walkover = {
        homeId: '',
        awayId: '',
        winnerId: '',
        reason: ''
    };
    walkoverMessage = 'Ghi nhận tỷ số 3-0 không đổi Elo khi có người chơi bỏ cuộc.';

    // Resolve dispute form
    disputedForm = {
        homeScore: 3,
        awayScore: 2,
        reason: ''
    };

    // Override dialog
    showOverrideDialog = false;
    selectedMember: Member | null = null;
    overrideForm = {
        elo: 1200,
        rank: 'A5' as RankTier,
        reason: ''
    };
    rankTiers: RankTier[] = ['A0', 'A1', 'A2', 'A3', 'A4', 'A5', 'A6'];

    // Tournaments engine
    allTournaments: Tournament[] = [];
    selectedTournamentId = '';
    private _currTournament: Tournament | null = null;
    get currTournament(): Tournament | null {
        return this._currTournament;
    }
    set currTournament(val: Tournament | null) {
        this._currTournament = val;
        this.updateSortedRegistrations();
    }

    sortedRegistrations: any[] = [];

    updateSortedRegistrations(): void {
        if (!this._currTournament || !this._currTournament.registrations) {
            this.sortedRegistrations = [];
            return;
        }
        if (this.hasPendingSeedChanges) {
            return;
        }
        this.sortedRegistrations = [...this._currTournament.registrations].sort((a: any, b: any) => (a.seed || 999) - (b.seed || 999));
    }
    hasPendingSeedChanges = false;
    tournamentViewMode: 'list' | 'detail' = 'list';
    showCreateTournamentDialog = false;
    detailTab: 'overview' | 'players' | 'registrations' | 'group' | 'knockout' = 'overview';
    showSeedEditDialog = false;
    selectedRegistration: any = null;
    seedEditForm = {
        newSeed: 0,
        reason: ''
    };
    showImportDialog = false;
    importJsonInput = '';
    importJsonPlaceholder = '[ { "memberId": "u01", "seed": 1 } ]';
    impactedTeams: any[] = [];
    selectedAddPlayerId = '';
    selectedAddPlayerIds: string[] = [];
    addPlayerSearchQuery = '';
    selectedGroupFilter = 'All';
    selectedMatchSortOrder = 'group';
    collapsedMatchKeys = new Set<string>();
    tournamentSearchKeyword = '';
    tournamentStatusFilter: 'all' | 'draft' | 'ongoing' | 'finished' = 'all';
    tournamentFormatFilter: 'all' | 'group' | 'round_robin' = 'all';
    showManualRestructure = false;
    draggedPlayerId = '';
    draggedFromTeamId = '';
    draggedCompetitorId = '';
    draggedFromGroupName = '';

    // Team lineups & sub-match scores states
    showLineupDialog = false;
    selectedLineupMatchId = '';
    isLineupMatchKnockout = false;
    lineupHomeTeamPlayers: any[] = [];
    lineupAwayTeamPlayers: any[] = [];
    lineupForm = {
        aPlayerId: '',
        bPlayerId: '',
        cPlayerId: '',
        xPlayerId: '',
        yPlayerId: '',
        zPlayerId: '',
        isHomeABC: true
    };

    get abcPlayers(): any[] {
        return this.lineupForm.isHomeABC !== false ? this.lineupHomeTeamPlayers : this.lineupAwayTeamPlayers;
    }

    get xyzPlayers(): any[] {
        return this.lineupForm.isHomeABC !== false ? this.lineupAwayTeamPlayers : this.lineupHomeTeamPlayers;
    }

    get lineupValidationMessage(): string {
        if (!this.lineupForm.aPlayerId || !this.lineupForm.bPlayerId || !this.lineupForm.cPlayerId
            || !this.lineupForm.xPlayerId || !this.lineupForm.yPlayerId || !this.lineupForm.zPlayerId) {
            return 'Vui lòng chọn đủ 6 vị trí A/B/C/X/Y/Z.';
        }

        if (!this.isLineupPlayersOnCorrectSides()) {
            return 'Đội hình không hợp lệ: mỗi vị trí phải thuộc đúng đội ABC hoặc XYZ.';
        }

        if (this.hasDuplicateLineupPlayers()) {
            return 'Đội hình không hợp lệ: một VĐV chỉ được xuất hiện ở đúng 1 vị trí.';
        }

        return '';
    }

    isLineupFormValid(): boolean {
        return this.lineupValidationMessage === '';
    }

    private hasDuplicateLineupPlayers(): boolean {
        const ids = [
            this.lineupForm.aPlayerId,
            this.lineupForm.bPlayerId,
            this.lineupForm.cPlayerId,
            this.lineupForm.xPlayerId,
            this.lineupForm.yPlayerId,
            this.lineupForm.zPlayerId
        ].filter((id) => !!id);

        return new Set(ids).size !== ids.length;
    }

    private isLineupPlayersOnCorrectSides(): boolean {
        const abcSet = new Set(this.abcPlayers.map((p) => p.id));
        const xyzSet = new Set(this.xyzPlayers.map((p) => p.id));

        return abcSet.has(this.lineupForm.aPlayerId)
            && abcSet.has(this.lineupForm.bPlayerId)
            && abcSet.has(this.lineupForm.cPlayerId)
            && xyzSet.has(this.lineupForm.xPlayerId)
            && xyzSet.has(this.lineupForm.yPlayerId)
            && xyzSet.has(this.lineupForm.zPlayerId);
    }

    showSubScoresDialog = false;
    selectedSubScoresMatch: any = null;
    isSubScoresMatchKnockout = false;
    selectedSubMatchIdx = 0;
    tempSubMatchSetScores: { home: number | null; away: number | null }[] = [];
    tempSubMatchHomeWins = 0;
    tempSubMatchAwayWins = 0;

    showTeamDetailsDialog = false;
    selectedTeamMatch: any = null;

    showMessageDialog = false;
    messageDialogTitle = 'Thông báo';
    messageDialogText = '';
    showConfirmDialog = false;
    confirmDialogTitle = 'Xác nhận';
    confirmDialogText = '';
    private pendingConfirmAction: (() => void) | null = null;

    newPrizeTitle = '';
    newPrizeAmount = 0;

    tournamentForm = {
        name: '',
        type: 'single' as TournamentType,
        groupSize: 4,
        teamSize: 3,
        location: '',
        prizes: [] as TournamentPrize[],
        startedAt: new Date().toISOString().split('T')[0],
        finishedAt: ''
    };

    addPrizeToForm(): void {
        if (!this.newPrizeTitle.trim()) return;
        this.tournamentForm.prizes.push({
            title: this.newPrizeTitle.trim(),
            amount: this.newPrizeAmount || 0
        });
        this.newPrizeTitle = '';
        this.newPrizeAmount = 0;
    }

    removePrizeFromForm(idx: number): void {
        this.tournamentForm.prizes.splice(idx, 1);
    }

    private openMessageDialog(message: string, title: string = 'Thông báo'): void {
        this.messageDialogTitle = title;
        this.messageDialogText = message;
        this.showMessageDialog = true;
    }

    private openConfirmDialog(message: string, onAccept: () => void, title: string = 'Xác nhận'): void {
        this.confirmDialogTitle = title;
        this.confirmDialogText = message;
        this.pendingConfirmAction = onAccept;
        this.showConfirmDialog = true;
    }

    cancelConfirmAction(): void {
        this.showConfirmDialog = false;
        this.pendingConfirmAction = null;
    }

    acceptConfirmAction(): void {
        const action = this.pendingConfirmAction;
        this.showConfirmDialog = false;
        this.pendingConfirmAction = null;
        action?.();
    }

    getPrizesSummary(prizes?: TournamentPrize[]): string {
        if (!prizes || !prizes.length) return '-';
        return prizes.map(p => `${p.title}: ${p.amount.toLocaleString()}đ`).join(', ');
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

    get teamTournamentCount(): number {
        return this.allTournaments.filter((t) => t.type === 'team').length;
    }

    get nonTeamTournamentCount(): number {
        return this.allTournaments.filter((t) => t.type !== 'team').length;
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

    getTopThreeWinners(t: Tournament): { first?: { id: string, name: string }, second?: { id: string, name: string }, third?: { id: string, name: string } } {
        if (!t) return {};
        
        // If round_robin
        if (t.format === 'round_robin') {
            const std = t.standings || [];
            const rows = std[0] ? std[0].rows : [];
            return {
                first: rows[0] ? { id: rows[0].competitor.id, name: rows[0].competitor.name } : undefined,
                second: rows[1] ? { id: rows[1].competitor.id, name: rows[1].competitor.name } : undefined,
                third: rows[2] ? { id: rows[2].competitor.id, name: rows[2].competitor.name } : undefined
            };
        }

        // If knockout
        const matches = t.knockoutMatches || [];
        const finalMatch = matches.find(m => m.roundName === 'Finals');
        
        let first: { id: string, name: string } | undefined;
        let second: { id: string, name: string } | undefined;
        let third: { id: string, name: string } | undefined;

        if (finalMatch && finalMatch.homeScore !== undefined && finalMatch.awayScore !== undefined && finalMatch.winnerId !== undefined) {
            const getCompObj = (id: string): { id: string, name: string } => {
                const m = this.dataService.getMemberById(id);
                if (m) return { id, name: m.fullName };
                const team = t.teams?.find((tm: any) => tm.id === id);
                return { id, name: team ? team.name : id };
            };

            const winnerId = finalMatch.winnerId;
            const loserId = winnerId === finalMatch.homeCompetitorId ? finalMatch.awayCompetitorId : finalMatch.homeCompetitorId;

            first = getCompObj(winnerId);
            second = getCompObj(loserId);

            // Third place check
            const bronzeMatch = matches.find(m => m.roundName === 'Bronze' || m.id === '3rd-1');
            if (bronzeMatch && bronzeMatch.winnerId !== undefined) {
                third = getCompObj(bronzeMatch.winnerId);
            } else {
                const semiMatches = matches.filter(m => m.roundName === 'Semifinals');
                const losers: string[] = [];
                semiMatches.forEach(m => {
                    if (m.homeScore !== undefined && m.awayScore !== undefined && m.winnerId !== undefined) {
                        const lId = m.winnerId === m.homeCompetitorId ? m.awayCompetitorId : m.homeCompetitorId;
                        losers.push(lId);
                    }
                });
                if (losers.length > 0) {
                    third = getCompObj(losers[0]);
                }
            }
        }

        return { first, second, third };
    }

    getTeamPlayersText(teamId: string): string {
        if (!this.currTournament || !this.currTournament.teams) return '';
        const team = this.currTournament.teams.find(t => t.id === teamId);
        if (!team) return '';
        return team.players.map(p => p.name).join(', ');
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

    getPrizeForPodium(t: Tournament, index: number): string {
        if (!t || !t.prizes || !t.prizes[index]) return '';
        const p = t.prizes[index];
        return `${p.amount.toLocaleString()}đ`;
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

    isSetDisabled(idx: number): boolean {
        let homeWins = 0;
        let awayWins = 0;
        const limit = this.isSubScoresMatchKnockout ? 3 : 2;
        for (let i = 0; i < idx; i++) {
            const s = this.tempSubMatchSetScores[i];
            if (s && s.home !== null && s.away !== null) {
                const res = this.isSetScoreValid(s.home, s.away);
                if (res.valid) {
                    const h = Number(s.home);
                    const a = Number(s.away);
                    if (h > a) homeWins++;
                    else awayWins++;
                }
            }
        }
        return homeWins >= limit || awayWins >= limit;
    }

    isSubMatchScoreValid(): boolean {
        let homeWins = 0;
        let awayWins = 0;
        const limit = this.isSubScoresMatchKnockout ? 3 : 2;
        
        let hasError = false;
        let hasAnyInput = false;
        
        for (let i = 0; i < this.tempSubMatchSetScores.length; i++) {
            const s = this.tempSubMatchSetScores[i];
            if (s.home !== null || s.away !== null) {
                hasAnyInput = true;
                const res = this.isSetScoreValid(s.home, s.away);
                if (!res.valid) {
                    hasError = true;
                } else {
                    const h = Number(s.home);
                    const a = Number(s.away);
                    if (h > a) homeWins++;
                    else awayWins++;
                }
            }
        }
        
        if (!hasAnyInput) return false;
        if (hasError) return false;
        
        return homeWins === limit || awayWins === limit;
    }

    tournamentMessage = 'Khởi tạo bốc thăm ngẫu nhiên thông minh.';

    // Charts Properties
    rankChartData: any;
    rankChartOptions: any;

    // Excel import/export properties
    importMessage = '';

    typeOptions = [
        { label: 'Đơn', value: 'single' },
        { label: 'Đôi', value: 'double' },
        { label: 'Đồng đội', value: 'team' }
    ];

    getWalkoverWinnerOptions(): any[] {
        const opts = [];
        if (this.walkover.homeId) {
            opts.push({ label: this.memberName(this.walkover.homeId), value: this.walkover.homeId });
        }
        if (this.walkover.awayId) {
            opts.push({ label: this.memberName(this.walkover.awayId), value: this.walkover.awayId });
        }
        return opts;
    }

    isReloadingTournaments = false;
    isReloadingMembers = false;
    isReloadingAuditLogs = false;

    reloadTournaments(): void {
        this.isReloadingTournaments = true;
        this.dataService.reloadTournaments().then(() => {
            this.allTournaments = this.dataService.getTournaments();
            if (this.selectedTournamentId) {
                const updated = this.allTournaments.find((t: any) => t.id === this.selectedTournamentId);
                if (updated) this.currTournament = updated;
            }
            this.updateSortedRegistrations();
            this.isReloadingTournaments = false;
        }).catch(() => { this.isReloadingTournaments = false; });
    }

    reloadMembers(): void {
        this.isReloadingMembers = true;
        this.dataService.reloadMembers().then(() => {
            this.members = this.dataService.getMembers();
            this.isReloadingMembers = false;
        }).catch(() => { this.isReloadingMembers = false; });
    }

    reloadAuditLogs(): void {
        this.isReloadingAuditLogs = true;
        this.dataService.reloadAuditLogs().then(() => {
            this.auditLogs = this.dataService.getAuditLogs();
            this.isReloadingAuditLogs = false;
        }).catch(() => { this.isReloadingAuditLogs = false; });
    }

    rankOptions = [
        { label: 'Hạng A0', value: 'A0' },
        { label: 'Hạng A1', value: 'A1' },
        { label: 'Hạng A2', value: 'A2' },
        { label: 'Hạng A3', value: 'A3' },
        { label: 'Hạng A4', value: 'A4' },
        { label: 'Hạng A5', value: 'A5' },
        { label: 'Hạng A6', value: 'A6' }
    ];

    formatDateStr(val: any): string {
        if (!val) return '';
        if (val instanceof Date) {
            const y = val.getFullYear();
            const m = String(val.getMonth() + 1).padStart(2, '0');
            const d = String(val.getDate()).padStart(2, '0');
            return `${y}-${m}-${d}`;
        }
        return String(val);
    }

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
        if (!member || !member.roles.includes('admin')) {
            this.openMessageDialog('Ban khong co quyen truy cap trang quan tri!', 'Không có quyền truy cập');
            setTimeout(() => {
                if (member && member.roles.includes('player')) {
                    this.router.navigate(['/user']);
                } else {
                    this.router.navigate(['/']);
                }
            }, 1200);
            return;
        }

        this.adminUserId = loggedIn;
        this.reloadAll();

        // Listen to tab query parameter
        this.route.queryParams.subscribe(params => {
            if (params['tab']) {
                this.activeTab = params['tab'];
            }
        });
    }

    approveMember(memberId: string): void {
        this.dataService.approveMember(memberId, this.adminUserId);
        this.reloadAll();
    }

    rejectMember(memberId: string): void {
        this.dataService.rejectMember(memberId, this.adminUserId);
        this.reloadAll();
    }

    openOverrideDialog(member: Member): void {
        this.selectedMember = member;
        this.overrideForm = {
            elo: member.elo,
            rank: member.rankTier,
            reason: ''
        };
        this.showOverrideDialog = true;
    }

    saveOverride(): void {
        if (!this.selectedMember || !this.overrideForm.reason) return;

        if (this.overrideForm.elo !== this.selectedMember.elo) {
            this.dataService.overrideEloWithReason(this.selectedMember.id, this.overrideForm.elo, this.overrideForm.reason, this.adminUserId);
        }
        if (this.overrideForm.rank !== this.selectedMember.rankTier) {
            this.dataService.overrideRankWithReason(this.selectedMember.id, this.overrideForm.rank, this.overrideForm.reason, this.adminUserId);
        }

        this.showOverrideDialog = false;
        this.reloadAll();
    }

    recordMatch(): void {
        if (!this.newMatch.homePlayerId || !this.newMatch.awayPlayerId) {
            this.matchRecordMessage = 'Vui lòng chọn đầy đủ người chơi.';
            return;
        }
        if (this.newMatch.homePlayerId === this.newMatch.awayPlayerId) {
            this.matchRecordMessage = 'Hai đối thủ không được trùng nhau.';
            return;
        }
        if (!this.newMatch.notes) {
            this.matchRecordMessage = 'Bắt buộc ghi chú lý do ghi nhận.';
            return;
        }

        this.dataService.recordMatch({
            source: 'challenge',
            homePlayerId: this.newMatch.homePlayerId,
            awayPlayerId: this.newMatch.awayPlayerId,
            homeScore: this.newMatch.homeScore,
            awayScore: this.newMatch.awayScore,
            status: 'confirmed', // Automatically confirmed by Admin/Ref
            recordedById: this.adminUserId,
            notes: this.newMatch.notes
        });

        this.matchRecordMessage = 'Ghi nhận và cập nhật Elo thành công!';
        this.newMatch.notes = '';
        this.reloadAll();
    }

    recordWalkover(): void {
        if (!this.walkover.homeId || !this.walkover.awayId || !this.walkover.winnerId) {
            this.walkoverMessage = 'Vui lòng chọn đầy đủ cặp đấu và đấu thủ thắng cuộc.';
            return;
        }
        if (!this.walkover.reason) {
            this.walkoverMessage = 'Vui lòng nhập lý do vắng mặt / Walkover.';
            return;
        }

        this.dataService.recordWalkover(
            this.walkover.homeId,
            this.walkover.awayId,
            this.walkover.winnerId,
            this.walkover.reason,
            this.adminUserId
        );

        this.walkoverMessage = 'Đã xử thắng cuộc Walkover thành công!';
        this.walkover = { homeId: '', awayId: '', winnerId: '', reason: '' };
        this.reloadAll();
    }

    resolveDispute(matchId: string, action: 'confirm' | 'cancel' | 'modify'): void {
        if (!this.disputedForm.reason) {
            this.openMessageDialog('Bắt buộc nhập lý do giải quyết tranh chấp!');
            return;
        }

        this.dataService.resolveDisputedMatch(
            matchId,
            action,
            this.disputedForm.homeScore,
            this.disputedForm.awayScore,
            this.adminUserId,
            this.disputedForm.reason
        );

        this.disputedForm.reason = '';
        this.reloadAll();
    }



    // Tournaments Management
    tournamentDialogMode: 'create' | 'edit' = 'create';
    editingTournamentId = '';

    openCreateTournamentDialog(): void {
        this.tournamentDialogMode = 'create';
        this.newPrizeTitle = '';
        this.newPrizeAmount = 0;
        this.tournamentForm = {
            name: '',
            type: 'single',
            groupSize: 4,
            teamSize: 3,
            location: '',
            prizes: [] as TournamentPrize[],
            startedAt: new Date().toISOString().split('T')[0],
            finishedAt: ''
        };
        this.showCreateTournamentDialog = true;
    }

    openEditTournamentDialog(t: any): void {
        this.tournamentDialogMode = 'edit';
        this.editingTournamentId = t.id;
        this.newPrizeTitle = '';
        this.newPrizeAmount = 0;
        this.tournamentForm = {
            name: t.name,
            type: t.type,
            groupSize: t.groupSize || 4,
            teamSize: t.teamSize || 3,
            location: t.location || '',
            prizes: t.prizes ? JSON.parse(JSON.stringify(t.prizes)) : [] as TournamentPrize[],
            startedAt: t.startedAt || new Date().toISOString().split('T')[0],
            finishedAt: t.finishedAt || ''
        };
        this.showCreateTournamentDialog = true;
    }

    saveTournament(): void {
        if (this.tournamentDialogMode === 'create') {
            this.saveNewTournament();
        } else {
            this.saveEditedTournament();
        }
    }

    saveNewTournament(): void {
        if (!this.tournamentForm.name) return;
        const t = this.dataService.createTournament({
            name: this.tournamentForm.name,
            type: this.tournamentForm.type,
            startedAt: this.formatDateStr(this.tournamentForm.startedAt),
            finishedAt: this.formatDateStr(this.tournamentForm.finishedAt),
            location: this.tournamentForm.location,
            prizes: this.tournamentForm.prizes
        });
        this.showCreateTournamentDialog = false;
        this.tournamentForm = {
            name: '',
            type: 'single',
            groupSize: 4,
            teamSize: 3,
            location: '',
            prizes: [] as TournamentPrize[],
            startedAt: new Date().toISOString().split('T')[0],
            finishedAt: ''
        };
        this.reloadAll();
        this.selectTournament(t.id);
    }

    saveEditedTournament(): void {
        if (!this.tournamentForm.name || !this.editingTournamentId) return;
        this.dataService.updateTournament(this.editingTournamentId, {
            name: this.tournamentForm.name,
            type: this.tournamentForm.type,
            startedAt: this.formatDateStr(this.tournamentForm.startedAt),
            finishedAt: this.formatDateStr(this.tournamentForm.finishedAt),
            location: this.tournamentForm.location,
            prizes: this.tournamentForm.prizes
        });
        this.showCreateTournamentDialog = false;
        this.reloadAll();
        if (this.currTournament && this.currTournament.id === this.editingTournamentId) {
            const updated = this.allTournaments.find(x => x.id === this.editingTournamentId);
            this.currTournament = updated ? { ...updated } : null;
        }
    }

    deleteTournament(id: string): void {
        this.openConfirmDialog('Bạn có chắc chắn muốn xóa giải đấu này? Mọi thông tin trận đấu và bảng xếp hạng liên quan sẽ bị xóa vĩnh viễn.', () => {
            // Transition back to list view first to destroy detail templates
            if (this.currTournament && this.currTournament.id === id) {
                this.tournamentViewMode = 'list';
            }
            
            // Defer data modification to next tick so Angular completes DOM destruction cleanly
            setTimeout(() => {
                this.dataService.deleteTournament(id);
                this.reloadAll();
                if (this.currTournament && this.currTournament.id === id) {
                    this.currTournament = null;
                }
            }, 0);
        }, 'Xóa giải đấu');
    }

    selectTournament(tid: string): void {
        this.selectedTournamentId = tid;
        this.loadTournamentDetail(tid);
        this.tournamentViewMode = 'detail';
        this.detailTab = this.currTournament?.status === 'draft' ? 'players' : 'overview';
    }

    openSeedEditDialog(reg: any): void {
        this.selectedRegistration = reg;
        this.seedEditForm = {
            newSeed: reg.seed,
            reason: ''
        };
        this.impactedTeams = [];
        this.showSeedEditDialog = true;
    }

    onSeedChange(): void {
        if (!this.currTournament || !this.selectedRegistration || this.seedEditForm.newSeed <= 0) {
            this.impactedTeams = [];
            return;
        }
        this.dataService.assessSeedImpact(
            this.currTournament.id,
            this.selectedRegistration.memberId,
            this.seedEditForm.newSeed
        ).subscribe({
            next: (res: any) => {
                this.impactedTeams = res.impactedTeams || [];
            },
            error: () => {
                this.impactedTeams = [];
            }
        });
    }

    saveSeedOverride(): void {
        if (!this.currTournament || !this.selectedRegistration) {
            return;
        }

        const duplicate = this.currTournament.registrations?.find((r: any) =>
            r.memberId !== this.selectedRegistration.memberId && r.seed === this.seedEditForm.newSeed
        );
        if (duplicate) {
            this.messageDialogTitle = 'Lỗi Ràng Buộc Hạt Giống';
            this.messageDialogText = 'Hạt giống này đã được phân cho đấu thủ khác trong giải đấu. Mỗi hạt giống phải là duy nhất!';
            this.showMessageDialog = true;
            return;
        }

        this.dataService.overrideTournamentSeed(
            this.currTournament.id,
            this.selectedRegistration.memberId,
            this.seedEditForm.newSeed,
            this.seedEditForm.reason,
            this.adminUserId
        );
        this.showSeedEditDialog = false;

        setTimeout(() => this.reloadAll(), 250);
    }

    triggerImportRegistrations(): void {
        this.showImportDialog = true;
        this.importJsonInput = '';
    }

    executeImportRegistrations(): void {
        if (!this.currTournament || !this.importJsonInput) {
            return;
        }

        try {
            const parsed = JSON.parse(this.importJsonInput);
            if (!Array.isArray(parsed)) {
                throw new Error('Dữ liệu nhập vào phải là một mảng JSON.');
            }
            this.dataService.importRegistrations(this.currTournament.id, parsed).subscribe({
                next: () => {
                    this.showImportDialog = false;
                    this.reloadAll();
                    setTimeout(() => {
                        this.loadTournamentDetail(this.currTournament!.id);
                    }, 250);
                    this.messageDialogTitle = 'Thành công';
                    this.messageDialogText = 'Import danh sách đăng ký thành công!';
                    this.showMessageDialog = true;
                },
                error: (err) => {
                    console.error(err);
                    this.messageDialogTitle = 'Lỗi Import';
                    this.messageDialogText = 'Import thất bại. Vui lòng kiểm tra lại cấu trúc JSON hoặc trùng hạt giống.';
                    this.showMessageDialog = true;
                }
            });
        } catch (e: any) {
            this.messageDialogTitle = 'Lỗi cú pháp JSON';
            this.messageDialogText = e.message || 'JSON không hợp lệ.';
            this.showMessageDialog = true;
        }
    }

    backToList(): void {
        this.tournamentViewMode = 'list';
    }

    drawTournament(tid: string): void {
        this.dataService.drawTournament(tid);
        this.reloadAll();
        const updated = this.allTournaments.find((x: any) => x.id === tid);
        this.currTournament = updated ? { ...updated } : null;
    }

    resetTournamentDraw(tid: string): void {
        this.openConfirmDialog('Bạn có chắc chắn muốn hủy toàn bộ kết quả bốc thăm, danh sách đội và các trận đấu đã phát sinh? Hành động này sẽ chuyển giải đấu về trạng thái thiết lập (Draft) để cấu hình và chia bảng lại.', () => {
            this.dataService.resetTournamentDraw(tid);
            this.reloadAll();
            const updated = this.allTournaments.find((x: any) => x.id === tid);
            this.currTournament = updated ? { ...updated } : null;
            this.detailTab = 'players';
        }, 'Hủy kết quả bốc thăm');
    }

    updateTournamentConfig(): void {
        if (this.currTournament) {
            this.dataService.updateTournamentStructure(
                this.currTournament.id,
                this.currTournament.groupSize || 4,
                this.currTournament.teamSize || 3,
                this.currTournament.format || 'group'
            );
            this.reloadAll();
            const updated = this.allTournaments.find((x: any) => x.id === this.currTournament!.id);
            this.currTournament = updated ? { ...updated } : null;
        }
    }

    toggleCaptain(playerId: string): void {
        if (this.currTournament) {
            this.dataService.toggleCaptainForTournament(this.currTournament.id, playerId);
            this.reloadAll();
            const updated = this.allTournaments.find((x: any) => x.id === this.currTournament!.id);
            this.currTournament = updated ? { ...updated } : null;
        }
    }

    isCaptain(playerId: string): boolean {
        return !!(this.currTournament?.captains?.includes(playerId));
    }

    saveTournamentScore(tournamentId: string, groupName: string, homeId: string, awayId: string, homeScore: number, awayScore: number): void {
        this.dataService.saveTournamentMatchScore(tournamentId, groupName, homeId, awayId, homeScore, awayScore);
        this.reloadAll();
        const updated = this.allTournaments.find((x: any) => x.id === tournamentId);
        this.currTournament = updated ? { ...updated } : null;
    }

    finishTournament(tournamentId: string): void {
        this.dataService.finishTournament(tournamentId);
        this.reloadAll();
        const updated = this.allTournaments.find((x: any) => x.id === tournamentId);
        this.currTournament = updated ? { ...updated } : null;
    }

    getAvailablePlayersForTournament(): any[] {
        if (!this.currTournament) return [];
        const participants = this.currTournament.participants || [];
        return this.members.filter(m => m.isActive && !participants.includes(m.id));
    }

    toggleAddPlayerCheckbox(playerId: string): void {
        const idx = this.selectedAddPlayerIds.indexOf(playerId);
        if (idx > -1) {
            this.selectedAddPlayerIds.splice(idx, 1);
        } else {
            this.selectedAddPlayerIds.push(playerId);
        }
    }

    isAddPlayerChecked(playerId: string): boolean {
        return this.selectedAddPlayerIds.includes(playerId);
    }

    getFilteredAvailablePlayers(): any[] {
        const list = this.getAvailablePlayersForTournament();
        if (!this.addPlayerSearchQuery.trim()) {
            return list;
        }
        const query = this.addPlayerSearchQuery.toLowerCase();
        return list.filter(p => p.fullName.toLowerCase().includes(query) || (p.department && p.department.toLowerCase().includes(query)));
    }

    isAllFilteredPlayersChecked(): boolean {
        const filtered = this.getFilteredAvailablePlayers();
        if (filtered.length === 0) return false;
        return filtered.every(p => this.selectedAddPlayerIds.includes(p.id));
    }

    toggleAllFilteredPlayers(event: any): void {
        const checked = event.target.checked;
        const filtered = this.getFilteredAvailablePlayers();
        if (checked) {
            for (const p of filtered) {
                if (!this.selectedAddPlayerIds.includes(p.id)) {
                    this.selectedAddPlayerIds.push(p.id);
                }
            }
        } else {
            for (const p of filtered) {
                const idx = this.selectedAddPlayerIds.indexOf(p.id);
                if (idx !== -1) {
                    this.selectedAddPlayerIds.splice(idx, 1);
                }
            }
        }
    }

    addSelectedPlayersToTournament(): void {
        if (!this.currTournament || this.selectedAddPlayerIds.length === 0) return;

        const tournamentId = this.currTournament.id;
        const ids = [...this.selectedAddPlayerIds];

        // Use batch method to register all players atomically (single sync to backend)
        this.dataService.batchRegisterPlayersForTournament(tournamentId, ids);

        this.selectedAddPlayerIds = [];
        this.addPlayerSearchQuery = '';
        this.reloadAll();
        const updated = this.allTournaments.find((x: any) => x.id === tournamentId);
        if (updated) this.currTournament = { ...updated };
    }


    removePlayerFromTournament(pid: string): void {
        if (!this.currTournament) return;
        const tournamentId = this.currTournament.id;
        const isOngoing = this.currTournament.status === 'ongoing';
        
        let confirmMsg = 'Bạn có chắc chắn muốn xóa vận động viên này khỏi giải đấu?';
        if (isOngoing) {
            confirmMsg = 'Giải đấu đang diễn ra. Bạn có chắc chắn muốn rút VĐV này khỏi giải đấu? Đội của VĐV này sẽ tạm thời bị thiếu người.';
        } else if (this.currTournament.teams && this.currTournament.teams.length > 0) {
            confirmMsg = 'Các đội đã được chia. Việc xóa VĐV này sẽ giải tán các đội để chia lại. Bạn có chắc chắn muốn tiếp tục?';
        }

        this.openConfirmDialog(confirmMsg, () => {
            if (isOngoing) {
                this.dataService.withdrawPlayerFromOngoing(tournamentId, pid);
                this.reloadAll();
                const updated = this.allTournaments.find((x: any) => x.id === tournamentId);
                this.currTournament = updated ? { ...updated } : null;
                this.openMessageDialog('VĐV đã được rút khỏi giải đấu thành công! Bạn có thể nhấn "Tái cấu trúc đội + bảng" để hệ thống chia lại đội và bốc lại bảng/lịch, hoặc dùng chế độ "Chỉnh tay kéo-thả" để tự điều chỉnh.');
            } else {
                this.dataService.removePlayerFromTournament(tournamentId, pid);
                this.reloadAll();
                const updated = this.allTournaments.find((x: any) => x.id === tournamentId);
                this.currTournament = updated ? { ...updated } : null;
                this.openMessageDialog('Đã xóa VĐV thành công. Các đội hình nháp và bảng đấu nháp đã được giải tán để bạn thực hiện bốc thăm/chia lại mới!');
            }
        }, 'Xác nhận rút VĐV');
    }

    hasDeficitTeams(): boolean {
        if (!this.currTournament || !this.currTournament.teams || this.currTournament.type !== 'team') return false;
        const teamSize = this.currTournament.teamSize || 3;
        return this.currTournament.teams.some(team => team.players.length < teamSize);
    }

    toggleManualRestructureMode(): void {
        this.showManualRestructure = !this.showManualRestructure;
        this.draggedPlayerId = '';
        this.draggedFromTeamId = '';
        this.draggedCompetitorId = '';
        this.draggedFromGroupName = '';
    }

    allowDrop(event: DragEvent): void {
        event.preventDefault();
    }

    onPlayerDragStart(fromTeamId: string, playerId: string): void {
        this.draggedFromTeamId = fromTeamId;
        this.draggedPlayerId = playerId;
    }

    onDropPlayerToTeam(event: DragEvent, toTeamId: string): void {
        event.preventDefault();
        if (!this.currTournament || !this.draggedPlayerId || !this.draggedFromTeamId) return;
        const tournamentId = this.currTournament.id;

        const moved = this.dataService.movePlayerBetweenTeams(
            tournamentId,
            this.draggedFromTeamId,
            toTeamId,
            this.draggedPlayerId
        );

        this.draggedPlayerId = '';
        this.draggedFromTeamId = '';

        if (!moved) {
            this.openMessageDialog('Không thể chuyển VĐV. Kiểm tra đội đích đã đủ quân số hoặc thao tác kéo-thả chưa hợp lệ.');
            return;
        }

        this.reloadAll();
        const updated = this.allTournaments.find((x: any) => x.id === tournamentId);
        this.currTournament = updated ? { ...updated } : null;
    }

    onCompetitorDragStart(fromGroupName: string, competitorId: string): void {
        this.draggedFromGroupName = fromGroupName;
        this.draggedCompetitorId = competitorId;
    }

    onDropCompetitorToGroup(event: DragEvent, toGroupName: string): void {
        event.preventDefault();
        if (!this.currTournament || !this.draggedCompetitorId || !this.draggedFromGroupName) return;
        const tournamentId = this.currTournament.id;

        const moved = this.dataService.moveCompetitorBetweenGroups(
            tournamentId,
            this.draggedFromGroupName,
            toGroupName,
            this.draggedCompetitorId
        );

        this.draggedCompetitorId = '';
        this.draggedFromGroupName = '';

        if (!moved) {
            this.openMessageDialog('Không thể chuyển đội giữa các bảng. Kiểm tra trạng thái giải đấu hoặc thao tác kéo-thả.');
            return;
        }

        this.reloadAll();
        const updated = this.allTournaments.find((x: any) => x.id === tournamentId);
        this.currTournament = updated ? { ...updated } : null;
    }

    rebuildGroupScheduleFromCurrentGroups(): void {
        if (!this.currTournament) return;
        const tournamentId = this.currTournament.id;
        this.openConfirmDialog('Xác nhận dựng lại toàn bộ lịch vòng bảng theo cấu hình đội/bảng hiện tại? Các kết quả vòng bảng hiện có sẽ được làm mới.', () => {
            const ok = this.dataService.rebuildGroupScheduleFromCurrentGroups(tournamentId);
            if (!ok) {
                this.openMessageDialog('Không thể dựng lại lịch vòng bảng ở thời điểm hiện tại.');
                return;
            }

            this.reloadAll();
            const updated = this.allTournaments.find((x: any) => x.id === tournamentId);
            this.currTournament = updated ? { ...updated } : null;
            this.openMessageDialog('Đã dựng lại lịch vòng bảng thành công theo cấu hình đội/bảng mới.');
        }, 'Dựng lại lịch vòng bảng');
    }

    getTeamPlayerCount(teamId: string): number {
        if (!this.currTournament?.teams?.length) return 0;
        return this.currTournament.teams.find(team => team.id === teamId)?.players.length || 0;
    }

    rebalanceDeficitTeams(): void {
        if (!this.currTournament) return;
        const tournamentId = this.currTournament.id;
        this.openConfirmDialog('Bạn có chắc chắn muốn hệ thống tự động gom các đội thiếu người, tái cấu trúc lại toàn bộ bảng đấu và dựng lại lịch vòng bảng?', () => {
            this.dataService.rebalanceDeficitTeamsAndRecreateMatches(tournamentId);
            this.reloadAll();
            const updated = this.allTournaments.find((x: any) => x.id === tournamentId);
            this.currTournament = updated ? { ...updated } : null;
            this.openMessageDialog('Đã tái cấu trúc đội hình và bảng đấu thành công. Lịch vòng bảng đã được dựng lại theo cấu hình mới.');
        }, 'Tái cấu trúc đội và bảng');
    }

    generateTeams(): void {
        if (this.currTournament) {
            this.dataService.generateTeamsForTournament(this.currTournament.id);
            this.reloadAll();
            const updated = this.allTournaments.find((x: any) => x.id === this.currTournament!.id);
            this.currTournament = updated ? { ...updated } : null;
        }
    }

    /** Clear all teams and return to the slot-builder (Sub-state C) */
    clearTeams(): void {
        if (!this.currTournament) return;
        this.openConfirmDialog(
            'Bạn có chắc muốn xóa toàn bộ đội hình hiện tại? Các đội sẽ bị giải tán và bạn có thể phân đội lại thủ công hoặc chia ngẫu nhiên.',
            () => {
                const tournamentId = this.currTournament!.id;
                this.dataService.clearTeamsForTournament(tournamentId);
                this.reloadAll();
                const updated = this.allTournaments.find((x: any) => x.id === tournamentId);
                if (updated) this.currTournament = { ...updated };
            },
            'Hủy đội hình'
        );
    }

    // ─── Manual Team Slot Builder ────────────────────────────────────────────
    showManualSlotBuilder = false;
    activeSlotId: string | null = null;

    toggleManualSlotBuilder(): void {
        this.showManualSlotBuilder = !this.showManualSlotBuilder;
        if (!this.showManualSlotBuilder) this.activeSlotId = null;
    }

    addManualSlot(): void {
        if (!this.currTournament) return;
        const tournamentId = this.currTournament.id;
        const slotId = this.dataService.addManualTeamSlot(tournamentId);
        if (slotId) {
            // reloadAll() re-fetches from service (getTournaments returns new mapped objects each time)
            this.reloadAll();
            const updated = this.allTournaments.find((x: any) => x.id === tournamentId);
            if (updated) {
                this.currTournament = {
                    ...updated,
                    manualTeamSlots: [...(updated.manualTeamSlots || [])]
                };
            }
            this.activeSlotId = slotId;
        }
    }

    removeManualSlot(slotId: string): void {
        if (!this.currTournament) return;
        const tournamentId = this.currTournament.id;
        this.dataService.removeManualTeamSlot(tournamentId, slotId);
        this.reloadAll();
        const updated = this.allTournaments.find((x: any) => x.id === tournamentId);
        if (updated) {
            this.currTournament = {
                ...updated,
                manualTeamSlots: [...(updated.manualTeamSlots || [])]
            };
        }
        if (this.activeSlotId === slotId) this.activeSlotId = null;
    }

    selectSlot(slotId: string): void {
        this.activeSlotId = this.activeSlotId === slotId ? null : slotId;
    }

    togglePlayerInSlot(slotId: string, memberId: string): void {
        if (!this.currTournament) return;
        const tournamentId = this.currTournament.id;
        this.dataService.togglePlayerInSlot(tournamentId, slotId, memberId);
        this.reloadAll();
        const updated = this.allTournaments.find((x: any) => x.id === tournamentId);
        if (updated) {
            const newSlots = (updated.manualTeamSlots || []).map((s: any) => ({ ...s, memberIds: [...s.memberIds] }));
            this.currTournament = { ...updated, manualTeamSlots: newSlots };
        }
    }

    isPlayerInSlot(slotId: string, memberId: string): boolean {
        return this.currTournament?.manualTeamSlots
            ?.find(s => s.slotId === slotId)
            ?.memberIds.includes(memberId) ?? false;
    }

    getPlayerSlotId(memberId: string): string | null {
        const slot = this.currTournament?.manualTeamSlots?.find(s => s.memberIds.includes(memberId));
        return slot?.slotId ?? null;
    }

    isPlayerInAnySlot(memberId: string): boolean {
        return !!this.getPlayerSlotId(memberId);
    }

    getSlotLabel(slotId: string): string {
        const slot = this.currTournament?.manualTeamSlots?.find(s => s.slotId === slotId);
        if (!slot) return '';
        if (slot.label) return slot.label;
        const firstMemberId = slot.memberIds[0];
        return firstMemberId ? `Đội ${this.memberName(firstMemberId)}` : 'Nhóm mới';
    }

    getSlotMemberCount(slotId: string): number {
        return this.currTournament?.manualTeamSlots?.find(s => s.slotId === slotId)?.memberIds.length ?? 0;
    }

    getLockedMemberCount(): number {
        return this.currTournament?.manualTeamSlots?.reduce((sum, s) => sum + s.memberIds.length, 0) ?? 0;
    }

    updateSlotLabel(slotId: string, event: Event): void {
        if (!this.currTournament) return;
        const input = event.target as HTMLInputElement;
        this.dataService.renameManualTeamSlot(this.currTournament.id, slotId, input.value);
    }

    clearAllManualSlots(): void {
        if (!this.currTournament) return;
        this.dataService.clearAllManualSlots(this.currTournament.id);
        const updated = this.allTournaments.find((x: any) => x.id === this.currTournament!.id);
        if (updated) this.currTournament = { ...updated };
        this.activeSlotId = null;
    }
    // ────────────────────────────────────────────────────────────────────────

    openLineupDialog(match: any, isKnockout: boolean): void {
        if (!this.currTournament) return;
        this.selectedLineupMatchId = isKnockout
            ? match.id
            : `${match.groupName}-${match.homeCompetitorId}-${match.awayCompetitorId}`;
        this.isLineupMatchKnockout = isKnockout;

        const homeTeam = this.currTournament.teams?.find(t => t.id === match.homeCompetitorId);
        const awayTeam = this.currTournament.teams?.find(t => t.id === match.awayCompetitorId);

        this.lineupHomeTeamPlayers = homeTeam ? homeTeam.players : [];
        this.lineupAwayTeamPlayers = awayTeam ? awayTeam.players : [];

        if (match.lineup) {
            this.lineupForm = { 
                ...match.lineup,
                isHomeABC: match.lineup.isHomeABC !== false
            };
        } else {
            this.lineupForm = {
                aPlayerId: this.lineupHomeTeamPlayers[0]?.id || '',
                bPlayerId: this.lineupHomeTeamPlayers[1]?.id || '',
                cPlayerId: this.lineupHomeTeamPlayers[2]?.id || '',
                xPlayerId: this.lineupAwayTeamPlayers[0]?.id || '',
                yPlayerId: this.lineupAwayTeamPlayers[1]?.id || '',
                zPlayerId: this.lineupAwayTeamPlayers[2]?.id || '',
                isHomeABC: true
            };
        }

        this.showLineupDialog = true;
    }

    saveLineup(): void {
        if (!this.currTournament) return;

        if (!this.isLineupFormValid()) {
            this.openMessageDialog(this.lineupValidationMessage || 'Đội hình chưa hợp lệ.');
            return;
        }

        this.dataService.saveTeamMatchLineup(
            this.currTournament.id,
            this.isLineupMatchKnockout,
            this.selectedLineupMatchId,
            this.lineupForm
        );
        this.reloadAll();
        const updated = this.allTournaments.find((x: any) => x.id === this.currTournament!.id);
        this.currTournament = updated ? { ...updated } : null;
        this.showLineupDialog = false;
    }

    openTeamDetails(match: any): void {
        this.selectedTeamMatch = match;
        this.showTeamDetailsDialog = true;
    }

    isSubMatchDisabled(match: any, subIdx: number, sub: any): boolean {
        if (!match) return true;
        if (sub && sub.completed) return false;
        
        const homeWins = match.homeScore || 0;
        const awayWins = match.awayScore || 0;
        if (homeWins >= 3 || awayWins >= 3) {
            return true;
        }
        return false;
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

    openSingleSubMatchScoreDialog(match: any, idx: number): void {
        this.selectedSubScoresMatch = match;
        this.selectedSubMatchIdx = idx;
        const isKnockout = !match.groupName;
        this.isSubScoresMatchKnockout = isKnockout;
        
        const sub = idx >= 0 ? match.subMatches?.[idx] : match;
        const numSets = isKnockout ? 5 : 3;
        
        this.tempSubMatchSetScores = [];
        for (let s = 0; s < numSets; s++) {
            this.tempSubMatchSetScores.push({
                home: sub?.setScores?.[s]?.home ?? null,
                away: sub?.setScores?.[s]?.away ?? null
            });
        }
        
        this.tempSubMatchHomeWins = sub?.homeScore ?? 0;
        this.tempSubMatchAwayWins = sub?.awayScore ?? 0;
        this.showSubScoresDialog = true;
    }

    autoComputeSingleSubMatch(): void {
        let homeWins = 0;
        let awayWins = 0;
        const limit = this.isSubScoresMatchKnockout ? 3 : 2;
        
        for (let i = 0; i < this.tempSubMatchSetScores.length; i++) {
            const s = this.tempSubMatchSetScores[i];
            
            if (homeWins >= limit || awayWins >= limit) {
                s.home = null;
                s.away = null;
                continue;
            }
            
            if (s.home !== null && s.away !== null) {
                const res = this.isSetScoreValid(s.home, s.away);
                if (res.valid) {
                    const h = Number(s.home);
                    const a = Number(s.away);
                    if (h > a) homeWins++;
                    else awayWins++;
                }
            }
        }
        this.tempSubMatchHomeWins = homeWins;
        this.tempSubMatchAwayWins = awayWins;
    }

    saveSingleSubMatchScore(): void {
        if (!this.currTournament || !this.selectedSubScoresMatch) return;
        
        const isKnockout = this.isSubScoresMatchKnockout;
        const matchId = isKnockout
            ? this.selectedSubScoresMatch.id
            : `${this.selectedSubScoresMatch.groupName}-${this.selectedSubScoresMatch.homeCompetitorId}-${this.selectedSubScoresMatch.awayCompetitorId}`;

        const validSets = this.tempSubMatchSetScores
            .filter(s => s.home !== null && s.away !== null)
            .map(s => ({ home: Number(s.home), away: Number(s.away) }));

        if (this.selectedSubMatchIdx >= 0) {
            // Team sub-match
            this.dataService.saveTeamSubMatchScore(
                this.currTournament.id,
                isKnockout,
                matchId,
                this.selectedSubMatchIdx,
                this.tempSubMatchHomeWins,
                this.tempSubMatchAwayWins,
                validSets
            );
        } else {
            // Normal single/double match
            if (isKnockout) {
                this.dataService.saveKnockoutMatchScore(
                    this.currTournament.id,
                    matchId,
                    this.tempSubMatchHomeWins,
                    this.tempSubMatchAwayWins,
                    validSets
                );
            } else {
                this.dataService.saveTournamentMatchScore(
                    this.currTournament.id,
                    this.selectedSubScoresMatch.groupName,
                    this.selectedSubScoresMatch.homeCompetitorId,
                    this.selectedSubScoresMatch.awayCompetitorId,
                    this.tempSubMatchHomeWins,
                    this.tempSubMatchAwayWins,
                    validSets
                );
            }
        }
        
        this.reloadAll();
        const updated = this.allTournaments.find((x: any) => x.id === this.currTournament!.id);
        this.currTournament = updated ? { ...updated } : null;

        // Keep selectedTeamMatch sync'd for showTeamDetailsDialog UI
        if (this.selectedTeamMatch) {
            const refId = this.selectedTeamMatch.id || `${this.selectedTeamMatch.groupName}-${this.selectedTeamMatch.homeCompetitorId}-${this.selectedTeamMatch.awayCompetitorId}`;
            const refreshed = isKnockout
                ? this.currTournament?.knockoutMatches?.find(m => m.id === refId)
                : this.currTournament?.scores?.find(m => `${m.groupName}-${m.homeCompetitorId}-${m.awayCompetitorId}` === refId);
            if (refreshed) {
                this.selectedTeamMatch = refreshed;
            }
        }

        this.showSubScoresDialog = false;
    }

    getMemberGender(pid: string): string {
        if (this.currTournament && this.currTournament.registrations) {
            const reg = this.currTournament.registrations.find((r: any) => r.memberId === pid);
            if (reg && reg.genderSnapshot) {
                return reg.genderSnapshot;
            }
        }
        const m = this.members.find(x => x.id === pid);
        return m?.gender || 'N/A';
    }

    getSortedRegistrations(): any[] {
        if (!this.currTournament || !this.currTournament.registrations) return [];
        return [...this.currTournament.registrations].sort((a: any, b: any) => (a.seed || 999) - (b.seed || 999));
    }

    /** Handle CDK drag-drop to reorder seed positions */
    onSeedDrop(event: CdkDragDrop<any[]>): void {
        if (!this.currTournament) return;
        if (event.previousIndex === event.currentIndex) return;

        const sorted = this.getSortedRegistrations();
        moveItemInArray(sorted, event.previousIndex, event.currentIndex);

        // Update seeds in currTournament.registrations & sortedRegistrations locally
        sorted.forEach((reg, index) => {
            reg.seed = index + 1;
            const local = this.currTournament!.registrations?.find((r: any) => r.memberId === reg.memberId);
            if (local) local.seed = index + 1;
        });

        this.sortedRegistrations = [...sorted];
        this.hasPendingSeedChanges = true;
    }

    onSeedInlineChange(reg: any, event: any): void {
        if (!this.currTournament) return;
        const newSeed = parseInt(event.target.value, 10);
        if (isNaN(newSeed) || newSeed <= 0) {
            event.target.value = reg.seed;
            return;
        }

        reg.seed = newSeed;
        const local = this.currTournament.registrations?.find((r: any) => r.memberId === reg.memberId);
        if (local) {
            local.seed = newSeed;
        }
        this.hasPendingSeedChanges = true;
    }

    savePendingSeedChanges(): void {
        if (!this.currTournament || !this.hasPendingSeedChanges) return;
        const seedUpdates = (this.currTournament.registrations || []).map((r: any) => ({
            memberId: r.memberId,
            seed: r.seed
        }));
        this.dataService.saveBatchSeeds(this.currTournament.id, seedUpdates);
        this.hasPendingSeedChanges = false;
        this.messageDialogTitle = 'Thành công';
        this.messageDialogText = 'Đã lưu thay đổi thứ tự hạt giống thành công!';
        this.showMessageDialog = true;
        this.reloadAll();
    }

    getMemberDepartment(pid: string): string {
        const m = this.members.find(x => x.id === pid);
        return m?.department || 'Phong CNTT';
    }

    getMemberElo(pid: string): number {
        if (this.currTournament && this.currTournament.registrations) {
            const reg = this.currTournament.registrations.find((r: any) => r.memberId === pid);
            if (reg && reg.eloSnapshot !== undefined) {
                return reg.eloSnapshot;
            }
        }
        const m = this.members.find(x => x.id === pid);
        return m?.elo || 1500;
    }

    getMemberRank(pid: string): string {
        if (this.currTournament && this.currTournament.registrations) {
            const reg = this.currTournament.registrations.find((r: any) => r.memberId === pid);
            if (reg && reg.rankSnapshot) {
                return reg.rankSnapshot;
            }
        }
        const m = this.members.find(x => x.id === pid);
        return m?.rankTier || 'A5';
    }

    /** Get seed number for a competitor (by memberId) from current tournament registrations */
    getRegSeed(memberId: string): number | null {
        if (!this.currTournament?.registrations) return null;
        const reg = this.currTournament.registrations.find((r: any) => r.memberId === memberId);
        return reg?.seed ?? null;
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

    // Helpers
    memberName(memberId: string): string {
        return (this.members || []).find((member) => member.id === memberId)?.fullName ?? memberId;
    }

    /** Safely join multiple member IDs into a name string (preserves 'this' context) */
    getMemberNamesJoined(ids: string[], separator = ', '): string {
        return (ids || []).map(id => this.memberName(id)).join(separator);
    }

    /** Safely join multiple competitor IDs into a name string (preserves 'this' context) */
    getCompetitorNamesJoined(ids: string[], separator = ' \u2022 '): string {
        return (ids || []).map(id => this.memberName(id)).join(separator);
    }

    getTournamentTypeLabel(type: string): string {
        switch (type) {
            case 'single': return 'Đơn';
            case 'double': return 'Đôi';
            case 'team': return 'Đồng đội';
            default: return type;
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

    startKnockoutStage(tournamentId: string): void {
        this.dataService.generateKnockoutStage(tournamentId);
        this.reloadAll();
    }

    saveKnockoutScore(tournamentId: string, matchId: string, homeScore: number, awayScore: number): void {
        this.dataService.saveKnockoutMatchScore(tournamentId, matchId, homeScore, awayScore);
        this.reloadAll();
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

    isMatchOrSubMatchCompleted(): boolean {
        if (!this.selectedSubScoresMatch) return false;
        if (this.selectedSubMatchIdx >= 0) {
            return !!(this.selectedSubScoresMatch.subMatches && this.selectedSubScoresMatch.subMatches[this.selectedSubMatchIdx]?.completed);
        }
        return !!this.selectedSubScoresMatch.completed;
    }

    deleteMatchScore(): void {
        if (!this.currTournament || !this.selectedSubScoresMatch) return;
        
        const isKnockout = this.isSubScoresMatchKnockout;
        const matchId = isKnockout
            ? this.selectedSubScoresMatch.id
            : `${this.selectedSubScoresMatch.groupName}-${this.selectedSubScoresMatch.homeCompetitorId}-${this.selectedSubScoresMatch.awayCompetitorId}`;

        if (this.selectedSubMatchIdx >= 0) {
            this.dataService.deleteTeamSubMatchScore(
                this.currTournament.id,
                isKnockout,
                matchId,
                this.selectedSubMatchIdx
            );
        } else {
            if (isKnockout) {
                this.dataService.deleteKnockoutMatchScore(
                    this.currTournament.id,
                    matchId
                );
            } else {
                this.dataService.deleteTournamentMatchScore(
                    this.currTournament.id,
                    this.selectedSubScoresMatch.groupName,
                    this.selectedSubScoresMatch.homeCompetitorId,
                    this.selectedSubScoresMatch.awayCompetitorId
                );
            }
        }
        
        this.reloadAll();
        const updated = this.allTournaments.find((x: any) => x.id === this.currTournament!.id);
        this.currTournament = updated ? { ...updated } : null;

        if (this.selectedTeamMatch) {
            const refId = this.selectedTeamMatch.id || `${this.selectedTeamMatch.groupName}-${this.selectedTeamMatch.homeCompetitorId}-${this.selectedTeamMatch.awayCompetitorId}`;
            const refreshed = isKnockout
                ? this.currTournament?.knockoutMatches?.find(m => m.id === refId)
                : this.currTournament?.scores?.find(m => `${m.groupName}-${m.homeCompetitorId}-${m.awayCompetitorId}` === refId);
            if (refreshed) {
                this.selectedTeamMatch = refreshed;
            }
        }

        this.showSubScoresDialog = false;
    }

    canGenerateFinal(): boolean {
        if (!this.currTournament || !this.currTournament.knockoutMatches) return false;
        const semifinals = this.currTournament.knockoutMatches.filter(m => m.roundName === 'Semifinals');
        if (semifinals.length === 0) return false;
        return semifinals.every(m => m.winnerId !== undefined) && !this.getFinalMatch();
    }

    generateFinal(): void {
        if (this.currTournament) {
            this.dataService.generateFinalMatch(this.currTournament.id);
            this.reloadAll();
        }
    }

    isFinalMatchResolved(): boolean {
        const final = this.getFinalMatch();
        return !!(final && final.winnerId);
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

    getQualifiedLabel(t: Tournament): string {
        if (!t.standings || !t.standings.length) return 'N/A';
        return t.standings.flatMap(standing => 
            standing.rows.filter(row => row.rank <= 2).map(r => r.competitor.name)
        ).join(', ');
    }

    // Excel Simulation
    exportCSV(): void {
        const headers = 'ID,Full Name,Username,Email,Department,Elo,Rank Tier,Joined At\n';
        const rows = this.members
            .map(m => `${m.id},"${m.fullName}",${m.username || ''},${m.email},"${m.department || ''}",${m.elo},${m.rankTier},${m.joinedAt}`)
            .join('\n');
        
        const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.setAttribute('download', 'EVNICT_TableTennis_Members.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    importCSV(event: any): void {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e: any) => {
            const text = e.target.result;
            const lines = text.split('\n');
            const header = (lines[0] || '').toLowerCase();
            const hasUsernameColumn = header.includes('username');
            let addedCount = 0;
            // Skip headers
            for (let i = 1; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line) continue;
                const cols = line.split(',');
                if (cols.length >= 3) {
                    const fullName = cols[1].replace(/"/g, '').trim();
                    const username = hasUsernameColumn && cols[2]
                        ? cols[2].replace(/"/g, '').trim()
                        : this.dataService.suggestUsernameFromEmail(cols[hasUsernameColumn ? 3 : 2]?.trim() || '');
                    const email = (cols[hasUsernameColumn ? 3 : 2] || '').trim();
                    const department = cols[hasUsernameColumn ? 4 : 3] ? cols[hasUsernameColumn ? 4 : 3].replace(/"/g, '').trim() : 'Phong CNTT';
                    if (!email) {
                        continue;
                    }
                    
                    this.dataService.registerMember({ fullName, username, email, department });
                    // Auto-approve newly imported users for demo
                    const newlyAdded = this.dataService.getMembers().find(m => m.email === email && !m.isActive);
                    if (newlyAdded) {
                        this.dataService.approveMember(newlyAdded.id, this.adminUserId);
                    }
                    addedCount++;
                }
            }
            this.importMessage = `Đã nhập và duyệt tự động ${addedCount} thành viên từ file Excel thành công!`;
            this.reloadAll();
        };
        reader.readAsText(file);
    }

    loadTournamentDetail(tid: string): void {
        this.selectedTournamentId = tid;
        const found = this.allTournaments.find((x) => x.id === tid);
        this.currTournament = found ? { ...found } : null;
    }

    get filteredMembers(): Member[] {
        const nameQuery = this.memberNameSearch.trim().toLowerCase();
        const deptQuery = this.memberDepartmentSearch.trim().toLowerCase();

        let list = this.members;
        if (this.memberFilter === 'pending') {
            list = list.filter((m) => !m.isActive);
        }

        if (nameQuery) {
            list = list.filter(
                (m) => m.fullName.toLowerCase().includes(nameQuery) || (m.username || '').toLowerCase().includes(nameQuery)
            );
        }

        if (deptQuery) {
            list = list.filter((m) => (m.department || '').toLowerCase().includes(deptQuery));
        }

        return list;
    }

    private reloadAll(): void {
        this.members = this.dataService.getMembers();
        this.allMembersCount = this.members.length;
        this.pendingApprovalsCount = this.members.filter((m) => !m.isActive).length;

        this.activeMembers = this.members.filter((m) => m.isActive);
        if (!this.newMatch.homePlayerId && this.activeMembers.length) {
            this.newMatch.homePlayerId = this.activeMembers[0].id;
        }
        if (!this.newMatch.awayPlayerId && this.activeMembers.length > 1) {
            this.newMatch.awayPlayerId = this.activeMembers[1].id;
        }
        if (!this.walkover.homeId && this.activeMembers.length) {
            this.walkover.homeId = this.activeMembers[0].id;
        }
        if (!this.walkover.awayId && this.activeMembers.length > 1) {
            this.walkover.awayId = this.activeMembers[1].id;
        }

        this.recentMatches = this.dataService.getMatches();
        this.disputedMatches = this.recentMatches.filter((m) => m.status === 'disputed');
        this.disputedMatchesCount = this.disputedMatches.length;

        if (this.disputedMatches.length) {
            this.disputedForm.homeScore = this.disputedMatches[0].homeScore;
            this.disputedForm.awayScore = this.disputedMatches[0].awayScore;
        }

        this.auditLogs = this.dataService.getAuditLogs();

        this.allTournaments = this.dataService.getTournaments();
        if (this.allTournaments.length && !this.selectedTournamentId) {
            this.selectedTournamentId = this.allTournaments[0].id;
        }
        if (this.selectedTournamentId) {
            this.loadTournamentDetail(this.selectedTournamentId);
        }

        this.setupRankChart();
    }

    private setupRankChart(): void {
        const counts = { 'A0': 0, 'A1': 0, 'A2': 0, 'A3': 0, 'A4': 0, 'A5': 0, 'A6': 0 };
        this.activeMembers.forEach((m) => {
            const tier = m.rankTier;

            if (counts[tier] !== undefined) {
                counts[tier]++;
            }
        });

        const documentStyle = getComputedStyle(document.documentElement);
        const textColor = documentStyle.getPropertyValue('--text-color') || '#495057';

        this.rankChartData = {
            labels: ['A0', 'A1', 'A2', 'A3', 'A4', 'A5', 'A6'],
            datasets: [
                {
                    data: [counts['A0'], counts['A1'], counts['A2'], counts['A3'], counts['A4'], counts['A5'], counts['A6']],
                    backgroundColor: [
                        '#EF5350',
                        '#FFA726',
                        '#D4E157',
                        '#66BB6A',
                        '#90CAF9',
                        '#42A5F5',
                        '#CED4DA'
                    ],
                    hoverBackgroundColor: [
                        '#E53935',
                        '#FF9800',
                        '#C0CA33',
                        '#4CAF50',
                        '#64B5F6',
                        '#2196F3',
                        '#ADB5BD'
                    ]
                }
            ]
        };

        this.rankChartOptions = {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: textColor,
                        usePointStyle: true,
                        font: {
                            size: 11
                        }
                    }
                }
            }
        };
    }
}
