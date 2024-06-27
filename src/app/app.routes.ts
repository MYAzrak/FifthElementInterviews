import { Routes } from '@angular/router';
import { StartComponent } from './start/start.component';
import { WebcamComponent } from './webcam/webcam.component';

export const routes: Routes = [
  {
    path: '',
    component: StartComponent,
    title: `Start Recording`,
  },
  { path: 'webcam', component: WebcamComponent, title: `Recording Webcam` },
];
