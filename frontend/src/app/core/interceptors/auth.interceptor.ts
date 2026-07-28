import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { EvnictDataService } from '@/app/pages/evnict/domain/evnict-data.service';

/**
 * Functional HTTP Interceptor to attach Authorization tokens and handle auth errors (401/403).
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
    const dataService = inject(EvnictDataService);
    const router = inject(Router);

    // Retrieve active logged in user ID to serve as a mock bearer token
    const token = dataService.getLoggedInUserId();

    let authReq = req;
    if (token) {
        authReq = req.clone({
            setHeaders: {
                Authorization: `Bearer mock-bearer-token-for-${token}`,
                'X-Requested-With': 'XMLHttpRequest'
            }
        });
    }

    return next(authReq).pipe(
        catchError((error: HttpErrorResponse) => {
            if (error.status === 401 || error.status === 403) {
                // Auto logout on unauthorized response and redirect to login page
                dataService.logout();
                router.navigate(['/auth/login']);
            }
            return throwError(() => error);
        })
    );
};
