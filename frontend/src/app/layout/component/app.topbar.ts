import { Component, inject } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { LayoutService } from '@/app/layout/service/layout.service';
import { EvnictDataService } from '../../pages/evnict/domain/evnict-data.service';

@Component({
    selector: 'app-topbar',
    standalone: true,
    imports: [RouterModule, CommonModule, FormsModule, DialogModule],
    template: ` <div class="layout-topbar">
        <div class="layout-topbar-logo-container">
            <a class="layout-topbar-logo" routerLink="/">
                <!-- EVN Logo SVG -->
                <svg class="w-8 h-8" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style="display: inline-block; vertical-align: middle;">
                    <circle cx="50" cy="50" r="48" fill="#003580" />
                    <path d="M22 36C38 34 62 42 74 50C58 48 38 46 22 36Z" fill="#FFFFFF"/>
                    <path d="M22 50C42 50 68 50 78 50C68 50 42 50 22 50Z" stroke="#FFFFFF" stroke-width="6" stroke-linecap="round"/>
                    <path d="M22 64C38 66 62 58 74 50C58 52 38 54 22 64Z" fill="#FFFFFF"/>
                    <circle cx="78" cy="50" r="8" fill="#F47A20" />
                </svg>
                <span class="font-black text-slate-900 dark:text-slate-100 uppercase tracking-wider ml-2">EVNICT Table Tennis</span>
            </a>
        </div>

        <!-- Unified Horizontal Navigation Menu -->
        <div class="flex items-center gap-6 ml-8">
            <a *ngIf="!isLoggedIn()" routerLink="/" class="text-sm font-semibold hover:text-primary transition no-underline text-slate-700 dark:text-slate-350 flex items-center"
               [class.text-primary]="router.url === '/'" [class.font-bold]="router.url === '/'">
                <i class="pi pi-home mr-1"></i> Trang Chủ
            </a>

            <!-- Admin Menus -->
            <ng-container *ngIf="isAdmin() && isCurrentRouteAdmin()">
                <a routerLink="/admin" [queryParams]="{tab: 'members'}" class="text-sm font-semibold hover:text-primary transition no-underline text-slate-700 dark:text-slate-300 flex items-center"
                   [class.text-primary]="isActiveTab('/admin', 'members')" [class.font-bold]="isActiveTab('/admin', 'members')">
                    <i class="pi pi-users mr-1"></i> Thành Viên
                </a>
                <a routerLink="/admin" [queryParams]="{tab: 'matches'}" class="text-sm font-semibold hover:text-primary transition no-underline text-slate-700 dark:text-slate-300 flex items-center"
                   [class.text-primary]="isActiveTab('/admin', 'matches')" [class.font-bold]="isActiveTab('/admin', 'matches')">
                    <i class="pi pi-check-circle mr-1"></i> Kết Quả & Tranh Chấp
                </a>
                <a routerLink="/admin" [queryParams]="{tab: 'tournaments'}" class="text-sm font-semibold hover:text-primary transition no-underline text-slate-700 dark:text-slate-300 flex items-center"
                   [class.text-primary]="isActiveTab('/admin', 'tournaments')" [class.font-bold]="isActiveTab('/admin', 'tournaments')">
                    <i class="pi pi-trophy mr-1"></i> Giải Đấu Engine
                </a>

                <a routerLink="/admin" [queryParams]="{tab: 'audit'}" class="text-sm font-semibold hover:text-primary transition no-underline text-slate-700 dark:text-slate-300 flex items-center"
                   [class.text-primary]="isActiveTab('/admin', 'audit')" [class.font-bold]="isActiveTab('/admin', 'audit')">
                    <i class="pi pi-shield mr-1"></i> Audit Logs
                </a>
            </ng-container>

            <!-- User/Player Menus -->
            <ng-container *ngIf="isPlayer() && isCurrentRouteUser()">
                <a routerLink="/user" [queryParams]="{tab: 'challenges'}" class="text-sm font-semibold hover:text-primary transition no-underline text-slate-700 dark:text-slate-300 flex items-center"
                   [class.text-primary]="isActiveTab('/user', 'challenges')" [class.font-bold]="isActiveTab('/user', 'challenges')">
                    <i class="pi pi-bolt mr-1"></i> Thách Đấu & Ghi Nhận
                </a>
                <a routerLink="/user" [queryParams]="{tab: 'matches'}" class="text-sm font-semibold hover:text-primary transition no-underline text-slate-700 dark:text-slate-300 flex items-center"
                   [class.text-primary]="isActiveTab('/user', 'matches')" [class.font-bold]="isActiveTab('/user', 'matches')">
                    <i class="pi pi-user mr-1"></i> Trận Đấu & Elo
                </a>
                <a routerLink="/user" [queryParams]="{tab: 'tournaments'}" class="text-sm font-semibold hover:text-primary transition no-underline text-slate-700 dark:text-slate-300 flex items-center"
                   [class.text-primary]="isActiveTab('/user', 'tournaments')" [class.font-bold]="isActiveTab('/user', 'tournaments')">
                    <i class="pi pi-trophy mr-1"></i> Giải Đấu
                </a>
            </ng-container>

        </div>

        <div class="layout-topbar-actions ml-auto">
            <div class="layout-config-menu">
                <button type="button" class="layout-topbar-action" (click)="toggleDarkMode()">
                    <i [ngClass]="{ 'pi ': true, 'pi-moon': layoutService.isDarkTheme(), 'pi-sun': !layoutService.isDarkTheme() }"></i>
                </button>
            </div>

            <div class="layout-topbar-menu hidden lg:block">
                <div class="layout-topbar-menu-content flex items-center gap-3">
                    <ng-container *ngIf="isLoggedIn()">
                        <!-- Portal Switcher for users with both roles -->
                        <ng-container *ngIf="hasBothRoles()">
                            <a *ngIf="isCurrentRouteAdmin()" routerLink="/user" class="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-650 dark:bg-indigo-950/40 dark:text-indigo-400 rounded-lg text-xs font-bold transition flex items-center gap-1 no-underline border-none cursor-pointer">
                                <i class="pi pi-user text-[10px]"></i> Cổng Thành Viên
                            </a>
                            <a *ngIf="isCurrentRouteUser()" routerLink="/admin" class="px-3 py-1.5 bg-orange-50 hover:bg-orange-100 text-orange-650 dark:bg-orange-950/40 dark:text-orange-400 rounded-lg text-xs font-bold transition flex items-center gap-1 no-underline border-none cursor-pointer">
                                <i class="pi pi-cog text-[10px]"></i> Cổng Quản Trị
                            </a>
                        </ng-container>

                        <!-- Bell Notification Button -->
                        <div class="relative" *ngIf="!isCurrentRouteUser()">
                            <button type="button" class="layout-topbar-action relative" (click)="openNotifications()">
                                <i class="pi pi-bell"></i>
                                <span *ngIf="getUnreadCount() > 0" class="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-white dark:border-slate-950 animate-pulse"></span>
                                <span>Thông báo</span>
                            </button>
                        </div>

                        <div class="text-xs font-bold text-slate-700 dark:text-slate-350 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-full">
                            Chào, <span class="text-primary font-extrabold">{{ getUserName() }}</span>!
                        </div>
                        <button type="button" class="layout-topbar-action" (click)="openChangePasswordDialog()">
                            <i class="pi pi-key"></i>
                            <span>Đổi mật khẩu</span>
                        </button>
                        <button type="button" class="layout-topbar-action text-red-500" (click)="logout()">
                            <i class="pi pi-sign-out text-red-500"></i>
                            <span>Đăng xuất</span>
                        </button>
                    </ng-container>
                    <ng-container *ngIf="!isLoggedIn()">
                        <button type="button" class="layout-topbar-action" routerLink="/auth/login">
                            <i class="pi pi-sign-in"></i>
                            <span>Đăng nhập</span>
                        </button>
                    </ng-container>
                </div>
            </div>
        </div>

        <!-- Notifications Dialog (Replacing functional page with modal tray) -->
        <p-dialog [(visible)]="showNotificationsDialog" [modal]="true" [header]="'Hộp thư thông báo (' + getUnreadCount() + ' chưa đọc)'" [style]="{ width: '450px' }" [draggable]="false" [resizable]="false" [appendTo]="'body'">
            <div class="space-y-4 pt-2">
                <div class="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3" *ngIf="getNotifications().length > 0">
                    <span class="text-xs text-slate-500 dark:text-slate-400 font-medium">Danh sách thông báo của bạn</span>
                    <button class="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 border border-slate-300 dark:bg-slate-800 dark:border-slate-700 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded text-xs font-bold transition cursor-pointer" (click)="markAllAsRead()">
                        Đánh dấu đã đọc tất cả
                    </button>
                </div>

                <ul class="space-y-2.5 max-h-[350px] overflow-auto m-0 p-0 list-none">
                    <li *ngFor="let notice of getNotifications()" class="p-3 border rounded-xl flex items-start gap-3 transition-all" [class.bg-white]="notice.isRead" [class.border-slate-200]="notice.isRead" [class.bg-blue-50/10]="!notice.isRead" [class.border-blue-200]="!notice.isRead">
                        <div class="mt-0.5">
                            <i class="pi" [class.pi-envelope]="notice.isRead" [class.pi-envelope-open]="!notice.isRead" [class.text-blue-500]="!notice.isRead" [class.text-slate-400]="notice.isRead"></i>
                        </div>
                        <div class="flex-grow">
                            <div class="font-bold text-sm flex items-center justify-between">
                                <span class="text-slate-900 dark:text-slate-100">{{ notice.title }}</span>
                                <span *ngIf="!notice.isRead" class="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
                            </div>
                            <p class="m-0 text-slate-600 dark:text-slate-400 text-xs mt-1 leading-relaxed">{{ notice.content }}</p>
                            <small class="text-slate-400 dark:text-slate-500 block mt-1.5"><i class="pi pi-clock mr-1 text-[10px]"></i>{{ notice.createdAt | date: 'dd/MM HH:mm' }}</small>
                        </div>
                    </li>
                    <li *ngIf="!getNotifications().length" class="text-center text-slate-500 py-8 font-semibold text-sm">
                        <i class="pi pi-inbox block text-3xl mb-2 text-slate-300"></i>
                        Không có thông báo nào.
                    </li>
                </ul>
            </div>
        </p-dialog>

        <p-dialog
            [(visible)]="showChangePasswordDialog"
            [modal]="true"
            header="Đổi mật khẩu"
            [style]="{ width: '420px' }"
            [draggable]="false"
            [resizable]="false"
            [appendTo]="'body'"
        >
            <div class="space-y-3 pt-1">
                <div>
                    <label class="block mb-1 text-sm font-medium">Mật khẩu hiện tại</label>
                    <input
                        type="password"
                        class="w-full p-2 border border-surface-300 dark:border-surface-600 rounded bg-surface-0 dark:bg-surface-900"
                        [(ngModel)]="passwordForm.currentPassword"
                    />
                </div>
                <div>
                    <label class="block mb-1 text-sm font-medium">Mật khẩu mới</label>
                    <input
                        type="password"
                        class="w-full p-2 border border-surface-300 dark:border-surface-600 rounded bg-surface-0 dark:bg-surface-900"
                        [(ngModel)]="passwordForm.newPassword"
                    />
                </div>
                <div>
                    <label class="block mb-1 text-sm font-medium">Nhập lại mật khẩu mới</label>
                    <input
                        type="password"
                        class="w-full p-2 border border-surface-300 dark:border-surface-600 rounded bg-surface-0 dark:bg-surface-900"
                        [(ngModel)]="passwordForm.confirmPassword"
                    />
                </div>
                <button type="button" class="w-full px-4 py-2 bg-indigo-600 text-white rounded font-medium hover:bg-indigo-700 transition" (click)="submitPasswordChange()">
                    Cập nhật mật khẩu
                </button>
                <p class="text-sm mt-1" [class.text-red-500]="passwordChangeError" [class.text-green-600]="!passwordChangeError">
                    {{ passwordChangeMessage }}
                </p>
            </div>
        </p-dialog>
    </div>`
})
export class AppTopbar {
    layoutService = inject(LayoutService);
    dataService = inject(EvnictDataService);
    router = inject(Router);

    showNotificationsDialog = false;
    showChangePasswordDialog = false;
    passwordForm = {
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
    };
    passwordChangeMessage = 'Bạn nên cập nhật mật khẩu định kỳ để bảo vệ tài khoản.';
    passwordChangeError = false;

    getNotifications() {
        const id = this.dataService.getLoggedInUserId();
        if (!id) return [];
        return this.dataService.getNotifications(id);
    }

    getUnreadCount(): number {
        return this.getNotifications().filter((n) => !n.isRead).length;
    }

    openNotifications(): void {
        this.showNotificationsDialog = true;
    }

    openChangePasswordDialog(): void {
        this.showChangePasswordDialog = true;
        this.passwordChangeError = false;
        this.passwordChangeMessage = 'Bạn nên cập nhật mật khẩu định kỳ để bảo vệ tài khoản.';
        this.passwordForm = {
            currentPassword: '',
            newPassword: '',
            confirmPassword: ''
        };
    }

    async submitPasswordChange(): Promise<void> {
        const userId = this.dataService.getLoggedInUserId();
        if (!userId) {
            this.passwordChangeError = true;
            this.passwordChangeMessage = 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
            return;
        }

        const currentPassword = this.passwordForm.currentPassword.trim();
        const newPassword = this.passwordForm.newPassword.trim();
        const confirmPassword = this.passwordForm.confirmPassword.trim();

        if (!currentPassword || !newPassword || !confirmPassword) {
            this.passwordChangeError = true;
            this.passwordChangeMessage = 'Vui lòng nhập đầy đủ các trường mật khẩu.';
            return;
        }

        if (newPassword.length < 6) {
            this.passwordChangeError = true;
            this.passwordChangeMessage = 'Mật khẩu mới cần tối thiểu 6 ký tự.';
            return;
        }

        if (newPassword !== confirmPassword) {
            this.passwordChangeError = true;
            this.passwordChangeMessage = 'Mật khẩu xác nhận không khớp.';
            return;
        }

        if (currentPassword === newPassword) {
            this.passwordChangeError = true;
            this.passwordChangeMessage = 'Mật khẩu mới phải khác mật khẩu hiện tại.';
            return;
        }

        try {
            await this.dataService.changePassword(userId, currentPassword, newPassword);
            this.passwordChangeError = false;
            this.passwordChangeMessage = 'Đổi mật khẩu thành công.';
            this.passwordForm = {
                currentPassword: '',
                newPassword: '',
                confirmPassword: ''
            };
        } catch (error: any) {
            this.passwordChangeError = true;
            this.passwordChangeMessage = error?.error || 'Không thể đổi mật khẩu. Vui lòng kiểm tra mật khẩu hiện tại.';
        }
    }

    markAllAsRead(): void {
        const id = this.dataService.getLoggedInUserId();
        if (id) {
            this.dataService.markAllNotificationsAsRead(id);
        }
    }

    isLoggedIn(): boolean {
        return !!this.dataService.getLoggedInUserId();
    }

    isAdmin(): boolean {
        const id = this.dataService.getLoggedInUserId();
        if (!id) return false;
        return this.dataService.getMemberById(id)?.roles.includes('admin') ?? false;
    }

    isPlayer(): boolean {
        const id = this.dataService.getLoggedInUserId();
        if (!id) return false;
        return this.dataService.getMemberById(id)?.roles.includes('player') ?? false;
    }

    hasBothRoles(): boolean {
        const id = this.dataService.getLoggedInUserId();
        if (!id) return false;
        const roles = this.dataService.getMemberById(id)?.roles ?? [];
        return roles.includes('admin') && (roles.includes('player') || roles.includes('referee'));
    }

    isCurrentRouteAdmin(): boolean {
        return this.router.url.startsWith('/admin');
    }

    isCurrentRouteUser(): boolean {
        return this.router.url.startsWith('/user');
    }

    getUserName(): string {
        const id = this.dataService.getLoggedInUserId();
        if (!id) return '';
        return this.dataService.getMemberById(id)?.fullName ?? '';
    }

    isActiveTab(path: string, tab: string): boolean {
        const url = this.router.url;
        if (!url.startsWith(path)) {
            return false;
        }
        if (url.includes(`tab=${tab}`)) {
            return true;
        }
        // If there's no tab query param in the URL, return true for the default tab
        if (!url.includes('tab=')) {
            if (path === '/admin' && tab === 'members') return true;
            if (path === '/user' && tab === 'challenges') return true;
        }
        return false;
    }

    logout(): void {
        this.dataService.logout();
        this.router.navigate(['/']);
    }

    toggleDarkMode() {
        this.layoutService.layoutConfig.update((state) => ({
            ...state,
            darkTheme: !state.darkTheme
        }));
    }
}
