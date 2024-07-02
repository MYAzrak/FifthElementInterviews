import { Component, OnInit, AfterViewInit, HostListener } from '@angular/core';
import { DataService } from '../services/data.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Chart, ChartType } from 'chart.js/auto';

@Component({
  selector: 'app-stats',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './stats.component.html',
  styleUrl: './stats.component.css',
})
export class StatsComponent implements OnInit, AfterViewInit {
  selectedChart: string = 'expressions';
  chartOptions: { value: string; label: string }[] = [
    { value: 'expressions', label: 'Average Expressions' },
    { value: 'age', label: 'Average Age' },
    { value: 'gender', label: 'Gender Distribution' },
    { value: 'facesDetected', label: 'Number of Faces Detected' },
    { value: 'faceCover', label: 'Face Coverage' },
  ];

  avgExpressions: string[] = [];
  avgAges: number[] = [];
  avgGenders: string[] = [];
  avgNumOfFacesDetected: number[] = [];
  faceCoverSecondsCount: number = 0;

  private charts: { [key: string]: Chart } = {};

  constructor(private dataService: DataService) {}

  ngOnInit() {
    this.avgExpressions = this.dataService.avgExpressions;
    this.avgAges = this.dataService.avgAges;
    this.avgGenders = this.dataService.avgGenders;
    this.avgNumOfFacesDetected = this.dataService.avgNumOfFacesDetected;
    this.faceCoverSecondsCount = this.dataService.faceCoverSecondsCount;
  }

  @HostListener('window:resize', ['$event'])
  onResize(event: any) {
    this.resizeChart();
  }

  ngAfterViewInit(): void {
    this.createCharts();
    this.showSelectedChart();
    this.resizeChart();
  }

  resizeChart() {
    if (this.charts[this.selectedChart]) {
      this.charts[this.selectedChart].resize();
    }
  }

  showSelectedChart() {
    Object.keys(this.charts).forEach((key) => {
      const chartCanvas = document.getElementById(
        `${key}Chart`
      ) as HTMLCanvasElement;
      if (chartCanvas) {
        chartCanvas.style.display =
          key === this.selectedChart ? 'block' : 'none';
      }
    });
    this.resizeChart();
  }

  createCharts() {
    this.charts['expressions'] = this.createExpressionChart();
    this.charts['age'] = this.createAgeChart();
    this.charts['gender'] = this.createGenderChart();
    this.charts['facesDetected'] = this.createFacesDetectedChart();
    this.charts['faceCover'] = this.createFaceCoverChart();
  }

  onChartSelectionChange() {
    this.showSelectedChart();
  }

  createExpressionChart(): Chart {
    const ctx = document.getElementById(
      'expressionsChart'
    ) as HTMLCanvasElement;
    return new Chart(ctx, {
      type: 'bar' as ChartType,
      data: {
        labels: this.avgExpressions,
        datasets: [
          {
            label: 'Average Expressions',
            data: this.avgExpressions.map(
              (exp) => this.avgExpressions.filter((e) => e === exp).length
            ),
            backgroundColor: 'rgba(255,255,255)',
          },
        ],
      },
      options: {
        responsive: true,
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Count',
            },
          },
        },
      },
    });
  }

  createAgeChart(): Chart {
    const ctx = document.getElementById('ageChart') as HTMLCanvasElement;
    return new Chart(ctx, {
      type: 'line' as ChartType,
      data: {
        labels: this.avgAges.map((_, index) => index * 10),
        datasets: [
          {
            label: 'Average Age',
            data: this.avgAges,
            borderColor: 'rgb(255, 99, 132)',
            tension: 0.1,
          },
        ],
      },
      options: {
        responsive: true,
        scales: {
          x: {
            title: {
              display: true,
              text: 'Time (seconds)',
            },
          },
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Age',
            },
          },
        },
      },
    });
  }

  createGenderChart(): Chart {
    const ctx = document.getElementById('genderChart') as HTMLCanvasElement;
    const genderCounts = this.avgGenders.reduce((acc, gender) => {
      acc[gender] = (acc[gender] || 0) + 1;
      return acc;
    }, {} as { [key: string]: number });

    return new Chart(ctx, {
      type: 'pie' as ChartType,
      data: {
        labels: Object.keys(genderCounts),
        datasets: [
          {
            label: 'Gender Distribution',
            data: Object.values(genderCounts),
            backgroundColor: [
              'rgba(255, 99, 132, 0.6)',
              'rgba(54, 162, 235, 0.6)',
            ],
          },
        ],
      },
      options: {
        responsive: true,
      },
    });
  }

  createFacesDetectedChart(): Chart {
    const ctx = document.getElementById(
      'facesDetectedChart'
    ) as HTMLCanvasElement;
    return new Chart(ctx, {
      type: 'line' as ChartType,
      data: {
        labels: this.avgNumOfFacesDetected.map((_, index) => index * 5),
        datasets: [
          {
            label: 'Average Number of Faces Detected',
            data: this.avgNumOfFacesDetected,
            borderColor: 'rgb(153, 102, 255)',
            tension: 0.1,
          },
        ],
      },
      options: {
        responsive: true,
        scales: {
          x: {
            title: {
              display: true,
              text: 'Time (seconds)',
            },
          },
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Number of Faces',
            },
          },
        },
      },
    });
  }

  createFaceCoverChart(): Chart {
    const ctx = document.getElementById('faceCoverChart') as HTMLCanvasElement;
    return new Chart(ctx, {
      type: 'doughnut' as ChartType,
      data: {
        labels: ['Face Covered', 'Face Visible'],
        datasets: [
          {
            label: 'Face Coverage',
            data: [
              this.faceCoverSecondsCount,
              300 - this.faceCoverSecondsCount,
            ],
            backgroundColor: [
              'rgba(255, 206, 86, 0.6)',
              'rgba(75, 192, 192, 0.6)',
            ],
          },
        ],
      },
      options: {
        responsive: true,
      },
    });
  }
}
