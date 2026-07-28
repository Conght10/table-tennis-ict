import { Routes } from '@angular/router';
import { AppLayout } from './app/layout/component/app.layout';
import { Dashboard } from './app/pages/dashboard/dashboard';
import { Documentation } from './app/pages/documentation/documentation';
import { Landing } from './app/pages/landing/landing';
import { Notfound } from './app/pages/notfound/notfound';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { EvnictDataService } from './app/pages/evnict/domain/evnict-data.service';

// Guard to restrict access to Admin-only portal
export const adminGuard = () => {
    const dataService = inject(EvnictDataService);
    const router = inject(Router);
    const loggedInId = dataService.getLoggedInUserId();
    if (!loggedInId) {
        router.navigate(['/auth/login']);
        return false;
    }
    const member = dataService.getMemberById(loggedInId);
    if (member && member.roles.includes('admin')) {
        return true;
    }
    // Redirect normal players back to the user portal
    router.navigate(['/user']);
    return false;
};

// Guard to restrict access to Player/User-only portal
export const playerGuard = () => {
    const dataService = inject(EvnictDataService);
    const router = inject(Router);
    const loggedInId = dataService.getLoggedInUserId();
    if (!loggedInId) {
        router.navigate(['/auth/login']);
        return false;
    }
    const member = dataService.getMemberById(loggedInId);
    if (member && member.roles.includes('player')) {
        return true;
    }
    // Redirect admins back to the admin portal
    router.navigate(['/admin']);
    return false;
};

export const appRoutes: Routes = [
    { path: '', component: Dashboard },
    {
        path: '',
        component: AppLayout,
        children: [
            { path: 'uikit', loadChildren: () => import('./app/pages/uikit/uikit.routes') },
            { path: 'documentation', component: Documentation },
            { path: 'pages', loadChildren: () => import('./app/pages/pages.routes') },
            { path: 'admin', canActivate: [adminGuard], loadChildren: () => import('./app/pages/evnict/admin/admin.routes') },
            { path: 'user', canActivate: [playerGuard], loadChildren: () => import('./app/pages/evnict/user/user.routes') }
        ]
    },
    { path: 'landing', component: Landing },
    { path: 'notfound', component: Notfound },
    { path: 'auth', loadChildren: () => import('./app/pages/auth/auth.routes') },
    { path: '**', redirectTo: '/notfound' }
];
