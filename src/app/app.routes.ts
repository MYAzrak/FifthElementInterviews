import { RouterModule, Routes } from '@angular/router';
import { WebcamComponent } from './webcam/webcam.component';
import { AppComponent } from './app.component';

export const routes: Routes = [
  { path: '', component: AppComponent },
  { path: 'webcam', component: WebcamComponent },
];

