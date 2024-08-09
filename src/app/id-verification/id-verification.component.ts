import {
  Component,
  ElementRef,
  EventEmitter,
  OnDestroy,
  OnInit,
  Output,
  ViewChild,
} from '@angular/core';
import { createWorker } from 'tesseract.js';
import * as faceapi from 'face-api.js';

@Component({
  selector: 'app-id-verification',
  standalone: true,
  imports: [],
  templateUrl: './id-verification.component.html',
  styleUrl: './id-verification.component.css',
})
export class IdVerificationComponent implements OnInit, OnDestroy {
  @Output() isIDVerified: EventEmitter<boolean> = new EventEmitter<boolean>();
  private stream: MediaStream | null = null;

  // For the screenshot option
  @ViewChild('video') video!: ElementRef<HTMLVideoElement>;
  private canvas: HTMLCanvasElement = document.createElement('canvas');
  private context: CanvasRenderingContext2D;

  // For uploading images option
  private selectedFile: File | null = null;

  // Face matching using faceapi.js
  private candidateName: string = 'Mohammad';
  public areFacesMatching: boolean = false; // True if the face on the ID matches the face on the webcam
  public areNamesMatching: boolean = false; // True if the name on the ID matches the name we have of the candidate

  constructor() {
    this.context = this.canvas.getContext('2d') as CanvasRenderingContext2D;
  }

  ngOnInit(): void {
    this.startVideo();
  }

  ngOnDestroy(): void {
    this.stopVideo();
  }

  // Asks for webcam permission to start the process
  private async startVideo(): Promise<void> {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ video: true });
      this.video.nativeElement.srcObject = this.stream;
      this.video.nativeElement.addEventListener('loadedmetadata', () => {
        this.canvas.width = this.video.nativeElement.videoWidth;
        this.canvas.height = this.video.nativeElement.videoHeight;
      });
    } catch (err) {
      console.error('Error accessing the webcam:', err);
    }
  }

  // Called by ngOnDestroy()
  private stopVideo(): void {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
    }
    if (this.video?.nativeElement) {
      this.video.nativeElement.srcObject = null;
    }
  }

  // Extracts text from the screenshot or the uploaded file suing tesseract.js
  public async extractText(isIDUploaded: boolean) {
    let IDImage: HTMLCanvasElement | string;
    (async () => {
      const worker = await createWorker('eng');
      if (isIDUploaded) {
        IDImage = (await this.readFile(this.selectedFile!)) as string;
        this.matchFaces(IDImage);
      } else {
        IDImage = this.drawToCanvas();
        this.matchFaces(IDImage.toDataURL());
      }
      const tesseractObj = await worker.recognize(IDImage);
      this.matchNames(tesseractObj.data.text);
      await worker.terminate();
    })();
  }

  // Simulates taking a screenshot of the current webcam view
  private drawToCanvas(): HTMLCanvasElement {
    this.context.drawImage(
      this.video.nativeElement,
      0,
      0,
      this.canvas.width,
      this.canvas.height
    );
    return this.canvas;
  }

  // Called when the user uploads a file
  public onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.selectedFile = input.files[0];
    } else {
      console.error('No file selected');
      return;
    }
    this.extractText(true);
  }

  // Read the file uploaded from the user
  private readFile(file: File): Promise<string | ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string | ArrayBuffer);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  private async matchFaces(IDImageSrc: string): Promise<void> {
    // Pauses for 3 seconds before matching
    await new Promise<void>((resolve) =>
      setTimeout(() => {
        resolve();
      }, 3000)
    );

    // The reference image, either an uploaded photo or a screenshot
    const referenceFace: HTMLImageElement = document.getElementById(
      'reference-image'
    ) as HTMLImageElement;
    referenceFace.setAttribute('src', IDImageSrc);

    try {
      // The descriptor used by faceapi for matching faces
      const referenceFaceDescriptor = await faceapi
        .detectSingleFace(referenceFace)
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!referenceFaceDescriptor)
        throw new Error('No face detected in the reference image');

      const faceMatcher: faceapi.FaceMatcher = new faceapi.FaceMatcher(
        referenceFaceDescriptor
      );

      // Matching the 2 faces
      const userFaceDescriptor = await faceapi
        .detectSingleFace(
          this.video.nativeElement,
          new faceapi.SsdMobilenetv1Options()
        )
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!userFaceDescriptor) throw new Error('No face detected in the video');

      const matchResult = faceMatcher.findBestMatch(
        userFaceDescriptor.descriptor
      );
      this.areFacesMatching = !matchResult.toString().includes('unknown');
      if (!this.areFacesMatching) {
        alert(
          "The person in the ID isn't the same person showing on the webcam. Please try again."
        );
      } else {
        this.checkIDVerified();
      }
    } catch (error) {
      console.error('Error in face matching:', error);
      alert('An error occurred during face matching. Please try again.');
    }
  }

  private matchNames(extractedText: string): void {
    this.areNamesMatching = extractedText
      .toLowerCase()
      .includes(this.candidateName.toLowerCase());
    if (!this.areNamesMatching) {
      alert(
        "The name in the ID isn't the same name you applied with. Please try again."
      );
    } else {
      this.checkIDVerified();
    }
  }

  private checkIDVerified(): void {
    if (this.areFacesMatching && this.areNamesMatching) {
      this.verifyID();
    }
  }

  private verifyID(): void {
    this.isIDVerified.emit(true);
  }
}
