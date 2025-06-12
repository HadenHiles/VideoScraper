# Video Scraper

A web application to scrape and download video files from any URL. Built with Vite + React + TypeScript frontend and a Node.js/Express backend for proxying and video streaming.

## Features

- Input a URL to scrape for video files
- Visually select a video to preview and download
- Download videos directly to your machine (CORS handled by backend)

## Getting Started

### 1. Install dependencies

```
npm install
cd server && npm install
```

### 2. Start the backend server

```
cd server
npm start
```

### 3. Start the frontend (in project root)

```
npm run dev
```

- Frontend: http://localhost:5173
- Backend: http://localhost:4000

## Project Structure

- `/src` — React frontend
- `/server` — Express backend for proxying and video streaming

## Notes

- The backend is required to bypass CORS and stream video files.
- The frontend proxies `/api` requests to the backend during development.

---

MIT License
