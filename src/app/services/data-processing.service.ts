import { Injectable } from '@angular/core';
import * as math from 'mathjs';

@Injectable({
  providedIn: 'root',
})
export class DataProcessingService {
  private highestExpressions: string[] = []; // Saves the highest expression every second for 1m (then resets)
  private avgExpressions: string[] = []; // Saves the average expression detected over 1-minute intervals
  private predictedAges: number[] = []; // Saves the last 30 predicted ages
  private avgAges: number[] = []; // Saves the average age calculated over 10-seconds intervals
  private predictedGenders: string[] = []; // Saves the predicted genders every second for 10s (then resets)
  private avgGenders: number[] = []; // Saves the average gender calculated over 10-seconds intervals
  private numOfFacesDetected: number[] = []; // Saves the # of faces detected every second for 5s (then resets)
  private avgNumOfFacesDetected: number[] = []; // Save the average # of faces detected over 5-seconds intervals
  private faceCoverSecondsCount = 0; // Saves the cumulative time in seconds that the face was covered

  saveTopExpression(expressions: any): void {
    const expressionsArray = Object.entries(expressions);
    expressionsArray.sort((a: any, b: any) => b[1] - a[1]);
    let topExpression = expressionsArray[0][0];
    this.highestExpressions.push(topExpression);
  }

  applyBellCurve(): void {
    const highestExpressionsCopy = [...this.highestExpressions];

    const frequencyMap = highestExpressionsCopy.reduce((acc, expr) => {
      acc[expr] = (acc[expr] || 0) + 1;
      return acc;
    }, {} as { [key: string]: number });

    const uniqueExpressions = Object.keys(frequencyMap);
    const frequencies = uniqueExpressions.map((expr) => frequencyMap[expr]);

    if (uniqueExpressions.length === 0) {
      this.avgExpressions.push('neutral');
      return;
    }

    if (uniqueExpressions.length === 1) {
      this.avgExpressions.push(uniqueExpressions[0]);
      return;
    }

    const mean: number = math.mean(frequencies);
    const stdDev: number = Number(math.std(frequencies));

    const weights = frequencies.map(
      (freq) =>
        Math.exp(-0.5 * Math.pow((freq - mean) / stdDev, 2)) /
        (stdDev * Math.sqrt(2 * Math.PI))
    );

    const weightedSum = uniqueExpressions.reduce(
      (sum, expr, index) => sum + frequencyMap[expr] * weights[index],
      0
    );

    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    const weightedMean = weightedSum / totalWeight;

    const closestExpression = uniqueExpressions.reduce(
      (closest, expr) => {
        const diff = Math.abs(frequencyMap[expr] - weightedMean);
        return diff < closest.diff ? { expression: expr, diff: diff } : closest;
      },
      { expression: '', diff: Infinity }
    );

    this.highestExpressions = [];
    this.avgExpressions.push(closestExpression.expression);
  }

  interpolateAgePredictions(age: number): number {
    this.predictedAges = [age].concat(this.predictedAges).slice(0, 30);
    const avgPredictedAge =
      this.predictedAges.reduce((total, a) => total + a, 0) /
      this.predictedAges.length;
    return avgPredictedAge;
  }

  saveAvgAge(): void {
    let lastTenPredictedAges: number[] = this.predictedAges.slice(-10);
    let sum: number = lastTenPredictedAges.reduce((acc, val) => acc + val, 0);
    let avgAge: number = sum / lastTenPredictedAges.length;
    if (avgAge) {
      this.avgAges.push(avgAge);
    } else {
      this.avgAges.push(0);
    }
  }

  saveGender(gender: string): void {
    this.predictedGenders.push(gender);
  }

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
  }

  saveNumOfFacesDetected(num: number): void {
    this.numOfFacesDetected.push(num);
  }

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
  }

  incrementFaceCoverCount(): void {
    this.faceCoverSecondsCount++;
  }

  // Saves the data in local storage to be retrieved in the stats page
  saveData(): void {
    // Remove the first element of each array since these were saved at second = 0
    // where the no expressions/age/gender/faces were detected yet
    if (this.avgAges[0] === 0) {
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
}
