import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class ScreenRecordingService {
  private recorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private isInterviewCompleted: boolean = false;
  private isInsideInterview: boolean = false;

  public setIsInterviewCompleted(isCompleted: boolean): void {
    this.isInterviewCompleted = isCompleted;
  }

  public setIsInsideInterview(isInside: boolean): void {
    this.isInsideInterview = isInside;
  }

  // Called when the button id="capture" is pressed for screen recording
  public async startRecording(
    changeModalCallback: (modalName: string) => void,
    changeCaptureButtonsCallback: (enableButtons: boolean) => void,
    highlightTextCallback: () => void
  ): Promise<void> {
    try {
      // Screen Capture API
      this.stream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: 'monitor' },
      });

      // Check if the user selected the entire screen
      const videoTrack = this.stream.getVideoTracks()[0];
      if (videoTrack.getSettings().displaySurface !== 'monitor') {
        this.stopRecording();
        throw new Error('Please select the entire screen for recording.');
      }

      // MediaStream Recording API
      this.recorder = new MediaRecorder(this.stream);
      this.recorder.start();

      this.recorder.addEventListener('dataavailable', (evt) => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(evt.data);
        a.download = 'screen_capture.mp4';
        a.click();
      });

      this.recorder.addEventListener('stop', () => {
        // Candidate stopped recording before entering the interview
        if (!this.isInterviewCompleted && !this.isInsideInterview) {
          alert(
            'Please do not stop the screen recording before finishing the interview.'
          );
          changeModalCallback('screenRecord');
          changeCaptureButtonsCallback(true);
        }

        // Candidate stopped recording during the interview
        if (!this.isInterviewCompleted && this.isInsideInterview) {
          this.startRecording(
            changeModalCallback,
            changeCaptureButtonsCallback,
            highlightTextCallback
          );
        }
      });

      changeCaptureButtonsCallback(false);
    } catch (err) {
      console.error('Error starting screen recording:', err);
      if (err instanceof Error && err.name === 'NotAllowedError') {
        alert(
          'Screen recording permission denied. Please try again and allow screen recording.'
        );
        if (!this.isInterviewCompleted && this.isInsideInterview) {
          this.startRecording(
            changeModalCallback,
            changeCaptureButtonsCallback,
            highlightTextCallback
          );
        }
      } else {
        alert('Please try again and ensure you select the "Entire Screen".');
        if (!this.isInterviewCompleted && this.isInsideInterview) {
          this.startRecording(
            changeModalCallback,
            changeCaptureButtonsCallback,
            highlightTextCallback
          );
        }
      }
      highlightTextCallback();
    }
  }

  // Stops the screen recording in case of disqualification or interview end
  public stopRecording(): void {
    if (this.recorder && this.recorder.state !== 'inactive') {
      this.recorder.stop();
    }
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
    }
  }
}
