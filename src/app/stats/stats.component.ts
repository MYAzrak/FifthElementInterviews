import { Component, OnInit } from '@angular/core';
import { DataService } from '../services/data.service';

@Component({
  selector: 'app-stats',
  standalone: true,
  imports: [],
  templateUrl: './stats.component.html',
  styleUrl: './stats.component.css',
})
export class StatsComponent implements OnInit {
  avgExpressions: string[] = [];
  avgAges: number[] = [];
  avgGenders: string[] = [];
  avgNumOfFacesDetected: number[] = [];
  faceCoverSecondsCount: number = 0;

  constructor(private dataService: DataService) {}

  ngOnInit() {
    this.avgExpressions = this.dataService.avgExpressions;
    this.avgAges = this.dataService.avgAges;
    this.avgGenders = this.dataService.avgGenders;
    this.avgNumOfFacesDetected = this.dataService.avgNumOfFacesDetected;
    this.faceCoverSecondsCount = this.dataService.faceCoverSecondsCount;
    this.loggingInfo();
  }
  async loggingInfo() {
    console.log(`Avg expressions: `, this.avgExpressions);
    console.log(`Avg ages: `, this.avgAges);
    console.log(`Avg genders: `, this.avgGenders);
    console.log(`Avg number of faces detected: `, this.avgNumOfFacesDetected);
    console.log(`Face was covered for: `, this.faceCoverSecondsCount);
  }
}
