# VideoScraper

VideoScraper is a modern web application that allows users to easily download video files from any URL. It features a Vite + React + TypeScript frontend for a fast and interactive user experience, and a Node.js/Express backend that handles CORS, proxying, and video file streaming.

## Features

- **User-friendly Interface:** Input a URL, visually select video files, and choose where to save them.
- **Fast Frontend:** Built with Vite, React, and TypeScript for optimal performance and maintainability.
- **Secure Backend:** Node.js/Express server handles CORS and streams video files securely.
- **Cross-Origin Support:** Download videos from sites that restrict direct downloads.

## Installation

### Prerequisites

- [Node.js](https://nodejs.org/) (v16 or higher recommended)
- [npm](https://www.npmjs.com/)

### Clone the Repository

```sh
git clone https://github.com/yourusername/VideoScraper.git
cd VideoScraper
```

### Install Frontend Dependencies

```sh
npm install
```

### Install Backend Dependencies

```sh
cd server
npm install
cd ..
```

## Usage

### Start the Backend Server

```sh
cd server
npm start
```

### Start the Frontend (Vite)

```sh
npm run dev
```

### Access the App

Open your browser and go to [http://localhost:5173](http://localhost:5173)

## How It Works

1. **Enter a URL:** Paste the page URL containing the video.
2. **Select Video:** The app fetches and lists available video files for download.
3. **Download:** Choose a video and select where to save it. The backend streams the file to your browser.

## Project Structure

```
VideoScraper/
├── src/            # React frontend source code
├── server/         # Node.js/Express backend
├── public/         # Static assets
├── package.json    # Frontend dependencies
├── README.md       # Project documentation
└── ...
```

## Notes

- The backend is required to bypass CORS and stream video files.
- The frontend proxies `/api` requests to the backend during development.

## License

MIT
