import {
  OnInit,
  AfterViewInit,
  Component,
  ViewChild,
  ElementRef,
} from '@angular/core';
import { WebgazerService } from '../services/webgazer.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-gaze-tracking',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './gaze-tracking.component.html',
  styleUrl: './gaze-tracking.component.css',
})
export class GazeTrackingComponent implements OnInit, AfterViewInit {
  // For cheating detection
  private readonly screenHeight: number = window.innerHeight;
  private readonly screenWidth: number = window.innerWidth;
  private finishedCalibration: boolean = false;
  private cheatingSeconds: number = 0;

  // For calibration
  @ViewChild('calibrationContainer') calibrationContainer!: ElementRef;
  public calibrationPositions = [
    { left: '50px', top: '50px', right: '50px', transform: 'translateX(-50%)', bottom: '50px' },
    // { right: '50px', top: '50px' },
    // { left: '50px', bottom: '50px' },
    // { right: '50px', bottom: '50px' },
    // { left: '50%', top: '50px', transform: 'translateX(-50%)' },
    // { left: '50%', bottom: '50px', transform: 'translateX(-50%)' },
    // { left: '50px', top: '50%', transform: 'translateY(-50%)' },
    // { right: '50px', top: '50%', transform: 'translateY(-50%)' },
    // { left: '25%', top: '25%', transform: 'translate(-50%, -50%)' },
    // { left: '75%', top: '75%', transform: 'translate(-50%, -50%)' },
  ];
  private completedButtons: number = 0;

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

  public startCalibration(): void {
    this.calibrationContainer.nativeElement.style.display = 'block';
  }

  public onCalibrationButtonClick(event: MouseEvent): void {
    const button = event.target as HTMLButtonElement;
    let clickCount = parseInt(button.dataset['clickCount'] || '0', 10);
    clickCount++;
    button.dataset['clickCount'] = clickCount.toString();

    if (clickCount >= 10) {
      button.classList.add('completed');
      button.disabled = true;
      this.completedButtons++;

      if (this.completedButtons === this.calibrationPositions.length) {
        this.finishedCalibration = true;
        this.calibrationContainer.nativeElement.style.display = 'none';
      }
    }
  }
}
