import { CommonModule } from '@angular/common';
import {
  Component,
  OnInit,
  OnDestroy,
  ElementRef,
  ViewChild,
  NgZone,
  EventEmitter,
  Output,
} from '@angular/core';
import { RouterModule } from '@angular/router';
import * as faceapi from 'face-api.js';

@Component({
  selector: 'app-device-check',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './device-check.component.html',
  styleUrl: './device-check.component.css',
})
export class DeviceCheckComponent implements OnInit, OnDestroy {
  @Output() deviceCheckComplete: EventEmitter<boolean> =
    new EventEmitter<boolean>();
  @ViewChild('videoElement') videoElement!: ElementRef<HTMLVideoElement>;

  private stream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private dataArray: Uint8Array | null = null;
  private animationFrameId: number | null = null;
  private faceDetectionInterval!: NodeJS.Timeout;

  public audioLevel: number = 0;
  private isVoiceDetected: boolean = false;
  private isFaceDetected: boolean = false;
  public startedChecking: boolean = false;

  constructor(private ngZone: NgZone) {}

  ngOnInit() {}

  ngOnDestroy() {
    this.stopDeviceCheck();
  }

  public async startDeviceCheck(): Promise<void> {
    this.startedChecking = true;
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

      // Start face detection
      this.startFaceDetection();
    } catch (error) {
      alert('Please allow webcam access');
      console.error('Error accessing media devices:', error);
    }
  }

  private startFaceDetection(): void {
    const videoElement = this.videoElement.nativeElement;
    this.faceDetectionInterval = setInterval(async () => {
      const detections = await faceapi.detectAllFaces(
        videoElement,
        new faceapi.SsdMobilenetv1Options()
      );
      this.isFaceDetected = detections.length > 0;
      this.checkDevicesReady();
    }, 1000); // Check every second
  }

  private checkDevicesReady(): void {
    if (this.isVoiceDetected && this.isFaceDetected) {
      this.devicesReady();
    }
  }

  private devicesReady(): void {
    this.deviceCheckComplete.emit(true);
  }

  private stopDeviceCheck(): void {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
    }
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }
    if (this.audioContext) {
      this.audioContext.close();
    }
    if (this.faceDetectionInterval) {
      clearInterval(this.faceDetectionInterval);
    }
  }

  private updateAudioLevel(): void {
    this.ngZone.runOutsideAngular(() => {
      if (this.analyser && this.dataArray) {
        this.analyser.getByteFrequencyData(this.dataArray);
        const average =
          this.dataArray.reduce((acc, val) => acc + val, 0) /
          this.dataArray.length;

        this.ngZone.run(() => {
          this.audioLevel = Math.min(100, (average / 128) * 100); // Normalize to 0-100 range
          this.isVoiceDetected = this.audioLevel > 5; // Adjust this threshold as needed
          this.checkDevicesReady();
        });
      }
      this.animationFrameId = requestAnimationFrame(() =>
        this.updateAudioLevel()
      );
    });
  }
}
