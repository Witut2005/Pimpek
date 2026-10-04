import { registerLocaleData } from '@angular/common';
import localePl from '@angular/common/locales/pl';
import {
  ApplicationConfig,
  LOCALE_ID,
  provideBrowserGlobalErrorListeners,
  isDevMode,
  provideZonelessChangeDetection
} from '@angular/core';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideServiceWorker } from '@angular/service-worker';

import { routes } from './app.routes';
import { CheckInService } from './core/services/check-in.service';
import { MockCheckInService } from './core/services/mock-check-in.service';
import { apiBaseUrlInterceptor } from './core/services/api-base-url.interceptor';
import { userIdInterceptor } from './core/services/user-id.interceptor';

registerLocaleData(localePl);

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    // Query params (?source=, ?panel=) arrive as component inputs.
    provideRouter(routes, withComponentInputBinding()),
    // /api goes to the FastAPI backend: through the dev proxy under `ng serve`, straight to
    // environment.apiBaseUrl in production builds. Each browser gets its own X-User-Id there.
    provideHttpClient(withFetch(), withInterceptors([userIdInterceptor, apiBaseUrlInterceptor])),
    { provide: LOCALE_ID, useValue: 'pl' },
    { provide: CheckInService, useClass: MockCheckInService },
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000'
    })
  ]
};
