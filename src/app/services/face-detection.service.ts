// import { Injectable } from '@angular/core';
import * as faceapi from 'face-api.js';
import { BehaviorSubject, Observable } from 'rxjs';

// @Injectable({
//   providedIn: 'root',
// })
export class FaceDetectionService {
  private detectionSubject = new BehaviorSubject<any>(null);
  public detection$: Observable<any> = this.detectionSubject.asObservable();

  private highestExpressions: string[] = [];
  private predictedAges: number[] = [];
  private predictedGenders: string[] = [];
  private numOfFacesDetected: number[] = [];

  // Loads FaceAPI models on initialization of webcam component
  public async loadFaceAPIModels(): Promise<void> {
    try {
      await Promise.all([
        faceapi.nets.ssdMobilenetv1.loadFromUri('/assets/models'),
        faceapi.nets.faceExpressionNet.loadFromUri('/assets/models'),
        faceapi.nets.ageGenderNet.loadFromUri('/assets/models'),
        faceapi.nets.faceLandmark68Net.loadFromUri('/assets/models'),
        faceapi.nets.faceRecognitionNet.loadFromUri('/assets/models'),
      ]);
    } catch (error) {
      console.log(`Error loading models`, error);
    }
  }

  public async detectFaces(
    videoInput: HTMLVideoElement,
    canvas: HTMLCanvasElement
  ): Promise<any> {
    const displaySize = { width: videoInput.width, height: videoInput.height };
    faceapi.matchDimensions(canvas, displaySize);

    const detection = await faceapi
      .detectAllFaces(videoInput, new faceapi.SsdMobilenetv1Options())
      .withFaceExpressions()
      .withAgeAndGender();

    const resizedDetections = faceapi.resizeResults(detection, displaySize);
    this.detectionSubject.next(resizedDetections);

    this.processDetections(resizedDetections);

    return resizedDetections;
  }

  private processDetections(detections: any[]): void {
    if (detections.length === 0) {
      this.numOfFacesDetected.push(0);
      return;
    }

    this.saveTopExpression(detections);
    this.saveGender(detections);
    this.saveAge(detections);
    this.numOfFacesDetected.push(detections.length);
  }

  private saveTopExpression(detections: any[]): void {
    detections.forEach((detection) => {
      const expressions = detection.expressions;
      const expressionsArray = Object.entries(expressions);
      expressionsArray.sort((a: any, b: any) => b[1] - a[1]);
      let topExpression = expressionsArray[0][0];
      this.highestExpressions.push(topExpression);
    });
  }

  private saveGender(detections: any[]): void {
    this.predictedGenders.push(detections[0].gender);
  }

  private saveAge(detections: any[]): void {
    const age = detections[0].age;
    const interpolatedAge = this.interpolateAgePredictions(age);
    this.predictedAges.push(interpolatedAge);
  }

  private interpolateAgePredictions(age: number): number {
    this.predictedAges = [age].concat(this.predictedAges).slice(0, 30);
    const avgPredictedAge =
      this.predictedAges.reduce((total, a) => total + a, 0) /
      this.predictedAges.length;
    return avgPredictedAge;
  }

  public getHighestExpressions(): string[] {
    return this.highestExpressions;
  }

  public getPredictedAges(): number[] {
    return this.predictedAges;
  }

  public getPredictedGenders(): string[] {
    return this.predictedGenders;
  }

  public getNumOfFacesDetected(): number[] {
    return this.numOfFacesDetected;
  }

  public drawDetections(
    canvas: HTMLCanvasElement,
    detections: any[],
    displaySize: any
  ): void {
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      faceapi.draw.drawDetections(canvas, detections);
      faceapi.draw.drawFaceExpressions(canvas, detections);

      detections.forEach((detection: any, index: number) => {
        const { age, gender, genderProbability } = detection;
        const interpolatedAge = this.interpolateAgePredictions(age);
        new faceapi.draw.DrawTextField(
          [
            `${Math.round(interpolatedAge)} years`,
            `${gender} (${faceapi.utils.round(genderProbability)})`,
          ],
          detection.detection.box.bottomRight
        ).draw(canvas);
      });
    }
  }
}
