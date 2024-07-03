import { Component, OnInit, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Chart, ChartType } from 'chart.js/auto';
import { Router } from '@angular/router';
import { math } from '@tensorflow/tfjs-core';

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
  avgGenders: number[] = [];
  avgNumOfFacesDetected: number[] = [];
  faceCoverSecondsCount: number = 0;

  private charts: { [key: string]: Chart } = {};

  restartProcess() {
    this.router.navigate(['']);
  }

  constructor(private router: Router) {}

  ngOnInit() {
    const data = localStorage.getItem('webcamData');
    if (data) {
      const parsedData = JSON.parse(data);
      this.avgExpressions = parsedData.avgExpressions;
      this.avgAges = parsedData.avgAges;
      this.avgGenders = parsedData.avgGenders;
      this.avgNumOfFacesDetected = parsedData.avgNumOfFacesDetected;
      this.faceCoverSecondsCount = parsedData.faceCoverSecondsCount;
    }
    this.printResults();
  }

  ngAfterViewInit(): void {
    this.createCharts();
    this.showSelectedChart();
  }

  createCharts() {
    this.charts['expressions'] = this.createExpressionChart();
    this.charts['age'] = this.createAgeChart();
    this.charts['gender'] = this.createGenderChart();
    this.charts['facesDetected'] = this.createFacesDetectedChart();
    this.charts['faceCover'] = this.createFaceCoverChart();
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
  }

  onChartSelectionChange() {
    this.showSelectedChart();
  }

  getCandidateGender(): string {
    if (this.avgGenders.length === 0) return `Gender data not available.`;
    const sumGenders: number = this.avgGenders.reduce(
      (acc, curr) => acc + curr
    );
    const candidateGender: string =
      Math.floor(sumGenders / this.avgGenders.length) === 0 ? `Male` : `Female`;
    return `The candidate is a ${candidateGender}.`;
  }

  getCandidateAge(): string {
    if (this.avgAges.length === 0) return `Age data not available.`;
    const sumAges: number = this.avgAges.reduce((acc, curr) => acc + curr);
    const candidateAge: number = sumAges / this.avgAges.length;
    return `They are ${candidateAge.toFixed(1)} years old.`;
  }

  getNumOfFacesDetected(): number {
    if (this.avgNumOfFacesDetected.length === 0) return 1;
    const sumFaces: number = this.avgNumOfFacesDetected.reduce(
      (acc, curr) => acc + curr
    );
    return Math.ceil(sumFaces / this.avgNumOfFacesDetected.length);
  }

  getCandidateExpression(): string {
    const expressionsCount: { [key: string]: number } = {
      neutral: 0,
      happy: 0,
      sad: 0,
      angry: 0,
      fearful: 0,
      disgusted: 0,
      surprised: 0,
    };

    this.avgExpressions.forEach((expr) => {
      expressionsCount[expr]++;
    });

    const maxCount = Math.max(...Object.values(expressionsCount));
    const overallExpression = Object.keys(expressionsCount).find(
      (expression) => expressionsCount[expression] === maxCount
    );

    return `Their overall expression during the interview was ${overallExpression}.`;
  }

  printResults() {
    const textElement: HTMLElement | null = document.getElementById(`text`);
    let summary: string[] = [];

    summary.push(this.getCandidateGender());

    summary.push(this.getCandidateAge());

    // If the face was covered for more than 10 seconds
    if (this.faceCoverSecondsCount > 10) {
      summary.push(
        `The candidate's face was covered for ${this.faceCoverSecondsCount}
        seconds which indicates a high cheating possibility.`
      );
    }

    // Num of faces detected
    const detectedFaces: number = this.getNumOfFacesDetected();
    if (detectedFaces !== 1) {
      summary.push(
        `The number of faces that were detected was ${detectedFaces.toFixed(
          1
        )} which indicates a cheating possibility.`
      );
    }

    summary.push(this.getCandidateExpression());

    if (textElement) {
      textElement.textContent = summary.join(' ');
    }
  }

  createExpressionChart(): Chart {
    const ctx = document.getElementById(
      'expressionsChart'
    ) as HTMLCanvasElement;

    const timeIntervals = this.avgExpressions.map((_, index) => index);
    const uniqueExpressions = [...new Set(this.avgExpressions)];

    const data = this.avgExpressions
      .slice(0)
      .map((exp) => uniqueExpressions.indexOf(exp));

    return new Chart(ctx, {
      type: 'line' as ChartType,
      data: {
        labels: timeIntervals,
        datasets: [
          {
            label: 'Expressions',
            data: data,
            borderColor: 'black',
            borderWidth: 2,
            fill: false,
            pointRadius: 0,
            stepped: true,
          },
        ],
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            display: false,
          },
        },
        scales: {
          x: {
            title: {
              display: true,
              text: `Time (minutes)`,
            },
            grid: {
              display: false,
            },
          },
        },
        layout: {
          padding: {
            top: 30,
          },
        },
      },
      plugins: [
        {
          id: 'expressionLabels',
          afterDraw: (chart) => {
            const ctx = chart.ctx;
            chart.data.datasets[0].data.forEach((_, index) => {
              const meta = chart.getDatasetMeta(0);
              const x = meta.data[index].x;
              const y = meta.data[index].y;
              ctx.save();
              ctx.textAlign = 'center';
              ctx.textBaseline = 'bottom';
              ctx.fillStyle = 'black';
              ctx.fillText(this.avgExpressions[index], x, y - 10);
              ctx.restore();
            });
          },
        },
      ],
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
    return new Chart(ctx, {
      type: 'line' as ChartType,
      data: {
        labels: this.avgGenders.map((_, index) => index * 10),
        datasets: [
          {
            label: 'Average Gender',
            data: this.avgGenders,
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
              text: 'Gender (0 = Male)',
            },
          },
        },
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
      type: 'bar' as ChartType,
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
