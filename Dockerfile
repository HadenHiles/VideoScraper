# Use an official Node.js image as the base
FROM node:18

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
EXPOSE 4000

# Start both backend and serve built frontend
CMD ["node", "start.js"]
