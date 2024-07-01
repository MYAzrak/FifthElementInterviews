import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class DataService {
  private avgExpressionsSource = new BehaviorSubject<string[]>([]);
  private avgAgesSource = new BehaviorSubject<number[]>([]);
  private avgGendersSource = new BehaviorSubject<string[]>([]);
  private avgNumOfFacesDetectedSource = new BehaviorSubject<number[]>([]);
  private faceCoverSecondsCountSource = new BehaviorSubject<number>(0);

  avgExpressions$ = this.avgExpressionsSource.asObservable();
  avgAges$ = this.avgAgesSource.asObservable();
  avgGenders$ = this.avgGendersSource.asObservable();
  avgNumOfFacesDetected$ = this.avgNumOfFacesDetectedSource.asObservable();
  faceCoverSecondsCount$ = this.faceCoverSecondsCountSource.asObservable();

  updateAvgExpressions(data: string[]) {
    this.avgExpressionsSource.next(data);
  }

  updateAvgAges(data: number[]) {
    this.avgAgesSource.next(data);
  }

  updateAvgGenders(data: string[]) {
    this.avgGendersSource.next(data);
  }

  updateAvgNumOfFacesDetected(data: number[]) {
    this.avgNumOfFacesDetectedSource.next(data);
  }

  updateFaceCoverSecondsCount(data: number) {
    this.faceCoverSecondsCountSource.next(data);
  }

  clearAllData() {
    this.avgExpressionsSource.next([]);
    this.avgAgesSource.next([]);
    this.avgGendersSource.next([]);
    this.avgNumOfFacesDetectedSource.next([]);
    this.faceCoverSecondsCountSource.next(0);
  }
}
