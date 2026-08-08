import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { EvnictDataService } from '../evnict/domain/evnict-data.service';

@Component({
    selector: 'app-dashboard',
    standalone: true,
    imports: [CommonModule, RouterModule, ButtonModule],
    template: `
        <div class="dashboard-shell relative min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 flex flex-col justify-between overflow-hidden transition-colors duration-300">

            <!-- Animated premium background layers -->
            <div class="absolute inset-0 pointer-events-none" aria-hidden="true">
                <div class="dashboard-bg"></div>
                <div class="dashboard-energy"></div>
                <div class="dashboard-table"></div>
                <div class="dashboard-net"></div>
                <div class="dashboard-arc arc-a"></div>
                <div class="dashboard-arc arc-b"></div>
                <div class="dashboard-arc arc-c"></div>
                <div class="dashboard-paddle paddle-left"></div>
                <div class="dashboard-paddle paddle-right"></div>
                <div class="dashboard-ball ball-a"></div>
                <div class="dashboard-ball ball-b"></div>
            </div>

            <!-- Header logo section (Minimalist & Premium) -->
            <header class="w-full max-w-7xl mx-auto px-6 py-6 flex items-center justify-between z-10">
                <div class="flex items-center gap-3">
                    <div class="flex items-center justify-center">
                        <svg class="w-10 h-10" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <circle cx="50" cy="50" r="48" fill="#003580" />
                            <path d="M22 36C38 34 62 42 74 50C58 48 38 46 22 36Z" fill="#FFFFFF"/>
                            <path d="M22 50C42 50 68 50 78 50C68 50 42 50 22 50Z" stroke="#FFFFFF" stroke-width="6" stroke-linecap="round"/>
                            <path d="M22 64C38 66 62 58 74 50C58 52 38 54 22 64Z" fill="#FFFFFF"/>
                            <circle cx="78" cy="50" r="8" fill="#F47A20" />
                        </svg>
                    </div>
                    <span class="text-xl font-bold tracking-wider text-slate-900 dark:text-slate-100 uppercase">EVNICT Table Tennis</span>
                </div>
                <div class="flex items-center gap-4">
                    <span class="text-xs font-bold px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/60 text-slate-600 dark:text-slate-400">Version 2.0 MVP</span>
                </div>
            </header>

            <!-- Main Content Area -->
            <main class="w-full max-w-7xl mx-auto px-6 py-12 flex flex-col items-center justify-center flex-grow z-10 space-y-16">
                
                <!-- Hero Core Header -->
                <div class="text-center max-w-4xl space-y-6">
                    <span class="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-primary-500/10 border border-primary-500/20 text-primary tracking-wide uppercase">
                        <i class="pi pi-shield text-[10px]"></i> Hệ thống số hóa thể thao nội bộ
                    </span>
                    
                    <h1 class="text-5xl md:text-7xl font-black tracking-tight m-0 text-slate-900 dark:text-white leading-tight">
                        Cổng Quản Lý & Thi Đấu <br />
                        <span class="bg-clip-text text-transparent bg-gradient-to-r from-primary-600 via-primary-500 to-indigo-600 dark:from-primary-400 dark:via-primary-500 dark:to-indigo-400">
                            CLB Bóng Bàn EVNICT
                        </span>
                    </h1>
                    
                    <p class="text-base md:text-xl text-slate-600 dark:text-slate-350 max-w-2xl mx-auto leading-relaxed font-normal">
                        Hệ thống tự động hóa xếp hạng Elo, bốc thăm giải đấu đấu bảng, 
                        và theo dõi lịch sử đối đầu dành riêng cho cán bộ nhân viên EVNICT.
                    </p>
                </div>

                <!-- Glassmorphism Action Box (Center of the screen) -->
                <div class="w-full max-w-xl p-8 bg-white/90 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/80 rounded-3xl backdrop-blur-md shadow-2xl flex flex-col items-center text-center space-y-6">
                    
                    <!-- Conditional Render based on Login Session -->
                    <ng-container *ngIf="!isLoggedIn">
                        <div class="space-y-2">
                            <h3 class="text-xl font-bold text-slate-900 dark:text-slate-100 m-0">Yêu cầu đăng nhập hệ thống</h3>
                            <p class="text-sm text-slate-600 dark:text-slate-300 m-0 leading-relaxed font-normal">
                                Để tham gia thi đấu thách đấu, ghi nhận Elo, hoặc quản trị giải đấu, 
                                vui lòng đăng nhập bằng tài khoản thành viên của bạn.
                            </p>
                        </div>
                        <div class="flex flex-col sm:flex-row gap-4 w-full justify-center pt-2">
                            <button pButton label="Đăng Nhập Ngay" icon="pi pi-sign-in" 
                                    class="p-button-lg px-8 py-3 bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 border-none shadow-lg shadow-primary-500/20 font-bold" 
                                    routerLink="/auth/login"></button>
                            <button pButton label="Đăng Ký Thành Viên" icon="pi pi-user-plus" 
                                    class="p-button-outlined p-button-lg px-6 p-button-secondary border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-850 font-semibold" 
                                    routerLink="/auth/register"></button>
                        </div>
                        <div class="pt-2">
                            <a routerLink="/live" class="text-sm font-bold text-primary hover:underline flex items-center justify-center gap-1.5 cursor-pointer">
                                <i class="pi pi-trophy"></i> Xem Giải Đấu Đang Diễn Ra (Vãng Lai) →
                            </a>
                        </div>
                    </ng-container>

                    <ng-container *ngIf="isLoggedIn">
                        <div class="space-y-3">
                            <div class="flex justify-center mb-1">
                                <div class="w-14 h-14 bg-primary-500/10 border-2 border-primary-500/40 rounded-full flex items-center justify-center text-primary text-xl font-extrabold shadow-sm">
                                    {{ loggedInUserName.charAt(0) }}
                                </div>
                            </div>
                            <h3 class="text-xl font-extrabold text-slate-900 dark:text-slate-100 m-0">Chào mừng trở lại, {{ loggedInUserName }}!</h3>
                            <p class="text-xs text-slate-600 dark:text-slate-300 m-0 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-full inline-block font-bold">
                                Vai trò: <span class="text-primary">{{ getRoleLabel() }}</span>
                            </p>
                        </div>
                        
                        <div class="pt-2 w-full">
                            <button pButton label="TRUY CẬP HỆ THỐNG" icon="pi pi-arrow-right" 
                                    class="p-button-lg w-full py-3.5 bg-gradient-to-r from-primary-600 to-primary-700 border-none shadow-xl shadow-primary-500/15 font-extrabold tracking-wider uppercase hover:scale-[1.02] transition-transform" 
                                    (click)="accessApp()"></button>
                        </div>
                        
                        <button class="text-xs text-red-500 hover:text-red-600 bg-transparent border-none cursor-pointer hover:underline font-bold" (click)="logout()">
                            <i class="pi pi-power-off mr-1 text-[10px]"></i> Đăng xuất tài khoản
                        </button>
                    </ng-container>

                </div>

                <!-- 3 Pillars Grid -->
                <div class="grid grid-cols-1 md:grid-cols-3 gap-6 w-full pt-4">
                    
                    <div class="p-6 bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/80 rounded-2xl space-y-4 hover:border-primary-400 dark:hover:border-primary-600 hover:shadow-lg transition duration-300 group">
                        <div class="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center text-blue-600 dark:text-blue-400 group-hover:scale-115 transition-transform">
                            <i class="pi pi-trophy text-lg"></i>
                        </div>
                        <div class="space-y-2">
                            <h4 class="font-bold text-base text-slate-900 dark:text-slate-100 m-0">Xếp Hạng & Tính Elo Tự Động</h4>
                            <p class="text-sm text-slate-600 dark:text-slate-400 m-0 leading-relaxed font-normal">
                                Áp dụng công thức tính điểm Elo chuẩn quốc tế, tự động cập nhật điểm số và phân hạng rank của từng cầu thủ ngay sau mỗi trận đấu hợp lệ.
                            </p>
                        </div>
                    </div>

                    <div class="p-6 bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/80 rounded-2xl space-y-4 hover:border-primary-400 dark:hover:border-primary-600 hover:shadow-lg transition duration-300 group">
                        <div class="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-xl flex items-center justify-center text-green-600 dark:text-green-400 group-hover:scale-115 transition-transform">
                            <i class="pi pi-sitemap text-lg"></i>
                        </div>
                        <div class="space-y-2">
                            <h4 class="font-bold text-base text-slate-900 dark:text-slate-100 m-0">Quản Lý Giải Đấu Chuyên Nghiệp</h4>
                            <p class="text-sm text-slate-600 dark:text-slate-400 m-0 leading-relaxed font-normal">
                                Tự động bốc thăm ngẫu nhiên thông minh, lập lịch thi đấu vòng tròn hoặc đấu loại trực tiếp, cập nhật bảng xếp hạng trực tuyến tức thì.
                            </p>
                        </div>
                    </div>

                    <div class="p-6 bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/80 rounded-2xl space-y-4 hover:border-primary-400 dark:hover:border-primary-600 hover:shadow-lg transition duration-300 group">
                        <div class="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-xl flex items-center justify-center text-purple-600 dark:text-purple-400 group-hover:scale-115 transition-transform">
                            <i class="pi pi-bell text-lg"></i>
                        </div>
                        <div class="space-y-2">
                            <h4 class="font-bold text-base text-slate-900 dark:text-slate-100 m-0">Thông Báo & Lịch Sử Elo</h4>
                            <p class="text-sm text-slate-600 dark:text-slate-400 m-0 leading-relaxed font-normal">
                                Nhận thông báo thách đấu trực tuyến tức thì, xem lịch sử biến động điểm Elo chi tiết qua biểu đồ trực quan của cá nhân.
                            </p>
                        </div>
                    </div>

                </div>

            </main>

            <!-- Bottom dynamic statistics row (Footer aesthetic) -->
            <footer class="w-full border-t border-slate-200 dark:border-slate-900 bg-white/80 dark:bg-slate-950/80 backdrop-blur-sm z-10 py-6">
                <div class="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-500">
                    
                    <!-- Dynamic Counts -->
                    <div class="flex items-center gap-6 text-slate-700 dark:text-slate-400 font-bold bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 px-4 py-2.5 rounded-full shadow-sm">
                        <div class="flex items-center gap-1.5">
                            <span class="w-1.5 h-1.5 bg-green-500 rounded-full animate-ping"></span>
                            <span>{{ activeMembersCount }} Cầu thủ hoạt động</span>
                        </div>
                        <span class="text-slate-300 dark:text-slate-700">|</span>
                        <span>{{ totalMatchesCount }} Trận đấu hoàn thành</span>
                        <span class="text-slate-300 dark:text-slate-700">|</span>
                        <span>{{ tournamentsCount }} Giải đấu đã tổ chức</span>
                    </div>

                    <div>
                        <span class="font-medium text-slate-400 dark:text-slate-500">Hệ thống Quản lý CLB Bóng bàn EVNICT © 2026.</span>
                    </div>
                </div>
            </footer>

        </div>
    `,
    styles: [`
        :host {
            display: block;
        }

        .dashboard-shell {
            isolation: isolate;
        }

        .dashboard-bg,
        .dashboard-energy,
        .dashboard-table,
        .dashboard-net,
        .dashboard-arc,
        .dashboard-paddle,
        .dashboard-ball {
            position: absolute;
            inset: 0;
        }

        .dashboard-bg {
            inset: -15%;
            background:
                radial-gradient(circle at 12% 20%, rgba(14, 165, 233, 0.35), transparent 36%),
                radial-gradient(circle at 85% 14%, rgba(37, 99, 235, 0.27), transparent 34%),
                radial-gradient(circle at 50% 86%, rgba(251, 146, 60, 0.24), transparent 44%),
                linear-gradient(145deg, #f8fafc 0%, #e2e8f0 48%, #f1f5f9 100%);
            filter: saturate(114%);
        }

        .dashboard-energy {
            inset: -20%;
            background:
                conic-gradient(from 220deg at 16% 42%, rgba(14, 165, 233, 0.32), transparent 43%),
                conic-gradient(from 45deg at 82% 30%, rgba(37, 99, 235, 0.26), transparent 45%),
                conic-gradient(from 140deg at 52% 78%, rgba(249, 115, 22, 0.19), transparent 50%);
            mix-blend-mode: screen;
            filter: blur(42px);
            animation: stadiumSweep 22s ease-in-out infinite alternate;
        }

        .dashboard-table {
            inset: auto;
            left: 50%;
            bottom: -22%;
            width: min(1500px, 135vw);
            height: 68vh;
            transform: translateX(-50%) perspective(980px) rotateX(62deg);
            transform-origin: center bottom;
            border: 2px solid rgba(15, 23, 42, 0.12);
            border-radius: 28px;
            background:
                linear-gradient(180deg, rgba(2, 132, 199, 0.26) 0%, rgba(37, 99, 235, 0.16) 44%, rgba(15, 23, 42, 0.06) 100%),
                repeating-linear-gradient(90deg, rgba(255, 255, 255, 0.22) 0 2px, transparent 2px 74px),
                linear-gradient(90deg, transparent 49.5%, rgba(255, 255, 255, 0.58) 49.5% 50.5%, transparent 50.5% 100%);
            box-shadow:
                0 -28px 70px rgba(15, 23, 42, 0.16) inset,
                0 30px 80px rgba(59, 130, 246, 0.14);
            opacity: 0.9;
            animation: tableBreath 9s ease-in-out infinite;
        }

        .dashboard-net {
            inset: auto;
            left: 10%;
            right: 10%;
            top: 44%;
            height: 90px;
            border-top: 3px solid rgba(248, 250, 252, 0.72);
            background-image:
                linear-gradient(180deg, rgba(15, 23, 42, 0.14), transparent 70%),
                repeating-linear-gradient(90deg, rgba(148, 163, 184, 0.36) 0 1px, transparent 1px 12px),
                repeating-linear-gradient(0deg, rgba(148, 163, 184, 0.3) 0 1px, transparent 1px 10px);
            mask-image: linear-gradient(180deg, black 0%, black 60%, transparent 100%);
            opacity: 0.45;
            animation: netPulse 4.8s ease-in-out infinite;
        }

        .dashboard-arc {
            inset: auto;
            border-radius: 9999px;
            border-top: 2px dashed rgba(251, 146, 60, 0.55);
            border-left: 1px solid transparent;
            border-right: 1px solid transparent;
            border-bottom: none;
            transform-origin: center;
            opacity: 0.55;
            filter: drop-shadow(0 0 8px rgba(251, 146, 60, 0.3));
        }

        .arc-a {
            width: 42vw;
            max-width: 620px;
            height: 16vw;
            max-height: 240px;
            left: -6vw;
            top: 23%;
            animation: arcShiftA 8.5s ease-in-out infinite;
        }

        .arc-b {
            width: 38vw;
            max-width: 560px;
            height: 14vw;
            max-height: 210px;
            right: -4vw;
            top: 31%;
            border-top-color: rgba(59, 130, 246, 0.55);
            filter: drop-shadow(0 0 9px rgba(59, 130, 246, 0.25));
            animation: arcShiftB 7.8s ease-in-out infinite;
        }

        .arc-c {
            width: 34vw;
            max-width: 500px;
            height: 12vw;
            max-height: 180px;
            left: 32%;
            top: 18%;
            border-top-color: rgba(248, 113, 113, 0.4);
            filter: drop-shadow(0 0 10px rgba(248, 113, 113, 0.22));
            animation: arcShiftC 10s ease-in-out infinite;
        }

        .dashboard-paddle {
            inset: auto;
            width: 170px;
            height: 118px;
            border-radius: 56% 44% 52% 48% / 53% 47% 55% 45%;
            border: 3px solid rgba(255, 255, 255, 0.42);
            box-shadow:
                0 16px 28px rgba(15, 23, 42, 0.2),
                inset -8px -14px 18px rgba(15, 23, 42, 0.22),
                inset 6px 8px 14px rgba(255, 255, 255, 0.24);
            opacity: 0.44;
            backdrop-filter: blur(1px);
        }

        .dashboard-paddle::before {
            content: '';
            position: absolute;
            width: 28px;
            height: 122px;
            left: 50%;
            bottom: -94px;
            transform: translateX(-50%);
            border-radius: 18px;
            border: 2px solid rgba(30, 41, 59, 0.24);
            background:
                linear-gradient(180deg, #d6a57c 0%, #b36f42 46%, #7c3f1d 100%);
            box-shadow:
                inset 0 0 0 1px rgba(255, 255, 255, 0.26),
                0 10px 16px rgba(15, 23, 42, 0.2);
        }

        .dashboard-paddle::after {
            content: '';
            position: absolute;
            inset: 12px;
            border-radius: inherit;
            opacity: 0.45;
            background:
                repeating-linear-gradient(35deg, rgba(255, 255, 255, 0.22) 0 2px, transparent 2px 8px),
                radial-gradient(circle at 28% 26%, rgba(255, 255, 255, 0.32), transparent 42%);
            mix-blend-mode: soft-light;
        }

        .paddle-left {
            left: -28px;
            top: 38%;
            background:
                radial-gradient(circle at 26% 24%, rgba(255, 255, 255, 0.46) 0 12%, transparent 14%),
                linear-gradient(145deg, #fb923c 0%, #ef4444 54%, #b91c1c 100%);
            transform: rotate(-33deg) scale(0.95);
            animation: paddleSwingLeft 5.4s ease-in-out infinite;
        }

        .paddle-left::before {
            transform: translateX(-50%) rotate(8deg);
        }

        .paddle-right {
            right: -36px;
            top: 20%;
            background:
                radial-gradient(circle at 26% 24%, rgba(255, 255, 255, 0.44) 0 12%, transparent 14%),
                linear-gradient(145deg, #38bdf8 0%, #2563eb 56%, #1e3a8a 100%);
            transform: rotate(34deg) scale(0.92);
            animation: paddleSwingRight 6.3s ease-in-out infinite;
        }

        .paddle-right::before {
            transform: translateX(-50%) rotate(-7deg);
        }

        .dashboard-ball {
            inset: auto;
            width: 20px;
            height: 20px;
            border-radius: 9999px;
            box-shadow:
                0 0 0 4px rgba(255, 255, 255, 0.25),
                0 0 22px rgba(249, 115, 22, 0.55);
        }

        .ball-a {
            inset: auto;
            left: 8%;
            top: 38%;
            background: radial-gradient(circle at 28% 28%, #ffffff 0 30%, #fb923c 64%, #ea580c 100%);
            animation: pingPongA 4.8s cubic-bezier(0.45, 0.05, 0.55, 0.95) infinite;
        }

        .ball-b {
            inset: auto;
            width: 14px;
            height: 14px;
            right: 14%;
            top: 26%;
            background: radial-gradient(circle at 28% 28%, #ffffff 0 32%, #38bdf8 66%, #2563eb 100%);
            box-shadow:
                0 0 0 3px rgba(255, 255, 255, 0.2),
                0 0 20px rgba(56, 189, 248, 0.45);
            animation: pingPongB 6.2s cubic-bezier(0.45, 0.05, 0.55, 0.95) infinite;
        }

        :host-context(.dark) .dashboard-bg {
            background:
                radial-gradient(circle at 12% 20%, rgba(6, 182, 212, 0.28), transparent 39%),
                radial-gradient(circle at 85% 14%, rgba(37, 99, 235, 0.28), transparent 36%),
                radial-gradient(circle at 50% 86%, rgba(249, 115, 22, 0.2), transparent 45%),
                linear-gradient(140deg, #020617 0%, #0b1120 52%, #0f172a 100%);
        }

        :host-context(.dark) .dashboard-energy {
            mix-blend-mode: plus-lighter;
            opacity: 0.88;
        }

        :host-context(.dark) .dashboard-table {
            border-color: rgba(148, 163, 184, 0.2);
            background-image:
                linear-gradient(180deg, rgba(14, 116, 144, 0.34) 0%, rgba(30, 64, 175, 0.24) 42%, rgba(2, 6, 23, 0.18) 100%),
                repeating-linear-gradient(90deg, rgba(226, 232, 240, 0.17) 0 2px, transparent 2px 74px),
                linear-gradient(90deg, transparent 49.5%, rgba(226, 232, 240, 0.52) 49.5% 50.5%, transparent 50.5% 100%);
            box-shadow:
                0 -28px 72px rgba(2, 6, 23, 0.46) inset,
                0 26px 76px rgba(37, 99, 235, 0.18);
            opacity: 0.94;
        }

        :host-context(.dark) .dashboard-net {
            border-top-color: rgba(226, 232, 240, 0.62);
            background-image:
                linear-gradient(180deg, rgba(15, 23, 42, 0.2), transparent 70%),
                repeating-linear-gradient(90deg, rgba(148, 163, 184, 0.4) 0 1px, transparent 1px 12px),
                repeating-linear-gradient(0deg, rgba(148, 163, 184, 0.35) 0 1px, transparent 1px 10px);
            opacity: 0.56;
        }

        :host-context(.dark) .dashboard-paddle {
            border-color: rgba(226, 232, 240, 0.34);
            box-shadow:
                0 18px 34px rgba(2, 6, 23, 0.48),
                inset -10px -14px 20px rgba(2, 6, 23, 0.45),
                inset 7px 9px 16px rgba(148, 163, 184, 0.2);
            opacity: 0.56;
        }

        :host-context(.dark) .dashboard-paddle::before {
            border-color: rgba(148, 163, 184, 0.32);
            background:
                linear-gradient(180deg, #b98056 0%, #8b4f2e 46%, #5c2a17 100%);
        }

        @keyframes stadiumSweep {
            0% {
                transform: translate3d(-8%, -5%, 0) rotate(-4deg) scale(1);
            }
            50% {
                transform: translate3d(6%, 8%, 0) rotate(5deg) scale(1.12);
            }
            100% {
                transform: translate3d(-2%, 11%, 0) rotate(-2deg) scale(1.04);
            }
        }

        @keyframes tableBreath {
            0%,
            100% {
                transform: translateX(-50%) perspective(980px) rotateX(62deg) scale(1);
            }
            50% {
                transform: translateX(-50%) perspective(980px) rotateX(62deg) scale(1.015);
            }
        }

        @keyframes netPulse {
            0%,
            100% {
                opacity: 0.38;
            }
            50% {
                opacity: 0.62;
            }
        }

        @keyframes arcShiftA {
            0%,
            100% {
                transform: translate3d(0, 0, 0) rotate(-2deg);
                opacity: 0.52;
            }
            50% {
                transform: translate3d(2vw, -1vh, 0) rotate(1deg);
                opacity: 0.7;
            }
        }

        @keyframes arcShiftB {
            0%,
            100% {
                transform: translate3d(0, 0, 0) rotate(1deg);
                opacity: 0.48;
            }
            50% {
                transform: translate3d(-2vw, -1vh, 0) rotate(-2deg);
                opacity: 0.68;
            }
        }

        @keyframes arcShiftC {
            0%,
            100% {
                transform: translate3d(0, 0, 0) scale(1);
                opacity: 0.38;
            }
            50% {
                transform: translate3d(0, -0.8vh, 0) scale(1.03);
                opacity: 0.56;
            }
        }

        @keyframes pingPongA {
            0% {
                transform: translate3d(0, 0, 0) scale(0.84);
            }
            18% {
                transform: translate3d(22vw, -12vh, 0) scale(1);
            }
            35% {
                transform: translate3d(44vw, 5vh, 0) scale(0.92);
            }
            52% {
                transform: translate3d(61vw, -8vh, 0) scale(1);
            }
            70% {
                transform: translate3d(78vw, 4vh, 0) scale(0.9);
            }
            100% {
                transform: translate3d(96vw, -10vh, 0) scale(0.86);
            }
        }

        @keyframes pingPongB {
            0% {
                transform: translate3d(0, 0, 0) scale(0.92);
            }
            22% {
                transform: translate3d(-20vw, 8vh, 0) scale(0.82);
            }
            48% {
                transform: translate3d(-41vw, -10vh, 0) scale(1);
            }
            72% {
                transform: translate3d(-63vw, 7vh, 0) scale(0.84);
            }
            100% {
                transform: translate3d(-84vw, -6vh, 0) scale(0.94);
            }
        }

        @keyframes paddleSwingLeft {
            0%,
            100% {
                transform: rotate(-33deg) translate3d(0, 0, 0) scale(0.95);
            }
            50% {
                transform: rotate(-28deg) translate3d(0, -6px, 0) scale(0.98);
            }
        }

        @keyframes paddleSwingRight {
            0%,
            100% {
                transform: rotate(34deg) translate3d(0, 0, 0) scale(0.92);
            }
            50% {
                transform: rotate(28deg) translate3d(0, 6px, 0) scale(0.95);
            }
        }

        @media (max-width: 768px) {
            .dashboard-net {
                left: 4%;
                right: 4%;
                top: 42%;
                height: 74px;
            }

            .dashboard-table {
                bottom: -26%;
                width: 150vw;
                height: 58vh;
            }

            .dashboard-arc {
                border-top-width: 1.5px;
                opacity: 0.4;
            }

            .arc-c {
                display: none;
            }

            .dashboard-ball {
                width: 15px;
                height: 15px;
            }

            .ball-b {
                width: 11px;
                height: 11px;
            }

            .dashboard-paddle {
                width: 124px;
                height: 88px;
                opacity: 0.34;
            }

            .dashboard-paddle::before {
                width: 22px;
                height: 90px;
                bottom: -70px;
            }

            .paddle-right {
                right: -54px;
                top: 16%;
            }
        }

        @media (prefers-reduced-motion: reduce) {
            .dashboard-energy,
            .dashboard-table,
            .dashboard-net,
            .dashboard-arc,
            .dashboard-paddle,
            .dashboard-ball {
                animation: none !important;
            }
        }
    `]
})
export class Dashboard implements OnInit {
    isLoggedIn = false;
    loggedInUserName = '';
    loggedInUserRole: string[] = [];

    activeMembersCount = 0;
    totalMatchesCount = 0;
    tournamentsCount = 0;

    constructor(
        private readonly dataService: EvnictDataService,
        private readonly router: Router
    ) { }

    ngOnInit(): void {
        const loggedInId = this.dataService.getLoggedInUserId();
        this.isLoggedIn = !!loggedInId;
        if (loggedInId) {
            const user = this.dataService.getMemberById(loggedInId);
            if (user) {
                this.loggedInUserName = user.fullName;
                this.loggedInUserRole = user.roles;
            }
        }

        // Load stats
        const members = this.dataService.getMembers();
        this.activeMembersCount = members.filter(m => m.isActive).length;

        const allMatches = this.dataService.getMatches();
        this.totalMatchesCount = allMatches.filter(m => m.status === 'confirmed' || m.status === 'walkover').length;

        this.tournamentsCount = this.dataService.getTournaments().length;
    }

    getRoleLabel(): string {
        if (this.loggedInUserRole.includes('admin')) {
            return 'Admin Quản trị viên';
        }
        if (this.loggedInUserRole.includes('captain')) {
            return 'Đội trưởng CLB';
        }
        return 'Thành viên Cầu thủ';
    }

    accessApp(): void {
        if (this.loggedInUserRole.includes('admin')) {
            this.router.navigate(['/admin']);
        } else {
            this.router.navigate(['/user']);
        }
    }

    logout(): void {
        this.dataService.logout();
        this.isLoggedIn = false;
        this.loggedInUserName = '';
        this.loggedInUserRole = [];
        this.router.navigate(['/']);
    }
}
