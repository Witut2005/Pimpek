import { inject } from '@angular/core';
import { CanActivateFn, Router, Routes } from '@angular/router';
import { SettingsStore } from './core/state/settings.store';
import { Home } from './features/home/home';

/** First visit goes through onboarding; after that the room is home. */
const onboarded: CanActivateFn = () =>
  inject(SettingsStore).settings().onboarded || inject(Router).parseUrl('/witaj');

export const routes: Routes = [
  { path: '', component: Home, canActivate: [onboarded], title: 'Pimpek' },
  {
    path: 'witaj',
    title: 'Witaj · Pimpek',
    loadComponent: () => import('./features/onboarding/onboarding').then((m) => m.Onboarding),
  },
  { path: '**', redirectTo: '' },
];
