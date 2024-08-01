import { Routes } from '@angular/router';
import { WebcamComponent } from './webcam/webcam.component';
import { StatsComponent } from './stats/stats.component';

export const routes: Routes = [
  {
    path: '',
    component: WebcamComponent,
    title: `The Fifth Element Interviews`,
  },
  {
    path: 'stats',
    component: StatsComponent,
    title: `Interview Statistics`,
  },
];
