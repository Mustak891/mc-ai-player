# MC AI Player

A React Native mobile application built with Expo for playing media files, potentially integrated with AI features.

## Prerequisites

Before you begin, ensure you have the following installed:
- [Node.js](https://nodejs.org/) (LTS version recommended)
- [npm](https://www.npmjs.com/) or [yarn](https://yarnpkg.com/)
- [Expo Go](https://expo.dev/client) app on your iOS or Android device (for physical device testing)

## Getting Started

### 1. Clone the repository
```bash
git clone <repository-url>
cd mc-ai-player
```

### 2. Install dependencies
```bash
npm install
```

### 3. Start the development server
```bash
npm start
```
This will start the Expo CLI. You can then scan the QR code with the Expo Go app or use the following commands:

- Press **`a`** for Android emulator
- Press **`i`** for iOS simulator
- Press **`w`** for web browser

## Available Scripts

In the project directory, you can run:

- `npm start`: Runs the app in development mode using Expo.
- `npm run android`: Opens the app on an Android emulator.
- `npm run ios`: Opens the app on an iOS simulator.
- `npm run web`: Opens the app in a web browser.

## Project Structure

- `App.tsx`: The main entry point of the application.
- `src/`: Contains the source code.
    - `navigation/`: Navigation configurations (Stack, Tabs).
    - `screens/`: Application screens (e.g., `PlayerScreen`).
    - `constants/`: Theme and other constant values.
    - `components/`: Reusable UI components.
