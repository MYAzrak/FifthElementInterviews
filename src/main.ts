import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';
import { WebcamComponent } from './app/webcam/webcam.component';

bootstrapApplication(WebcamComponent, appConfig)
  .catch((err) => console.error(err));
