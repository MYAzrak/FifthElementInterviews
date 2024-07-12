import { CommonModule } from '@angular/common';
import {
  Component,
  OnInit,
  AfterViewInit,
  ChangeDetectorRef,
  ElementRef,
  ViewChild,
} from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import * as faceapi from 'face-api.js';
import * as math from 'mathjs';

@Component({
  selector: 'app-webcam',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './webcam.component.html',
  styleUrl: './webcam.component.css',
})
export class WebcamComponent implements OnInit, AfterViewInit {
  @ViewChild('video')
  private video!: ElementRef;

  @ViewChild('canvas')
  private canvasRef!: ElementRef;

  private detectionInterval!: NodeJS.Timeout;
  private avgNumOfFacesInterval!: NodeJS.Timeout;
  private avgAgeGenderInterval!: NodeJS.Timeout;
  private avgExpressionInterval!: NodeJS.Timeout;

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

  private readonly DETECTION_INTERVAL = 1000; // 1 second
  private readonly AVG_EXPRESSION_INTERVAL = 5000; // Make it 1 minute === 60000 milliseconds
  private readonly AVG_AGE_GENDER_INTERVAL = 5000; // Make it 10 seconds === 10000 milliseconds
  private readonly AVG_NUM_OF_FACES_INTERVAL = 5000; // 5 seconds
  public readonly WIDTH = 1280;
  public readonly HEIGHT = 720;

  private detection: any;
  private resizedDetections: any;
  private canvas: any;
  private canvasEl: any;
  private displaySize: any;
  private videoInput: any;

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

  // Asks for webcam permission to start the process
  startVideo(): void {
    this.videoInput = this.video.nativeElement;
    navigator.mediaDevices
      .getUserMedia({ video: {}, audio: false })
      .then((stream) => (this.videoInput.srcObject = stream))
      .catch((error) => console.log(error));
    this.detectFaces();
    setTimeout(() => {
      this.startTimer();
    }, 3000); // Waits for 3s for the video to load
  }

  // Saves the top expression at each detection
  saveTopExpression(detections: any[]): void {
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
  applyBellCurve(): void {
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
  interpolateAgePredictions(age: number): number {
    this.predictedAges = [age].concat(this.predictedAges).slice(0, 30);
    const avgPredictedAge =
      this.predictedAges.reduce((total, a) => total + a, 0) /
      this.predictedAges.length;
    return avgPredictedAge;
  }

  // Saves the average age (called every 10 seconds)
  saveAvgAge(): void {
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
  saveGender(detections: any[]): void {
    this.predictedGenders.push(detections[0].gender);
  }

  // Saves the average gender (called every 10 seconds)
  saveAvgGender(): void {
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
  saveNumOfFacesDetected(detections: any[]): void {
    this.numOfFacesDetected.push(detections.length);
  }

  // Saves the average number of faces detected (called every 5)
  saveAvgNumOfFacesDetected(): void {
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
  alertUser(): void {
    this.faceCoverSecondsCount++;
    // alert("No face detected! Please ensure your face is visible to the camera."); // Could be changed afterwards since alert() stops the execution of the program
    // console.log(`The face was covered for ${this.faceCoverSecondsCount}s`);
  }

  // Saves the data in local storage to be retrieved in the stats page
  saveData(): void {
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

  // Checks if the user exits the fullscreen
  checkFullScreen(): void {
    const DURATION = 100; // Make it 10s. <10 seconds outside full screen is fine
    let timeAllowedOutsideFullScreen: number = DURATION;
    let checkInterval: any;

    const startCheckInterval = () => {
      if (!checkInterval) {
        checkInterval = setInterval(() => {
          if (!document.fullscreenElement) {
            timeAllowedOutsideFullScreen--;
            console.log(
              `Please, go back to full-screen. ${timeAllowedOutsideFullScreen}s left`
            );
            this.isOutsideFullScreen = true;
            this.openModal('warning');

            if (timeAllowedOutsideFullScreen === 0) {
              clearInterval(checkInterval);
              console.log("You've been disqualified for cheating.");
              this.isDisqualified = true;
              const failData = {
                isDisqualified: this.isDisqualified,
              };
              localStorage.setItem('failData', JSON.stringify(failData));
              this.router.navigate(['/stats']);
            }
          } else {
            console.log('All good now.. returning');
            timeAllowedOutsideFullScreen = DURATION; // Reset the counter
            clearInterval(checkInterval);
            checkInterval = null; // Clear the interval
          }
        }, 1000);
      }
    };

    document.addEventListener('fullscreenchange', () => {
      if (!document.fullscreenElement) {
        startCheckInterval();
      } else {
        timeAllowedOutsideFullScreen = 0; // Reset the counter if the user returns to full screen
        if (checkInterval) {
          clearInterval(checkInterval);
          checkInterval = null;
        }
      }
    });
  }

  // Sets a timer which directs to the statistics page after 5 minutes
  startTimer(): void {
    const DURATION: number = 100; // 300s = 5m
    let timeLeft: number = DURATION;
    let minutes: number = 0;
    let seconds: number = 0;

    const timerDisplay = document.getElementById('timer');
    if (timerDisplay) {
      const timerInterval = window.setInterval(() => {
        minutes = Math.floor(timeLeft / 60);
        seconds = timeLeft % 60;

        timerDisplay.textContent = `${minutes}:${
          seconds < 10 ? '0' + seconds : seconds
        }`;

        this.checkFullScreen();

        if (timeLeft-- < 0) {
          clearInterval(timerInterval);
          clearInterval(this.detectionInterval);
          clearInterval(this.avgNumOfFacesInterval);
          clearInterval(this.avgAgeGenderInterval);
          clearInterval(this.avgExpressionInterval);
          timerDisplay.textContent = 'Directing to Statistics';
          this.saveData();
          setTimeout(() => {
            this.router.navigate(['/stats']); // Navigate to stats component
          }, 2000); // Wait for 2 seconds then navigate to stats component
        }
      }, 1000); // Decrement 1 from the timer every second
    } else {
      console.error('Timer display element not found');
    }
  }

  // Called when the button id="begin" is pressed
  beginInterview(): void {
    localStorage.clear();
    this.showWebcam = !this.showWebcam;
    document.documentElement.requestFullscreen();
    this.cdRef.detectChanges(); // Force change detection
    if (this.showWebcam) {
      this.startVideo();
    }
  }

  // Called when the button id="start" is pressed or when the users exits full screen during the interview
  openModal(modalName: string): void {
    let modal: HTMLElement | null;
    if (modalName === 'begin') {
      modal = document.getElementById('beginModal');
    } else if (modalName === 'warning') {
      modal = document.getElementById('warningModal');
    } else {
      console.error('Modal element not found');
      return;
    }
    if (modal) {
      modal.style.display = 'block';
    }
  }

  // Called when the button id="fullscreen" is pressed
  fullScreen(): void {
    document.documentElement.requestFullscreen();
    this.isOutsideFullScreen = false;
  }

  // Called when the button id="capture" is pressed for screen recording
  async screenRecord(): Promise<void> {
    let beginButton = document.getElementById('begin') as HTMLButtonElement;
    if (!beginButton) {
      console.error('Start button element not found');
      return;
    }

    let captureButton = document.getElementById('capture') as HTMLButtonElement;
    if (!captureButton) {
      console.error('Capture button element not found');
      return;
    }

    captureButton.addEventListener('click', async () => {
      beginButton.disabled = false;
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
        });

        const recorder = new MediaRecorder(stream);
        recorder.start();

        const [video] = stream.getVideoTracks();
        video.addEventListener('ended', () => {
          recorder.stop();
        });

        recorder.addEventListener('dataavailable', (evt) => {
          const a = document.createElement('a');
          a.href = URL.createObjectURL(evt.data);
          a.download = 'capture.webm';
          a.click();
        });
      } catch (err) {
        console.error('Error starting screen recording:', err);
      }
    });
  }

  async detectFaces() {
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

          this.canvas
            .getContext('2d')
            .clearRect(0, 0, this.canvas.width, this.canvas.height);
          faceapi.draw.drawDetections(this.canvas, this.resizedDetections);
          faceapi.draw.drawFaceExpressions(this.canvas, this.resizedDetections);

          this.resizedDetections.forEach((detection: any) => {
            const { age, gender, genderProbability } = detection;
            const interpolatedAge = this.interpolateAgePredictions(age);

            new faceapi.draw.DrawTextField(
              [
                `${Math.round(interpolatedAge)} years`,
                `${gender} (${faceapi.utils.round(genderProbability)})`,
              ],
              detection.detection.box.bottomRight
            ).draw(this.canvas);
          });

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
