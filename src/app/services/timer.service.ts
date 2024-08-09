import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs/internal/BehaviorSubject';

@Injectable({
  providedIn: 'root',
})
export class TimerService {
  private mainTimerInterval!: NodeJS.Timeout;
  private subTimerInterval!: NodeJS.Timeout;

  private readonly MAIN_TIMER_DURATION = 30; // Make it 300 === 5 minutes in seconds
  private readonly SUB_TIMER_DURATION = 10; // 10 seconds

  // BehaviorSubjects to store and emit timer displays
  private mainTimerDisplaySubject = new BehaviorSubject<string>('00:00');
  private subTimerDisplaySubject = new BehaviorSubject<string>('00:00');

  // Observables to expose the timer displays
  mainTimerDisplay$ = this.mainTimerDisplaySubject.asObservable();
  subTimerDisplay$ = this.subTimerDisplaySubject.asObservable();

  constructor() {}

  public cleanupTimers(): void {
    clearInterval(this.mainTimerInterval);
    clearInterval(this.subTimerInterval);
  }

  public startMainTimer(): Promise<boolean> {
    return new Promise((resolve) => {
      let timeLeft: number = this.MAIN_TIMER_DURATION;
      this.mainTimerInterval = setInterval(() => {
        const formattedTime = this.formatTime(timeLeft);
        this.mainTimerDisplaySubject.next(formattedTime); // Emit new time
        if (--timeLeft < 0) {
          this.mainTimerDisplaySubject.next('Directing to Statistics');
          resolve(true); // Resolve when the timer ends
        }
      }, 1000);
    });
  }

  // Called when the user exits fullscreen during the interview
  public startSubTimer(): Promise<boolean> {
    return new Promise((resolve) => {
      let timeLeft: number = this.SUB_TIMER_DURATION;
      this.stopSubTimer(); // Stops any existing subTimers

      this.subTimerInterval = setInterval(() => {
        if (!document.fullscreenElement) {
          const formattedTime = this.formatTime(timeLeft);
          this.subTimerDisplaySubject.next(formattedTime); // Emit new time
          if (--timeLeft < 0) {
            this.stopSubTimer();
            resolve(true); // Resolve when disqualification should occur
          }
        } else {
          this.stopSubTimer();
        }
      }, 1000);
    });
  }

  // Stops the current running subTimer
  public stopSubTimer(): void {
    clearInterval(this.subTimerInterval);
    this.subTimerDisplaySubject.next('00:00');
  }

  // Used to format both subTimer and mainTimer
  private formatTime(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
  }
}
