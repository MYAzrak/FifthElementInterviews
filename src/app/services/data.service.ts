import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class DataService {
  avgExpressions: string[] = [];
  avgAges: number[] = [];
  avgGenders: string[] = [];
  avgNumOfFacesDetected: number[] = [];
  faceCoverSecondsCount: number = 0;

  constructor() {}
}
