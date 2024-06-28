import { Routes } from '@angular/router';
import { WebcamComponent } from './webcam/webcam.component';
import { StatsComponent } from './stats/stats.component';

export const routes: Routes = [
  {
    path: '',
    component: WebcamComponent,
    title: `FaceAPI-Angular`,
  },
  {
    path: 'stats',
    component: StatsComponent,
    title: `Interview Statistics`,
  },
];
