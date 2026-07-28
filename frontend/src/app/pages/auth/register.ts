import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { RippleModule } from 'primeng/ripple';
import { AppFloatingConfigurator } from '../../layout/component/app.floatingconfigurator';
import { EvnictDataService } from '../evnict/domain/evnict-data.service';
import { CommonModule } from '@angular/common';

@Component({
    selector: 'app-register',
    standalone: true,
    imports: [FormsModule, RouterModule, ButtonModule, InputTextModule, PasswordModule, RippleModule, AppFloatingConfigurator, CommonModule],
    template: `
        <app-floating-configurator />
        <div class="bg-surface-50 dark:bg-surface-950 min-h-screen min-w-screen overflow-hidden pb-12">
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
                        <button pButton type="button" label="Đăng nhập" [outlined]="true" class="text-sm" routerLink="/auth/login"></button>
                    </div>
                </div>
            </div>

            <div class="flex items-center justify-center pt-8 px-4">
                <div class="flex flex-col items-center justify-center w-full max-w-4xl">
                    <div class="w-full" style="border-radius: 40px; padding: 0.3rem; background: linear-gradient(180deg, var(--primary-color) 10%, rgba(33, 150, 243, 0) 30%)">
                    <div class="bg-surface-0 dark:bg-surface-900 py-12 px-6 sm:px-12 w-full" style="border-radius: 37px">
                        <div class="text-center mb-8">
                            <div class="text-3xl font-extrabold text-slate-900 dark:text-slate-100 mb-4 tracking-tight">ĐĂNG KÝ THÀNH VIÊN EVNICT</div>
                            <span class="text-muted-color font-semibold">Tạo tài khoản mới để theo dõi điểm Elo và tham gia giải đấu</span>
                        </div>

                        <div class="grid grid-cols-12 gap-5">
                            <div class="col-span-12 md:col-span-6">
                                <label for="reg-name" class="block text-slate-800 dark:text-slate-200 text-sm font-bold mb-2">Họ và tên *</label>
                                <input id="reg-name" type="text" placeholder="Nguyễn Văn A" class="w-full p-2.5 border rounded bg-surface-0 dark:bg-surface-900 text-sm" [(ngModel)]="form.fullName" />
                            </div>

                            <div class="col-span-12 md:col-span-6">
                                <label for="reg-username" class="block text-slate-800 dark:text-slate-200 text-sm font-bold mb-2">Username *</label>
                                <input id="reg-username" type="text" placeholder="vd: ninhtv.evnit" class="w-full p-2.5 border rounded bg-surface-0 dark:bg-surface-900 text-sm" [(ngModel)]="form.username" />
                            </div>

                            <div class="col-span-12 md:col-span-6">
                                <label for="reg-email" class="block text-slate-800 dark:text-slate-200 text-sm font-bold mb-2">Email *</label>
                                <input id="reg-email" type="text" placeholder="username@evnict.vn" class="w-full p-2.5 border rounded bg-surface-0 dark:bg-surface-900 text-sm" [(ngModel)]="form.email" />
                            </div>

                            <div class="col-span-12 md:col-span-6">
                                <label for="reg-pwd" class="block text-slate-800 dark:text-slate-200 text-sm font-bold mb-2">Mật khẩu *</label>
                                <input id="reg-pwd" type="password" placeholder="Nhập mật khẩu" class="w-full p-2.5 border rounded bg-surface-0 dark:bg-surface-900 text-sm" [(ngModel)]="form.password" />
                            </div>

                            <div class="col-span-12 md:col-span-6">
                                <label for="reg-conf-pwd" class="block text-slate-800 dark:text-slate-200 text-sm font-bold mb-2">Xác nhận mật khẩu *</label>
                                <input id="reg-conf-pwd" type="password" placeholder="Xác nhận mật khẩu" class="w-full p-2.5 border rounded bg-surface-0 dark:bg-surface-900 text-sm" [(ngModel)]="form.confirmPassword" />
                            </div>

                            <div class="col-span-12 md:col-span-6">
                                <label for="reg-dept" class="block text-slate-800 dark:text-slate-200 text-sm font-bold mb-2">Phòng/Ban</label>
                                <input id="reg-dept" type="text" placeholder="Phòng CNTT" class="w-full p-2.5 border rounded bg-surface-0 dark:bg-surface-900 text-sm" [(ngModel)]="form.department" />
                            </div>

                            <div class="col-span-12 md:col-span-3">
                                <label for="reg-gender" class="block text-slate-800 dark:text-slate-200 text-sm font-bold mb-2">Giới tính</label>
                                <select id="reg-gender" class="w-full p-2.5 border rounded bg-surface-0 dark:bg-surface-900 text-sm" [(ngModel)]="form.gender">
                                    <option value="Nam">Nam</option>
                                    <option value="Nữ">Nữ</option>
                                </select>
                            </div>

                            <div class="col-span-12 md:col-span-3">
                                <label for="reg-phone" class="block text-slate-800 dark:text-slate-200 text-sm font-bold mb-2">Số điện thoại</label>
                                <input id="reg-phone" type="text" placeholder="0901234567" class="w-full p-2.5 border rounded bg-surface-0 dark:bg-surface-900 text-sm" [(ngModel)]="form.phone" />
                            </div>
                        </div>

                        <div class="text-sm mt-5" [class.text-red-500]="isError" [class.text-green-600]="!isError">
                            {{ message }}
                        </div>

                        <div class="flex flex-col sm:flex-row gap-3 mt-6">
                            <button pButton pRipple label="ĐĂNG KÝ NGAY" class="flex-1 font-bold py-3 text-sm" (click)="register()"></button>
                            <button pButton pRipple label="QUAY LẠI ĐĂNG NHẬP" severity="secondary" [outlined]="true" class="flex-1 font-bold py-3 text-sm" routerLink="/auth/login"></button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `
})
export class Register {
    form = {
        fullName: '',
        username: '',
        email: '',
        password: '',
        confirmPassword: '',
        department: '',
        gender: 'Nam',
        phone: ''
    };

    message = 'Thông tin đăng ký sẽ được duyệt bởi Ban quản trị CLB.';
    isError = false;

    constructor(private readonly dataService: EvnictDataService) {}

    register(): void {
        if (!this.form.fullName || !this.form.username || !this.form.email || !this.form.password || !this.form.confirmPassword) {
            this.message = 'Vui lòng nhập đầy đủ các thông tin bắt buộc (*).';
            this.isError = true;
            return;
        }

        if (this.form.password !== this.form.confirmPassword) {
            this.message = 'Mật khẩu xác nhận không trùng khớp.';
            this.isError = true;
            return;
        }

        try {
            this.dataService.registerMember({
                fullName: this.form.fullName,
                username: this.form.username,
                email: this.form.email,
                department: this.form.department,
                password: this.form.password,
                gender: this.form.gender,
                phone: this.form.phone
            });
            this.message = 'Đăng ký thành công! Tài khoản của bạn đang chờ quản trị viên phê duyệt kích hoạt.';
            this.isError = false;
            // Clear form
            this.form = {
                fullName: '',
                username: '',
                email: '',
                password: '',
                confirmPassword: '',
                department: '',
                gender: 'Nam',
                phone: ''
            };
        } catch (err: any) {
            this.message = err.message || 'Đã xảy ra lỗi trong quá trình đăng ký.';
            this.isError = true;
        }
    }
}
