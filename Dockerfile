# Use an official Node.js image as the base
FROM node:18-slim

# Install Python3, pip, ffmpeg, and the latest yt-dlp from GitHub
RUN apt-get update && \
    apt-get install -y python3 python3-pip ffmpeg curl && \
    curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp && \
    chmod a+rx /usr/local/bin/yt-dlp && \
    rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files and install root dependencies
COPY package.json package-lock.json* ./
RUN npm install

# Copy server and install backend dependencies
COPY server ./server
RUN cd server && npm install && cd ..

# Copy frontend source
COPY . .

# Build frontend
RUN npm run build

# Expose backend port
EXPOSE 6969

# Start backend (serves built frontend)
CMD ["node", "server/index.js"]
