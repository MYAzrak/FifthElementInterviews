import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  ElementRef,
  OnInit,
  ViewChild,
} from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import * as faceapi from 'face-api.js';

@Component({
  selector: 'app-webcam',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './webcam.component.html',
  styleUrl: './webcam.component.css',
})
export class WebcamComponent implements OnInit, AfterViewInit {
  showWebcam: boolean = false;
  highestExpressions: string[] = []; // Saves the highest expression every second for 1m (then resets)
  avgExpressions: string[] = []; // Saves the average expression detected over 1-minute intervals
  predictedAges: number[] = []; // Saves the last 30 predicted ages
  avgAges: number[] = []; // Saves the average age calculated over 10-seconds intervals
  predictedGenders: string[] = []; // Saves the predicted genders every second for 10s (then resets)
  avgGenders: number[] = []; // Saves the average gender calculated over 10-seconds intervals
  numOfFacesDetected: number[] = []; // Saves the # of faces detected every second for 5s (then resets)
  avgNumOfFacesDetected: number[] = []; // Save the average # of faces detected over 5-seconds intervals
  faceCoverSecondsCount = 0; // Saves the cumulative time in seconds that the face was covered

  DETECTION_INTERVAL = 1000; // 1 second
  AVG_EXPRESSION_INTERVAL = 5000; // Make it 1 minute === 60000 milliseconds
  AVG_AGE_GENDER_INTERVAL = 5000; // Make it 10 seconds === 10000 milliseconds
  AVG_NUM_OF_FACES_INTERVAL = 5000; // 5 seconds
  WIDTH = 1280; // As .video-container video
  HEIGHT = 720; // As .video-container video
  @ViewChild('video')
  public video!: ElementRef;
  @ViewChild('canvas')
  public canvasRef!: ElementRef;
  stream: any;
  detection: any;
  resizedDetections: any;
  canvas: any;
  canvasEl: any;
  displaySize: any;
  videoInput: any;

  constructor(
    private elRef: ElementRef,
    private cdRef: ChangeDetectorRef,
    private router: Router
  ) {}

  // Loading the models
  async ngOnInit() {
    Promise.all([
      faceapi.nets.ssdMobilenetv1.loadFromUri('/assets/models'),
      faceapi.nets.tinyFaceDetector.loadFromUri('/assets/models'),
      faceapi.nets.faceExpressionNet.loadFromUri('/assets/models'),
      faceapi.nets.ageGenderNet.loadFromUri('/assets/models'),
    ]);
  }

  // Asks for webcam permission
  startVideo() {
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
  saveTopExpression(detections: any[]) {
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
  saveAvgExpression() {
    const expressionsCount: { [key: string]: number } = {
      neutral: 0,
      happy: 0,
      sad: 0,
      angry: 0,
      fearful: 0,
      disgusted: 0,
      surprised: 0,
    };

    const highestExpressionsCopy = [...this.highestExpressions];

    highestExpressionsCopy.forEach((expr) => {
      expressionsCount[expr]++;
    });

    const counts = Object.values(expressionsCount);
    const maxCount = Math.max(...counts);

    const avgExpression = Object.keys(expressionsCount).find(
      (expression) => expressionsCount[expression] === maxCount
    );

    this.highestExpressions = [];
    if (avgExpression) {
      this.avgExpressions.push(avgExpression);
      // console.log(`The average face expression after 1m is "${avgExpression}"`);
    }
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
  saveAvgAge() {
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
  saveGender(detections: any[]) {
    this.predictedGenders.push(detections[0].gender);
  }

  // Saves the average gender (called every 10 seconds)
  saveAvgGender() {
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
  saveNumOfFacesDetected(detections: any[]) {
    this.numOfFacesDetected.push(detections.length);
  }

  // Saves the average number of faces detected (called every 5)
  saveAvgNumOfFacesDetected() {
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
  alertUser() {
    this.faceCoverSecondsCount++;
    // alert("No face detected! Please ensure your face is visible to the camera."); // Could be changed afterwards since alert() stops the execution of the program
    // console.log(`The face was covered for ${this.faceCoverSecondsCount}s`);
  }

  // Sets a timer which directs to the statistics page after 5 minutes
  startTimer() {
    const DURATION: number = 30; // 300s = 5m
    let timeLeft: number = DURATION;
    let minutes: number = 0;
    let seconds: number = 0;

    const timerDisplay = document.getElementById('timer');
    if (timerDisplay) {
      const interval = window.setInterval(() => {
        minutes = Math.floor(timeLeft / 60);
        seconds = timeLeft % 60;

        timerDisplay.textContent = `${minutes}:${
          seconds < 10 ? '0' + seconds : seconds
        }`;

        if (timeLeft-- < 0) {
          const data = {
            avgExpressions: this.avgExpressions,
            avgAges: this.avgAges,
            avgGenders: this.avgGenders,
            avgNumOfFacesDetected: this.avgNumOfFacesDetected,
            faceCoverSecondsCount: this.faceCoverSecondsCount,
          };
          localStorage.setItem('webcamData', JSON.stringify(data));
          clearInterval(interval); // Stop the interval
          timerDisplay.textContent = 'Directing to Statistics';
          setTimeout(() => {
            this.router.navigate(['/stats']); // Navigate to stats component
          }, 2000); // Wait for 2 seconds then navigate to stats component
        }
      }, 1000); // Decrement 1 from the timer every second
    } else {
      console.error('Timer display element not found');
    }
  }

  async detectFaces() {
    this.elRef.nativeElement
      .querySelector('video')
      .addEventListener('play', async () => {
        this.canvas = faceapi.createCanvasFromMedia(this.videoInput);
        this.canvasEl = this.canvasRef.nativeElement;
        this.canvasEl.appendChild(this.canvas);

        this.canvas.setAttribute('id', 'canvass');
        this.canvas.setAttribute('style', `position: absolute; top: 0; left: 0;`);

        this.displaySize = {
          width: this.videoInput.width,
          height: this.videoInput.height,
        };
        faceapi.matchDimensions(this.canvas, this.displaySize);

        setInterval(async () => {
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
        setInterval(
          () => this.saveAvgExpression(),
          this.AVG_EXPRESSION_INTERVAL
        );

        // Saves the average age and gender every 10s
        setInterval(() => {
          this.saveAvgAge();
          this.saveAvgGender();
        }, this.AVG_AGE_GENDER_INTERVAL);

        // Saves the average number of faces detected every 5s
        setInterval(
          () => this.saveAvgNumOfFacesDetected(),
          this.AVG_NUM_OF_FACES_INTERVAL
        );
      });
  }

  ngAfterViewInit() {
    this.cdRef.detectChanges(); // Ensure detection cycle has run
  }

  onClickSwitchWebcam() {
    this.showWebcam = !this.showWebcam;
    this.cdRef.detectChanges(); // Force change detection
    if (this.showWebcam) {
      this.startVideo();
    }
  }
}
