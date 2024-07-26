# FaceAPI-Angular

This Angular-based project provides an AI-powered simulated interview platform for job seekers to prepare for real interviews. The application uses facial recognition, expression analysis, and screen recording to create a comprehensive interview preparation experience.

## Features

- Webcam integration for facial recognition and analysis
- Real-time detection of facial expressions, age, gender, number of faces, and face coverage
- Screen recording capability
- Fullscreen mode enforcement
- Timer for interview duration
- Disqualification system for rule violations
- Post-interview statistics and analysis

## Prerequisites

- Node.js and npm (Node Package Manager)
- Angular CLI

## Installation

1. Clone the repository:

   ```sh
   git clone <repo-link>
   ```

2. Navigate to the project directory:

   ```sh
   cd FaceAPI-Angular
   ```

3. Install dependencies:

   ```sh
   npm install
   ```

## Running the Application

To start the development server, run:

```text
ng serve
```

Navigate to `http://localhost:4200/` in your browser. The application will automatically reload if you change any of the source files.

## Usage

1. Click "Begin Interview" to start the process.
2. Grant necessary permissions for webcam and screen recording.
3. The interview will start in fullscreen mode.
4. After the interview, view your performance statistics.

## Privacy Considerations

Before using the application, users must accept the following conditions:

- The interview will be recorded and saved for 3 months.
- The user's screen will be recorded during the interview.

## Technical Overview

### Webcam Component

The webcam component (`WebcamComponent`) handles the following:

- Webcam integration and facial detection using [face-api.js](https://github.com/justadudewhohacks/face-api.js)
- Screen recording functionality
- Timer management
- Fullscreen enforcement
- Data collection for facial expressions, age, gender, etc.

### Stats Component

The stats component (`StatsComponent`) provides:

- Post-interview analysis of collected data
- Charts for visualizing expression, age, gender, and face detection data
- Summary of the candidate's performance

### Device Check Component

The device-check  component (`DeviceCheckComponent`) ensures the functionality of key candidate devices:

- Webcam Functionality: Verifies that the webcam is working and utilizes [face-api.js](https://github.com/justadudewhohacks/face-api.js) to make sure that candidate's face is visible
- Microphone Functionality: Checks that the microphone is operational
