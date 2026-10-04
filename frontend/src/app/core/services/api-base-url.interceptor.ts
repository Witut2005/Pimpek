import { HttpInterceptorFn } from '@angular/common/http';

import { environment } from '../../../environments/environment';

/** Points relative /api calls at the backend from the build's environment (empty: same origin). */
export const apiBaseUrlInterceptor: HttpInterceptorFn = (req, next) =>
  environment.apiBaseUrl && req.url.startsWith('/api/')
    ? next(req.clone({ url: environment.apiBaseUrl + req.url }))
    : next(req);
