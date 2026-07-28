import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { RippleModule } from 'primeng/ripple';
import { AppFloatingConfigurator } from '../../layout/component/app.floatingconfigurator';
import { CommonModule } from '@angular/common';
import { EvnictDataService } from '../evnict/domain/evnict-data.service';

@Component({
    selector: 'app-login',
    standalone: true,
    imports: [ButtonModule, CheckboxModule, InputTextModule, PasswordModule, FormsModule, RouterModule, RippleModule, AppFloatingConfigurator, CommonModule],
    template: `
        <app-floating-configurator />
        <div class="bg-surface-50 dark:bg-surface-950 min-h-screen min-w-screen overflow-hidden">
            <div class="mx-auto w-full max-w-6xl px-4 sm:px-8 pt-6">
                <div class="flex items-center justify-between rounded-2xl border border-slate-200/80 dark:border-slate-700/80 bg-white/90 dark:bg-slate-900/85 backdrop-blur-sm px-4 sm:px-6 py-3 shadow-sm">
                    <a routerLink="/" class="no-underline flex items-center gap-3">
                        <svg class="w-9 h-9" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                            <circle cx="50" cy="50" r="48" fill="#003580" />
                            <path d="M22 36C38 34 62 42 74 50C58 48 38 46 22 36Z" fill="#FFFFFF" />
                            <path d="M22 50C42 50 68 50 78 50C68 50 42 50 22 50Z" stroke="#FFFFFF" stroke-width="6" stroke-linecap="round" />
                            <path d="M22 64C38 66 62 58 74 50C58 52 38 54 22 64Z" fill="#FFFFFF" />
                            <circle cx="78" cy="50" r="8" fill="#F47A20" />
                        </svg>
                        <div class="text-slate-900 dark:text-slate-100 font-black tracking-wide text-base sm:text-lg">CLB BÓNG BÀN EVNICT</div>
                    </a>
                    <div class="flex items-center gap-2">
                        <button pButton type="button" label="Trang giới thiệu" [text]="true" class="text-sm" routerLink="/"></button>
                        <button pButton type="button" label="Đăng ký" [outlined]="true" class="text-sm" routerLink="/auth/register"></button>
                    </div>
                </div>
            </div>

            <div class="flex items-center justify-center px-4 pt-8 pb-12">
                <div class="flex flex-col items-center justify-center">
                    <div style="border-radius: 56px; padding: 0.3rem; background: linear-gradient(180deg, var(--primary-color) 10%, rgba(33, 150, 243, 0) 30%)">
                    <div class="w-full bg-surface-0 dark:bg-surface-900 py-20 px-8 sm:px-20" style="border-radius: 53px">
                        <div class="text-center mb-8">
                            <div class="text-3xl font-extrabold text-slate-900 dark:text-slate-100 mb-4 tracking-tight">CLB BÓNG BÀN EVNICT</div>
                            <span class="text-muted-color font-semibold">Vui lòng đăng nhập hệ thống nội bộ</span>
                        </div>

                        <div>
                            <label for="loginIdentifier" class="block text-slate-800 dark:text-slate-200 text-sm font-bold mb-2">Username hoặc Email</label>
                            <input id="loginIdentifier" type="text" placeholder="vd: ninhtv.evnit hoặc ninhtv.evnit@evn.com.vn" class="w-full md:w-30rem mb-4 p-2.5 border rounded bg-surface-0 dark:bg-surface-900 text-sm" [(ngModel)]="loginIdentifier" />

                            <label for="password1" class="block text-slate-800 dark:text-slate-200 text-sm font-bold mb-2">Mật khẩu</label>
                            <input id="password1" type="password" placeholder="Mật khẩu" class="w-full md:w-30rem mb-4 p-2.5 border rounded bg-surface-0 dark:bg-surface-900 text-sm" [(ngModel)]="password" />

                            <div class="flex items-center justify-between mb-6 gap-8">
                                <div class="flex items-center">
                                    <p-checkbox id="rememberme" [binary]="true" [(ngModel)]="checked" class="mr-2" />
                                    <label for="rememberme" class="text-sm">Ghi nhớ đăng nhập</label>
                                </div>
                                <a class="text-primary text-sm font-bold no-underline cursor-pointer">Quên mật khẩu?</a>
                            </div>

                            <div class="text-red-500 text-xs font-bold mb-4" *ngIf="errorMessage">
                                {{ errorMessage }}
                            </div>

                            <button pButton pRipple label="ĐĂNG NHẬP" class="w-full font-bold py-3 text-sm" (click)="signIn()"></button>

                            <div class="text-center mt-6">
                                <span class="text-muted-color text-sm">Chưa có tài khoản? </span>
                                <a routerLink="/auth/register" class="text-primary text-sm font-bold no-underline hover:underline cursor-pointer">Đăng ký thành viên</a>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `
})
export class Login implements OnInit {
    loginIdentifier: string = 'ninhtv.evnit@evn.com.vn'; // Prefill for easy testing
    password: string = '123456';
    checked: boolean = false;
    errorMessage: string = '';

    constructor(
        private readonly dataService: EvnictDataService,
        private readonly router: Router
    ) {}

    ngOnInit(): void {
        if (this.dataService.getLoggedInUserId()) {
            this.router.navigate(['/']);
        }
    }

    signIn(): void {
        if (!this.loginIdentifier) {
            this.errorMessage = 'Vui lòng nhập Username hoặc Email.';
            return;
        }

        try {
            this.dataService.login(this.loginIdentifier, this.password);
            this.errorMessage = '';
            this.router.navigate(['/']);
        } catch (err: any) {
            this.errorMessage = err.message || 'Lỗi đăng nhập.';
        }
    }
}

