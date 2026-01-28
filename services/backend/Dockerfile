FROM node:20-alpine

# Create app directory
WORKDIR /usr/src/app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm ci --only=production || npm install --only=production

# Copy source
COPY src ./src

# Expose port
ENV PORT=8080
EXPOSE 8080

# Start
CMD ["node", "src/index.js"]
