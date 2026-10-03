import { Observable } from 'rxjs';
import { CheckInInput, DailyCheckIn } from '../models/check-in.model';

/**
 * Backend contract for daily check-ins. Provided as `MockCheckInService` in app.config.ts —
 * swap it for an HttpClient implementation once the API exists.
 */
export abstract class CheckInService {
  abstract getCheckIns(): Observable<DailyCheckIn[]>;
  abstract getCheckIn(date: string): Observable<DailyCheckIn | undefined>;
  /** Creates the check-in for `input.date`, or replaces it if that day already has one. */
  abstract saveCheckIn(input: CheckInInput): Observable<DailyCheckIn>;
}
