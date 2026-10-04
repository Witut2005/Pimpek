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
import { userIdInterceptor } from './core/services/user-id.interceptor';

registerLocaleData(localePl);

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    // Query params (?source=, ?panel=) arrive as component inputs.
    provideRouter(routes, withComponentInputBinding()),
    // /api is proxied to the FastAPI backend (proxy.conf.json), so no CORS or base URL.
    // Each browser gets its own X-User-Id there.
    provideHttpClient(withFetch(), withInterceptors([userIdInterceptor])),
    { provide: LOCALE_ID, useValue: 'pl' },
    { provide: CheckInService, useClass: MockCheckInService },
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000'
    })
  ]
};
