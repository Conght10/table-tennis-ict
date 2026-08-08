import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MenuItem } from 'primeng/api';
import { AppMenuitem } from './app.menuitem';
import { EvnictDataService } from '../../pages/evnict/domain/evnict-data.service';

@Component({
    selector: 'app-menu',
    standalone: true,
    imports: [CommonModule, AppMenuitem, RouterModule],
    template: `<ul class="layout-menu">
        @for (item of model; track item.label) {
            @if (!item.separator) {
                <li app-menuitem [item]="item" [root]="true"></li>
            } @else {
                <li class="menu-separator"></li>
            }
        }
    </ul> `,
})
export class AppMenu {
    dataService = inject(EvnictDataService);

    get model(): MenuItem[] {
        const loggedInId = this.dataService.getLoggedInUserId();
        if (!loggedInId) {
            return [
                {
                    label: 'Hệ Thống EVNICT',
                    items: [
                        { label: 'Trang Chủ CLB', icon: 'pi pi-fw pi-home', routerLink: ['/'] },
                        { label: 'Trực Tiếp Giải Đấu', icon: 'pi pi-fw pi-trophy', routerLink: ['/live'] }
                    ]
                },
                {
                    label: 'Tài Khoản',
                    items: [
                        { label: 'Đăng Nhập', icon: 'pi pi-fw pi-sign-in', routerLink: ['/auth/login'] },
                        { label: 'Đăng Ký Thành Viên', icon: 'pi pi-fw pi-user-plus', routerLink: ['/auth/register'] }
                    ]
                }
            ];
        }

        const user = this.dataService.getMemberById(loggedInId);
        const roles = user?.roles ?? [];

        const systemItems: any[] = [
            { label: 'Trang Chủ CLB', icon: 'pi pi-fw pi-home', routerLink: ['/'] },
            { label: 'Trực Tiếp Giải Đấu', icon: 'pi pi-fw pi-trophy', routerLink: ['/live'] }
        ];

        if (roles.includes('player')) {
            systemItems.push({ label: 'Cổng Thành Viên', icon: 'pi pi-fw pi-user', routerLink: ['/user'] });
        }
        
        if (roles.includes('admin')) {
            systemItems.push({ label: 'Cổng Quản Trị', icon: 'pi pi-fw pi-cog', routerLink: ['/admin'] });
        }

        return [
            {
                label: 'Hệ Thống EVNICT',
                items: systemItems
            }
        ];
    }
}
