import { registerLocaleData } from '@angular/common';
import localePl from '@angular/common/locales/pl';
import {
  ApplicationConfig,
  LOCALE_ID,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection
} from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';

import { routes } from './app.routes';
import { CheckInService } from './core/services/check-in.service';
import { MockCheckInService } from './core/services/mock-check-in.service';

registerLocaleData(localePl);

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    // Query params (?source=, ?panel=) arrive as component inputs.
    provideRouter(routes, withComponentInputBinding()),
    { provide: LOCALE_ID, useValue: 'pl' },
    { provide: CheckInService, useClass: MockCheckInService }
  ]
};
