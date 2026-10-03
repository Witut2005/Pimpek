import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SourcesStore } from './core/state/sources.store';
import { SyncStore } from './core/state/sync.store';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  template: '<router-outlet />',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  constructor() {
    const sources = inject(SourcesStore);
    const sync = inject(SyncStore);
    // Ask the backend what is really connected, then pull fresh data without the user asking.
    sources.refresh().subscribe(() => {
      if (sources.primary() && sync.stale()) sync.sync();
    });
  }
}
