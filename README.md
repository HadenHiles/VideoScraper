# VideoScraper

VideoScraper is a modern web application that allows users to easily download video files from any URL. It features a Vite + React + TypeScript frontend for a fast and interactive user experience, and a Node.js/Express backend that handles CORS, proxying, and video file streaming.

## Features

- **User-friendly Interface:** Input a URL, visually select video files, and choose where to save them.
- **Fast Frontend:** Built with Vite, React, and TypeScript for optimal performance and maintainability.
- **Secure Backend:** Node.js/Express server handles CORS and streams video files securely.
- **Cross-Origin Support:** Download videos from sites that restrict direct downloads.
- **Advanced Extraction:** Automatic fallback to browser-based extraction (Playwright/Puppeteer) for sites like TikTok, YouTube, Instagram, etc.
- **Proxy Support:** Optionally use a proxy for TikTok and other sites that block scraping.
- **Fun Loading Animation:** Enjoy a playful loader while videos are being extracted.

## Installation

### Prerequisites

- [Node.js](https://nodejs.org/) (v16 or higher recommended)
- [npm](https://www.npmjs.com/)
- [Docker](https://www.docker.com/) and [Docker Compose](https://docs.docker.com/compose/) (for containerized setup)

### Clone the Repository

```sh
git clone https://github.com/yourusername/VideoScraper.git
cd VideoScraper
```

### Install All Dependencies (for local/dev)

```sh
npm install
cd server && npm install && cd ..
```

## Usage

### Start Everything (Frontend & Backend, Local Dev)

```sh
npm run build
cd server && npm start
```

- The backend will run on port **6969** and serve the built frontend.
- Access the app at [http://localhost:6969](http://localhost:6969)

---

## Docker Deployment

### Build and Run with Docker Compose

1. Build and start the container:

   ```sh
   docker-compose up --build -d
   ```

   - The app will auto-restart on reboot or crash (`unless-stopped`).
   - The backend and frontend are both served from: [http://localhost:6969](http://localhost:6969)

2. To stop the container:

   ```sh
   docker-compose down
   ```

3. To view logs:
   ```sh
   docker-compose logs -f
   ```

### Custom Domain (Optional)

- To use a custom domain like `vid.scraper`, add this to your hosts file:
  ```
  127.0.0.1   vid.scraper
  ```
- Then access the app at [http://vid.scraper:6969](http://vid.scraper:6969)
- **Note:** The hosts file cannot map a domain to a port. You must still specify `:6969` in the URL unless you use a reverse proxy (see below).

### Reverse Proxy (Optional)

- To use just `http://vid.scraper` (without the port), set up a local reverse proxy (e.g., Nginx) to forward port 80 to 6969.

## Project Structure

```
VideoScraper/
├── src/            # React frontend source code
├── server/         # Node.js/Express backend
├── dist/           # Built frontend (served by backend)
├── Dockerfile      # Docker build instructions
├── docker-compose.yml # Docker Compose config
├── package.json    # Project dependencies and scripts
├── README.md       # Project documentation
└── ...
```

## Notes

- The backend is required to bypass CORS and stream video files.
- The backend now serves the built frontend for all non-API routes.
- For TikTok and similar sites, you may need a working residential proxy for reliable extraction. See server logs for proxy usage.

## License

MIT
