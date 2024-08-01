import { Injectable } from '@angular/core';
declare const webgazer: any;
@Injectable({
  providedIn: 'root',
})
export class WebgazerService {
  constructor() {}

  public initWebgazer(): void {
    webgazer.showVideoPreview(false).showPredictionPoints(true);
    webgazer.begin();
  }

  public setGazeListener(callback: (data: any) => void): void {
    webgazer.setGazeListener(callback);
  }
}
