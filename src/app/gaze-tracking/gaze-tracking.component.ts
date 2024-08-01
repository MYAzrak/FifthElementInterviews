import { AfterViewInit, Component, OnInit } from '@angular/core';
import { WebgazerService } from '../services/webgazer.service';

@Component({
  selector: 'app-gaze-tracking',
  standalone: true,
  imports: [],
  templateUrl: './gaze-tracking.component.html',
  styleUrl: './gaze-tracking.component.css',
})
export class GazeTrackingComponent implements OnInit, AfterViewInit {
  private readonly screenHeight: number = window.innerHeight;
  private readonly screenWidth: number = window.innerWidth;
  private finishedCalibration: boolean = false;
  private cheatingSeconds: number = 0;

  constructor(private webgazerService: WebgazerService) {}

  ngOnInit(): void {
    this.webgazerService.initWebgazer();
  }

  ngAfterViewInit(): void {
    this.webgazerService.setGazeListener((data: any) => {
      if (data === null) return;

      const { x, y } = data;
      if (this.isLookingAtEdge(x, y) && this.finishedCalibration) {
        this.cheatingSeconds++;
      }
    });
  }

  private isLookingAtEdge(x: number, y: number): boolean {
    return x <= 0 || x >= this.screenWidth || y <= 0 || y >= this.screenHeight;
  }
}
