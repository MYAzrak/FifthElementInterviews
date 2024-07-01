import { Component, OnInit, OnDestroy } from '@angular/core';
import { Chart, registerables } from 'chart.js';
import { DataService } from '../services/data.service';
import { Subscription } from 'rxjs';

Chart.register(...registerables);

@Component({
  selector: 'app-stats',
  standalone: true,
  imports: [],
  templateUrl: './stats.component.html',
  styleUrl: './stats.component.css',
})
export class StatsComponent implements OnInit, OnDestroy {
  private subscriptions: Subscription[] = [];
  private charts: Chart[] = [];

  constructor(private dataService: DataService) {}

  ngOnInit() {
    this.createCharts();
  }

  ngOnDestroy() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
    this.charts.forEach(chart => chart.destroy());
    this.dataService.clearAllData();
  }

  private createCharts() {
    this.createExpressionChart();
    this.createAgeChart();
    this.createGenderChart();
    this.createFacesDetectedChart();
    this.createFaceCoverChart();
  }

  private createExpressionChart() {
    const ctx = document.getElementById('expressionChart') as HTMLCanvasElement;
    const chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: [],
        datasets: [{
          label: 'Average Expression',
          data: [],
          borderColor: 'rgb(75, 192, 192)',
          tension: 0.1
        }]
      },
      options: {
        responsive: true,
        scales: {
          x: {
            type: 'linear',
            position: 'bottom',
            title: {
              display: true,
              text: 'Time (minutes)'
            }
          },
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Expression'
            }
          }
        }
      }
    });
    this.charts.push(chart);

    this.subscriptions.push(
      this.dataService.avgExpressions$.subscribe(data => {
        chart.data.labels = data.map((_, index) => index * 3);
        chart.data.datasets[0].data = data.map(exp => this.expressionToNumber(exp));
        chart.update();
      })
    );
  }

  private expressionToNumber(expression: string): number {
    const expressionMap: {[key: string]: number} = {
      'neutral': 0,
      'happy': 1,
      'sad': -1,
      'angry': -2,
      'fearful': -1.5,
      'disgusted': -1.8,
      'surprised': 0.5
    };
    return expressionMap[expression] || 0;
  }

  // Implement similar methods for other charts:
  // private createAgeChart() { ... }
  // private createGenderChart() { ... }
  // private createFacesDetectedChart() { ... }
  // private createFaceCoverChart() { ... }
}
