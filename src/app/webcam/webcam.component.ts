import { CommonModule } from '@angular/common';
import {
  Component,
  OnInit,
  AfterViewInit,
  OnDestroy,
  ChangeDetectorRef,
  ElementRef,
  ViewChild,
} from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import * as faceapi from 'face-api.js';
import * as math from 'mathjs';
import { DeviceCheckComponent } from '../device-check/device-check.component';
import { IdVerificationComponent } from '../id-verification/id-verification.component';
import { Subscription } from 'rxjs/internal/Subscription';
import { environment } from '../../environments/environments';
import { TimerService } from '../services/timer.service';
import { UsernameService } from '../services/username.service';
import { FaceDetectionService } from '../services/face-detection.service';
import { DataProcessingService } from '../services/data-processing.service';
import { ScreenRecordingService } from '../services/screen-recording.service';
@Component({
  selector: 'app-webcam',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    DeviceCheckComponent,
    IdVerificationComponent,
  ],
  templateUrl: './webcam.component.html',
  styleUrl: './webcam.component.css',
})
export class WebcamComponent implements OnInit, AfterViewInit, OnDestroy {
  // Interview's video and canvas (for faceapi)
  @ViewChild('video', { static: false })
  private video!: ElementRef<HTMLVideoElement>;
  @ViewChild('canvas', { static: false })
  private canvasRef!: ElementRef<HTMLCanvasElement>;

  private detectionInterval!: NodeJS.Timeout;
  private avgNumOfFacesInterval!: NodeJS.Timeout;
  private avgAgeGenderInterval!: NodeJS.Timeout;
  private avgExpressionInterval!: NodeJS.Timeout;

  private isDisqualified: boolean = false;
  public showWebcam: boolean = false;
  public isOutsideFullScreen: boolean = false;

  private readonly DETECTION_INTERVAL = 1000; // 1 second
  private readonly AVG_EXPRESSION_INTERVAL = 5000; // Make it 1 minute === 60000 milliseconds
  private readonly AVG_AGE_GENDER_INTERVAL = 5000; // Make it 10 seconds === 10000 milliseconds
  private readonly AVG_NUM_OF_FACES_INTERVAL = 5000; // 5 seconds
  public readonly WIDTH = 1280;
  public readonly HEIGHT = 720;

  // facepai
  private videoInput: any;

  public showModal: string = 'enterName'; // or deviceCheck or idVerification or screenRecord or fullscreen;
  public devicesReady: boolean = false;
  public idVerified: boolean = false;

  // From timer service
  public mainTimerDisplay: string = '00:00';
  public subTimerDisplay: string = '00:00';
  private subscriptions: Subscription[] = [];

  // Username service
  public userNameInput: string = ''; // Variable to bind to input field

  faceDetectionService;
  constructor(
    private elRef: ElementRef,
    private cdRef: ChangeDetectorRef,
    private router: Router,
    private timerService: TimerService,
    private usernameService: UsernameService,
    // private faceDetectionService: FaceDetectionService,
    private dataProcessingService: DataProcessingService,
    private screenRecordingService: ScreenRecordingService
  ) {
    this.faceDetectionService = new FaceDetectionService();
  }

  // Loading the models
  ngOnInit(): void {
    this.faceDetectionService.loadFaceAPIModels();
    this.subscribeToTimerDisplays();
  }

  ngAfterViewInit(): void {
    this.cdRef.detectChanges();
    // this.beginInterview();
  }

  ngOnDestroy(): void {
    this.cleanupIntervals();
    this.removeFullscreenListener();
    this.subscriptions.forEach((sub) => sub.unsubscribe());
  }

  // Syncs between the mainTimerDisplay and subTimerDisplay in timer service and webcam component
  private subscribeToTimerDisplays(): void {
    this.subscriptions.push(
      this.timerService.mainTimerDisplay$.subscribe((display) => {
        this.mainTimerDisplay = display;
      })
    );

    this.subscriptions.push(
      this.timerService.subTimerDisplay$.subscribe((display) => {
        this.subTimerDisplay = display;
      })
    );
  }

  // Stops mainTimer, subTimer, and all intervals returned by setInterval before routing to /stats
  private cleanupIntervals(): void {
    clearInterval(this.detectionInterval);
    clearInterval(this.avgNumOfFacesInterval);
    clearInterval(this.avgAgeGenderInterval);
    clearInterval(this.avgExpressionInterval);
    this.timerService.cleanupTimers();
  }

  // Called when the mainTimer ends
  private handleInterviewEnd(): void {
    this.screenRecordingService.setIsInterviewCompleted(true);
    this.screenRecordingService.setIsInsideInterview(false);
    this.screenRecordingService.stopRecording(); // Stop recording before routing to /stats
    this.dataProcessingService.saveData();
    this.cleanupIntervals();
    setTimeout(() => {
      this.router.navigate(['/stats']);
    }, 2000);
  }

  // Listens to fullscreen change inside the webcam component during the interview
  private handleFullScreenChange = (): void => {
    if (!document.fullscreenElement && this.router.url !== '/stats') {
      this.isOutsideFullScreen = true;
      this.openModal('warning');
      this.timerService.startSubTimer().then((shouldDisqualify) => {
        if (shouldDisqualify) {
          this.handleDisqualification();
        }
      });
    } else {
      this.isOutsideFullScreen = false;
      this.timerService.stopSubTimer();
    }
  };

  // Called when the user exits fullscreen for more than 10s during the interview
  private handleDisqualification(): void {
    this.isDisqualified = true;
    const failData = {
      isDisqualified: this.isDisqualified,
    };
    localStorage.setItem('failData', JSON.stringify(failData));
    this.cleanupIntervals();
    this.screenRecordingService.setIsInterviewCompleted(true);
    this.screenRecordingService.setIsInsideInterview(false);
    this.screenRecordingService.stopRecording();
    this.router.navigate(['/stats']);
  }

  // Adds a fullscreen change listener when the interview begins
  private setupFullScreenListener(): void {
    document.addEventListener('fullscreenchange', this.handleFullScreenChange);
  }

  // Removes the fullscreen change listener before routing to /stats
  private removeFullscreenListener(): void {
    document.removeEventListener(
      'fullscreenchange',
      this.handleFullScreenChange
    );
  }

  // Called when "Start Recording" button is pressed -> Calls startRecording in the screenRecordService
  public startScreenRecording(): void {
    this.screenRecordingService.startRecording(
      this.changeModal.bind(this),
      this.changeCaptureButtons.bind(this),
      this.highlightText.bind(this)
    );
  }

  public changeModal(modalName: string): void {
    this.showModal = modalName;
  }

  // Called when the button id="begin" is pressed
  public beginInterview(): void {
    this.mainTimerDisplay = '00:00';
    localStorage.clear();
    this.screenRecordingService.setIsInsideInterview(true);
    this.showWebcam = true;
    document.documentElement.requestFullscreen();
    this.cdRef.detectChanges(); // Force change detection
    this.startVideo();
    this.setupFullScreenListener();
  }

  // Called when the button id="start" is pressed or when the users exits full screen during the interview
  public openModal(modalName: string): void {
    const modal = document.getElementById(
      modalName === 'begin' ? 'beginModal' : 'warningModal'
    );
    if (modal) {
      modal.style.display = 'flex';
    } else {
      console.error('Modal element not found');
    }
  }

  // Closes the warning modal when the user returns to full screen
  private closeWarningModal(): void {
    const modal = document.getElementById('warningModal');
    if (modal) {
      modal.style.display = '';
    }
  }

  // Called when the button id="fullscreen" is pressed
  public fullScreen(): void {
    document.documentElement.requestFullscreen();
    this.closeWarningModal();
    this.isOutsideFullScreen = false;
  }

  // Method to handle form submission
  public handleFormSubmit(event: Event) {
    const inputElement: HTMLInputElement = document.getElementById(
      'name-input'
    ) as HTMLInputElement;

    if (inputElement) {
      this.usernameService.setName(event, inputElement.value);
    } else {
      console.error('Input element not found');
    }
    this.showModal = 'deviceCheck';
  }

  // Handles the completion event from the device-check component, determining whether the devices (mic and camera) are working properly
  public onDeviceCheckComplete(isReady: boolean): void {
    this.devicesReady = isReady;
  }

  // Handles the completion event from the id-verification component, determining whether the same candidate doing the interview is the same person assigned to that interview
  public onIDVerifiedComplete(isVerified: boolean): void {
    this.idVerified = isVerified;
  }

  // Asks for webcam permission to start the process
  private startVideo(): void {
    this.videoInput = this.video.nativeElement;
    navigator.mediaDevices
      .getUserMedia({ video: {}, audio: false })
      .then((stream) => (this.videoInput.srcObject = stream))
      .catch((error) => console.log(error));
    setTimeout(() => {
      this.detectFaces();
    }, 3000);
    setTimeout(() => {
      this.timerService.startMainTimer().then((finished) => {
        if (finished) {
          this.handleInterviewEnd();
        }
      });
    }, 3000); // Waits for 3s for the video to load
  }

  // Enables or disables the captureButton and toFullscreenButton for screen recording
  public changeCaptureButtons(enableButtons: boolean): void {
    let toFullscreenButton = document.getElementById(
      'to-fullscreen'
    ) as HTMLButtonElement;
    if (!toFullscreenButton) {
      console.error('Next button element not found');
      return;
    }

    let captureButton = document.getElementById('capture') as HTMLButtonElement;
    if (!captureButton) {
      console.error('Capture button element not found');
      return;
    }

    if (enableButtons) {
      captureButton.style.display = 'inline-flex';
      toFullscreenButton.hidden = true;
    } else {
      captureButton.style.display = 'none';
      toFullscreenButton.hidden = false;
    }
  }

  // Highlights "Entire Screen" when the user choose another option
  public highlightText(): void {
    const entireScreenSpan = document.getElementById(
      'entire-screen'
    ) as HTMLElement;
    if (entireScreenSpan) {
      entireScreenSpan.style.fontWeight = 'bold';
      entireScreenSpan.style.color = 'red';
    }
  }

  // Contains the faceapi logic for extracting the information from the candidate's face
  private async detectFaces(): Promise<void> {
    const videoElement = this.video.nativeElement as HTMLVideoElement;
    const canvasElement = this.canvasRef.nativeElement as HTMLCanvasElement;
    console.log(videoElement);
    console.log(canvasElement);

    videoElement.addEventListener('play', async () => {
      this.detectionInterval = setInterval(async () => {
        const resizedDetections = await this.faceDetectionService.detectFaces(
          videoElement,
          canvasElement
        );

        // Only call drawDetections if canvasElement is valid
        if (canvasElement && canvasElement.getContext('2d')) {
          this.faceDetectionService.drawDetections(
            canvasElement,
            resizedDetections,
            { width: this.WIDTH, height: this.HEIGHT }
          );
        } else {
          console.error(
            'Canvas element is not available or not correctly initialized.'
          );
        }

        if (resizedDetections.length === 0) {
          this.dataProcessingService.incrementFaceCoverCount();
        }
      }, this.DETECTION_INTERVAL);

      this.avgExpressionInterval = setInterval(
        () => this.dataProcessingService.applyBellCurve(),
        this.AVG_EXPRESSION_INTERVAL
      );

      this.avgAgeGenderInterval = setInterval(() => {
        this.dataProcessingService.saveAvgAge();
        this.dataProcessingService.saveAvgGender();
      }, this.AVG_AGE_GENDER_INTERVAL);

      this.avgNumOfFacesInterval = setInterval(
        () => this.dataProcessingService.saveAvgNumOfFacesDetected(),
        this.AVG_NUM_OF_FACES_INTERVAL
      );
    });
  }
}
