import { CommonModule } from '@angular/common';
import {
  Component,
  OnInit,
  OnDestroy,
  ElementRef,
  ViewChild,
  NgZone,
} from '@angular/core';
import { Router, RouterModule } from '@angular/router';

@Component({
  selector: 'app-device-check',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './device-check.component.html',
  styleUrl: './device-check.component.css',
})
export class DeviceCheckComponent implements OnInit, OnDestroy {
  @ViewChild('videoElement') videoElement!: ElementRef<HTMLVideoElement>;

  private stream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private dataArray: Uint8Array | null = null;
  private animationFrameId: number | null = null;

  audioLevel: number = 0;
  checkComplete: boolean = false;

  constructor(private ngZone: NgZone, private router: Router) {}

  ngOnInit() {}

  ngOnDestroy() {
    this.stopDeviceCheck();
  }

  async startDeviceCheck() {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      // Set up video
      const videoElement = this.videoElement.nativeElement;
      videoElement.srcObject = this.stream;
      videoElement.muted = true;

      // Set up audio analyser
      this.audioContext = new (window.AudioContext ||
        (window as any).webkitAudioContext)();
      const source = this.audioContext.createMediaStreamSource(this.stream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      source.connect(this.analyser);

      this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
      this.updateAudioLevel();

      this.checkComplete = true;
    } catch (error) {
      console.error('Error accessing media devices:', error);
    }
  }

  stopDeviceCheck() {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
    }
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }
    if (this.audioContext) {
      this.audioContext.close();
    }
    this.checkComplete = false;
  }

  updateAudioLevel() {
    this.ngZone.runOutsideAngular(() => {
      if (this.analyser && this.dataArray) {
        this.analyser.getByteFrequencyData(this.dataArray);
        const average =
          this.dataArray.reduce((acc, val) => acc + val, 0) /
          this.dataArray.length;

        this.ngZone.run(() => {
          this.audioLevel = Math.min(100, (average / 128) * 100); // Normalize to 0-100 range
        });
      }
      this.animationFrameId = requestAnimationFrame(() =>
        this.updateAudioLevel()
      );
    });
  }
}
