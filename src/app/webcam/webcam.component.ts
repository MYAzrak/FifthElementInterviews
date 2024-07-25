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

@Component({
  selector: 'app-webcam',
  standalone: true,
  imports: [CommonModule, RouterModule, DeviceCheckComponent],
  templateUrl: './webcam.component.html',
  styleUrl: './webcam.component.css',
})
export class WebcamComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('video')
  private video!: ElementRef;

  @ViewChild('canvas')
  private canvasRef!: ElementRef;

  private detectionInterval!: NodeJS.Timeout;
  private avgNumOfFacesInterval!: NodeJS.Timeout;
  private avgAgeGenderInterval!: NodeJS.Timeout;
  private avgExpressionInterval!: NodeJS.Timeout;
  private mainTimerInterval!: NodeJS.Timeout;
  private subTimerInterval!: NodeJS.Timeout;

  private highestExpressions: string[] = []; // Saves the highest expression every second for 1m (then resets)
  private avgExpressions: string[] = []; // Saves the average expression detected over 1-minute intervals
  private predictedAges: number[] = []; // Saves the last 30 predicted ages
  private avgAges: number[] = []; // Saves the average age calculated over 10-seconds intervals
  private predictedGenders: string[] = []; // Saves the predicted genders every second for 10s (then resets)
  private avgGenders: number[] = []; // Saves the average gender calculated over 10-seconds intervals
  private numOfFacesDetected: number[] = []; // Saves the # of faces detected every second for 5s (then resets)
  private avgNumOfFacesDetected: number[] = []; // Save the average # of faces detected over 5-seconds intervals
  private faceCoverSecondsCount = 0; // Saves the cumulative time in seconds that the face was covered

  private isDisqualified: boolean = false;
  public showWebcam: boolean = false;
  public isOutsideFullScreen: boolean = false;
  public mainTimerDisplay: string = '';
  public subTimerDisplay: string = '';

  private readonly DETECTION_INTERVAL = 1000; // 1 second
  private readonly AVG_EXPRESSION_INTERVAL = 5000; // Make it 1 minute === 60000 milliseconds
  private readonly AVG_AGE_GENDER_INTERVAL = 5000; // Make it 10 seconds === 10000 milliseconds
  private readonly AVG_NUM_OF_FACES_INTERVAL = 5000; // 5 seconds
  private readonly MAIN_TIMER_DURATION = 30; // Make it 300 === 5 minutes in seconds
  private readonly SUB_TIMER_DURATION = 10; // 10 seconds
  public readonly WIDTH = 1280;
  public readonly HEIGHT = 720;

  // facepai
  private detection: any;
  private resizedDetections: any;
  private canvas: any;
  private canvasEl: any;
  private displaySize: any;
  private videoInput: any;

  public showModal: string = 'deviceCheck'; // or screenRecord or fullscreen;
  public devicesReady: boolean = false;

  private isInDevMode: boolean = false; // Assign true to show the canvas (faceapi squares) around the face

  // For screen recording
  private screenCaptureRecorder: MediaRecorder | null = null;
  private screenCaptureStream: MediaStream | null = null;
  private isInterviewCompleted: boolean = false;
  private isInsideInterview: boolean = false;

  constructor(
    private elRef: ElementRef,
    private cdRef: ChangeDetectorRef,
    private router: Router
  ) {}

  // Loading the models
  async ngOnInit(): Promise<void> {
    try {
      await Promise.all([
        faceapi.nets.ssdMobilenetv1.loadFromUri('/assets/models'),
        faceapi.nets.tinyFaceDetector.loadFromUri('/assets/models'),
        faceapi.nets.faceExpressionNet.loadFromUri('/assets/models'),
        faceapi.nets.ageGenderNet.loadFromUri('/assets/models'),
      ]);
    } catch (error) {
      console.log(`Error loading models`, error);
    }
  }

  ngAfterViewInit(): void {
    this.cdRef.detectChanges();
  }

  ngOnDestroy(): void {
    this.cleanupTimers();
    this.removeFullscreenListener();
  }

  // Stops mainTimer, subTimer, and all intervals returned by setInterval before routing to /stats
  private cleanupTimers(): void {
    clearInterval(this.detectionInterval);
    clearInterval(this.avgNumOfFacesInterval);
    clearInterval(this.avgAgeGenderInterval);
    clearInterval(this.avgExpressionInterval);
    clearInterval(this.mainTimerInterval);
    clearInterval(this.subTimerInterval);
  }

  // Starts the mainTimer (the timer for the whole interview)
  private startMainTimer(): void {
    let timeLeft: number = this.MAIN_TIMER_DURATION;
    this.mainTimerInterval = setInterval(() => {
      this.mainTimerDisplay = this.formatTime(timeLeft);
      if (--timeLeft < 0) {
        this.handleInterviewEnd();
      }
    }, 1000);
  }

  // Used to format both subTimer and mainTimer
  private formatTime(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
  }

  // Called when the mainTimer ends
  private handleInterviewEnd(): void {
    this.mainTimerDisplay = 'Directing to Statistics';
    this.isInterviewCompleted = true;
    this.isInsideInterview = false;
    this.stopScreenRecording(); // Stop recording before routing to /stats
    this.saveData();
    this.cleanupTimers();
    setTimeout(() => {
      this.router.navigate(['/stats']);
    }, 2000);
  }

  // Listens to fullscreen change inside the webcam component during the interview
  private handleFullScreenChange = (): void => {
    if (!document.fullscreenElement && this.router.url !== '/stats') {
      this.isOutsideFullScreen = true;
      this.openModal('warning');
      this.startSubTimer();
    } else {
      this.isOutsideFullScreen = false;
      this.stopSubTimer();
    }
  };

  // Called when the user exits fullscreen during the interview
  private startSubTimer(): void {
    let timeLeft: number = this.SUB_TIMER_DURATION;
    this.stopSubTimer(); // Stops past subTimers

    this.subTimerInterval = setInterval(() => {
      if (!document.fullscreenElement) {
        this.subTimerDisplay = this.formatTime(timeLeft);
        if (--timeLeft < 0) {
          this.stopSubTimer();
          this.handleDisqualification();
        }
      } else {
        this.stopSubTimer();
      }
    }, 1000);
  }

  // Stops the current running subTimer
  private stopSubTimer(): void {
    clearInterval(this.subTimerInterval);
    this.subTimerDisplay = '';
  }

  // Called when the user exits fullscreen for more than 10s during the interview
  private handleDisqualification(): void {
    this.isDisqualified = true;
    const failData = {
      isDisqualified: this.isDisqualified,
    };
    localStorage.setItem('failData', JSON.stringify(failData));
    this.cleanupTimers();
    this.isInterviewCompleted = true;
    this.isInsideInterview = false;
    this.stopScreenRecording();
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

  // Called when the button id="begin" is pressed
  public beginInterview(): void {
    localStorage.clear();
    this.isInsideInterview = true;
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
      modal.style.display = 'block';
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

  // Handles the completion event from the device-check component, determining whether the devices (mic and camera) are working properly
  public onDeviceCheckComplete(isReady: boolean): void {
    this.devicesReady = isReady;
  }

  // Asks for webcam permission to start the process
  private startVideo(): void {
    this.videoInput = this.video.nativeElement;
    navigator.mediaDevices
      .getUserMedia({ video: {}, audio: false })
      .then((stream) => (this.videoInput.srcObject = stream))
      .catch((error) => console.log(error));
    this.detectFaces();
    setTimeout(() => {
      this.startMainTimer();
    }, 3000); // Waits for 3s for the video to load
  }

  // Saves the top expression at each detection
  private saveTopExpression(detections: any[]): void {
    detections.forEach((detection) => {
      const expressions = detection.expressions;
      const expressionsArray = Object.entries(expressions);
      expressionsArray.sort((a: any, b: any) => b[1] - a[1]);
      let topExpression = expressionsArray[0][0];
      this.highestExpressions.push(topExpression);
      // console.log('Top Expression:', topExpression);
      // console.log('All Highest Expressions:', this.highestExpressions);
    });
  }

  // Saves the average expression (called every 1 minutes)
  private applyBellCurve(): void {
    const highestExpressionsCopy = [...this.highestExpressions];

    // Count the frequency of each expression
    const frequencyMap = highestExpressionsCopy.reduce((acc, expr) => {
      acc[expr] = (acc[expr] || 0) + 1;
      return acc;
    }, {} as { [key: string]: number });
    // console.log(`frequencyMap:`, frequencyMap);

    const uniqueExpressions = Object.keys(frequencyMap);
    const frequencies = uniqueExpressions.map((expr) => frequencyMap[expr]);
    // console.log(`uniqueExpressions:`, uniqueExpressions);
    // console.log(`frequencies:`, frequencies);

    // No faces detected
    if (uniqueExpressions.length === 0) {
      this.avgExpressions.push(`neutral`);
      return;
    }

    // The expression during the interval did not change
    if (uniqueExpressions.length === 1) {
      this.avgExpressions.push(uniqueExpressions[0]);
      return;
    }

    const mean: number = math.mean(frequencies);
    const stdDev: number = Number(math.std(frequencies));

    // Apply Gaussian (normal) distribution to frequencies
    const weights = frequencies.map(
      (freq) =>
        Math.exp(-0.5 * Math.pow((freq - mean) / stdDev, 2)) /
        (stdDev * Math.sqrt(2 * Math.PI))
    );
    // console.log(`weights:`, weights);

    // Calculate weighted sum
    const weightedSum = uniqueExpressions.reduce(
      (sum, expr, index) => sum + frequencyMap[expr] * weights[index],
      0
    );
    // console.log(`weightedSum:`, weightedSum);
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    // console.log(`totalWeight:`, totalWeight);
    const weightedMean = weightedSum / totalWeight;
    // console.log(`weightedMean:`, weightedMean);

    // Find the expression with frequency closest to the weighted mean
    const closestExpression = uniqueExpressions.reduce(
      (closest, expr) => {
        const diff = Math.abs(frequencyMap[expr] - weightedMean);
        return diff < closest.diff ? { expression: expr, diff: diff } : closest;
      },
      { expression: '', diff: Infinity }
    );
    this.highestExpressions = [];
    this.avgExpressions.push(closestExpression.expression);
    // console.log(`closestExpress`, closestExpression);
    // console.log(
    //   `The average face expression after 1m is "${closestExpression.expression}"`
    // );
  }

  // Interpolates age predictions
  private interpolateAgePredictions(age: number): number {
    this.predictedAges = [age].concat(this.predictedAges).slice(0, 30);
    const avgPredictedAge =
      this.predictedAges.reduce((total, a) => total + a, 0) /
      this.predictedAges.length;
    return avgPredictedAge;
  }

  // Saves the average age (called every 10 seconds)
  private saveAvgAge(): void {
    let lastTenPredictedAges: number[] = this.predictedAges.slice(-10);
    let sum: number = lastTenPredictedAges.reduce((acc, val) => acc + val, 0);
    let avgAge: number = sum / lastTenPredictedAges.length;
    if (avgAge) {
      this.avgAges.push(avgAge);
    } else {
      this.avgAges.push(0);
    }
    // console.log(`The average age after 10s is "${avgAge}"`);
  }

  // Saves the gender at each detection
  private saveGender(detections: any[]): void {
    this.predictedGenders.push(detections[0].gender);
  }

  // Saves the average gender (called every 10 seconds)
  private saveAvgGender(): void {
    const predictedGendersCopy = [...this.predictedGenders];
    let maleCount = 0;
    let femaleCount = 0;
    for (const gender of predictedGendersCopy) {
      if (gender === 'male') maleCount++;
      else femaleCount++;
    }

    let avgGender = maleCount >= femaleCount ? 0 : 1;

    this.predictedGenders = [];
    this.avgGenders.push(avgGender);
    // console.log(`The average gender after 10s is "${avgGender}"`);
  }

  // Saves number of faces detected
  private saveNumOfFacesDetected(detections: any[]): void {
    this.numOfFacesDetected.push(detections.length);
  }

  // Saves the average number of faces detected (called every 5)
  private saveAvgNumOfFacesDetected(): void {
    const numOfFacesDetectedCopy = [...this.numOfFacesDetected];
    let sum = numOfFacesDetectedCopy.reduce((acc, val) => acc + val, 0);
    let avgNum = sum / numOfFacesDetectedCopy.length;

    this.numOfFacesDetected = [];
    if (avgNum) {
      this.avgNumOfFacesDetected.push(avgNum);
    } else {
      this.avgNumOfFacesDetected.push(0);
    }
    // console.log(`The average number of face detected after 5s is "${avgNum}"`);
  }

  // Alerts the user if their faces isn't visible + increments faceCoverSecondsCount
  private alertUser(): void {
    this.faceCoverSecondsCount++;
    // alert("No face detected! Please ensure your face is visible to the camera."); // Could be changed afterwards since alert() stops the execution of the program
    // console.log(`The face was covered for ${this.faceCoverSecondsCount}s`);
  }

  // Saves the data in local storage to be retrieved in the stats page
  private saveData(): void {
    // NOTE: WHEN THE USER `RESTART` THE PROCESS, THIS ISSUE DOES NOT OCCUR =>
    // REMOVING THE FIRST ELEMENT REMOVES A CRUCIAL VALUE FROM EACH ARRAY
    if (this.avgAges[0] === 0) {
      // Remove the first element of each array since these were saved at second = 0
      // where the no expressions/age/gender/faces were detected yet
      this.avgExpressions.shift();
      this.avgAges.shift();
      this.avgGenders.shift();
      this.avgNumOfFacesDetected.shift();
    }

    const data = {
      avgExpressions: this.avgExpressions,
      avgAges: this.avgAges,
      avgGenders: this.avgGenders,
      avgNumOfFacesDetected: this.avgNumOfFacesDetected,
      faceCoverSecondsCount: this.faceCoverSecondsCount,
    };
    localStorage.setItem('webcamData', JSON.stringify(data));
  }

  // Called when the button id="capture" is pressed for screen recording
  public async screenRecord(): Promise<void> {
    try {
      // Screen Capture API
      this.screenCaptureStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: 'monitor',
        },
        audio: true,
      });

      // Check if the user selected the entire screen
      const videoTrack = this.screenCaptureStream.getVideoTracks()[0];
      if (videoTrack.getSettings().displaySurface !== 'monitor') {
        this.screenCaptureStream.getTracks().forEach((track) => track.stop());
        throw new Error('Please select the entire screen for recording.');
      }

      // MediaStream Recording API
      this.screenCaptureRecorder = new MediaRecorder(this.screenCaptureStream);
      this.screenCaptureRecorder.start();

      this.screenCaptureRecorder.addEventListener('dataavailable', (evt) => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(evt.data);
        a.download = 'screen_capture.mp4';
        a.click();
      });

      this.screenCaptureRecorder.addEventListener('stop', () => {
        // Candidate stopped recording before entering the interview
        if (!this.isInterviewCompleted && !this.isInsideInterview) {
          alert(
            'Please do not stop the screen recording before finishing the interview.'
          );
          this.showModal = 'screenRecord';
          this.changeCaptureButtons(true);
        }

        // Candidate stopped recording during the interview
        if (!this.isInterviewCompleted && this.isInsideInterview) {
          this.screenRecord();
        }
      });

      this.changeCaptureButtons(false);
    } catch (err) {
      console.error('Error starting screen recording:', err);
      if (err instanceof Error && err.name === 'NotAllowedError') {
        alert(
          'Screen recording permission denied. Please try again and allow screen recording.'
        );
        if (!this.isInterviewCompleted && this.isInsideInterview) {
          this.screenRecord();
        }
      } else {
        alert('Please try again and ensure you select the "Entire Screen".');
        if (!this.isInterviewCompleted && this.isInsideInterview) {
          this.screenRecord();
        }
      }
      this.highlightText();
    }
  }

  // Enables or disables the captureButton and toFullscreenButton for screen recording
  private changeCaptureButtons(enableButtons: boolean): void {
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
  private highlightText(): void {
    const entireScreenSpan = document.getElementById(
      'entire-screen'
    ) as HTMLElement;
    if (entireScreenSpan) {
      entireScreenSpan.style.fontWeight = 'bold';
      entireScreenSpan.style.color = 'red';
    }
  }

  // Stops the screen recording in case of disqualification or interview end
  private stopScreenRecording(): void {
    if (
      this.screenCaptureRecorder &&
      this.screenCaptureRecorder.state !== 'inactive'
    ) {
      this.screenCaptureRecorder.stop();
    }
    this.screenCaptureStream?.getTracks().forEach((track) => track.stop());
  }

  // Contains the faceapi logic for extracting the information from the candidate's face
  private async detectFaces(): Promise<void> {
    this.elRef.nativeElement
      .querySelector('video')
      .addEventListener('play', async () => {
        this.canvas = faceapi.createCanvasFromMedia(this.videoInput);
        this.canvasEl = this.canvasRef.nativeElement;
        this.canvasEl.appendChild(this.canvas);

        this.canvas.setAttribute('id', 'canvass');
        this.canvas.setAttribute(
          'style',
          `position: absolute; top: 0; left: 0;`
        );

        this.displaySize = {
          width: this.videoInput.width,
          height: this.videoInput.height,
        };
        faceapi.matchDimensions(this.canvas, this.displaySize);

        this.detectionInterval = setInterval(async () => {
          this.detection = await faceapi
            .detectAllFaces(
              this.videoInput,
              new faceapi.SsdMobilenetv1Options() // or faceapi.TinyFaceDetectorOptions
            )
            .withFaceExpressions()
            .withAgeAndGender();

          this.resizedDetections = faceapi.resizeResults(
            this.detection,
            this.displaySize
          );

          // Always call interpolateAgePredictions and store the results
          const interpolatedAges = this.resizedDetections.map(
            (detection: any) => {
              return this.interpolateAgePredictions(detection.age);
            }
          );

          this.canvas
            .getContext('2d')
            .clearRect(0, 0, this.canvas.width, this.canvas.height);

          if (this.isInDevMode) {
            faceapi.draw.drawDetections(this.canvas, this.resizedDetections);
            faceapi.draw.drawFaceExpressions(
              this.canvas,
              this.resizedDetections
            );

            this.resizedDetections.forEach((detection: any, index: number) => {
              const { age, gender, genderProbability } = detection;
              const interpolatedAge = interpolatedAges[index];
              new faceapi.draw.DrawTextField(
                [
                  `${Math.round(interpolatedAge)} years`,
                  `${gender} (${faceapi.utils.round(genderProbability)})`,
                ],
                detection.detection.box.bottomRight
              ).draw(this.canvas);
            });
          }

          // Alerts the user if their face isn't showing
          if (this.resizedDetections.length === 0) {
            this.alertUser();
          } else {
            this.saveTopExpression(this.resizedDetections);
            this.saveGender(this.resizedDetections);
            this.saveNumOfFacesDetected(this.resizedDetections);
          }
        }, this.DETECTION_INTERVAL);

        // Saves the average expression after 1m
        this.avgExpressionInterval = setInterval(
          () => this.applyBellCurve(),
          this.AVG_EXPRESSION_INTERVAL
        );

        // Saves the average age and gender every 10s
        this.avgAgeGenderInterval = setInterval(() => {
          this.saveAvgAge();
          this.saveAvgGender();
        }, this.AVG_AGE_GENDER_INTERVAL);

        // Saves the average number of faces detected every 5s
        this.avgNumOfFacesInterval = setInterval(
          () => this.saveAvgNumOfFacesDetected(),
          this.AVG_NUM_OF_FACES_INTERVAL
        );
      });
  }
}
