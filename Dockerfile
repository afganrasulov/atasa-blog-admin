FROM node:20-slim

# Install ffmpeg, python3 and pip for yt-dlp
RUN apt-get update && apt-get install -y \
    ffmpeg \
    python3 \
    python3-pip \
    python3-venv \
    chromium \
    && rm -rf /var/lib/apt/lists/*

# Install yt-dlp
RUN pip3 install --break-system-packages yt-dlp

# Verify installations
RUN yt-dlp --version && ffmpeg -version | head -1

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies with puppeteer using system chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
RUN npm install --production

# Copy source code
COPY . .

# Expose port
EXPOSE 3000

# Set environment
ENV PORT=3000
ENV NODE_ENV=production

# Start the app
CMD ["npm", "start"]