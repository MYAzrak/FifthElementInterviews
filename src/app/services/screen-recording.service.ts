import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class ScreenRecordingService {
  private recorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private recordingStatusSubject = new BehaviorSubject<boolean>(false);
  public recordingStatus$: Observable<boolean> =
    this.recordingStatusSubject.asObservable();

  private chunks: Blob[] = [];

  constructor() {}

  async startRecording(): Promise<void> {
    try {
      this.stream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: 'monitor' },
      });

      const videoTrack = this.stream.getVideoTracks()[0];
      if (videoTrack.getSettings().displaySurface !== 'monitor') {
        this.stopRecording();
        throw new Error('Please select the entire screen for recording.');
      }

      this.recorder = new MediaRecorder(this.stream);
      this.chunks = [];

      this.recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.chunks.push(event.data);
        }
      };

      this.recorder.onstop = () => {
        this.saveRecording();
      };

      this.recorder.start();
      this.recordingStatusSubject.next(true);
    } catch (err) {
      console.error('Error starting screen recording:', err);
      this.recordingStatusSubject.next(false);
      throw err;
    }
  }

  stopRecording(): void {
    if (this.recorder && this.recorder.state !== 'inactive') {
      this.recorder.stop();
    }
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
    }
    this.recordingStatusSubject.next(false);
  }

  private saveRecording(): void {
    const blob = new Blob(this.chunks, { type: 'video/webm' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    document.body.appendChild(a);
    a.style.display = 'none';
    a.href = url;
    a.download = 'screen_recording.webm';
    a.click();
    window.URL.revokeObjectURL(url);
  }

  isRecording(): boolean {
    return this.recorder !== null && this.recorder.state === 'recording';
  }

  getRecordingStatus(): Observable<boolean> {
    return this.recordingStatus$;
  }
}
