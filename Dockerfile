# Use an official Node.js image as the base
FROM node:20-slim

# Install Python3, pip, and yt-dlp system-wide
RUN apt-get update && \
    apt-get install -y python3 python3-pip ffmpeg && \
    pip3 install --no-cache-dir yt-dlp && \
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

# Start both backend and serve built frontend
CMD ["node", "server/index.js"]
