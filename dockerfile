# 1. Use Node.js base image
FROM node:22

# Install system dependencies
# zstd: required for tar --zstd to extract VNDB dump archives
RUN apt-get update && apt-get install -y --no-install-recommends zstd && rm -rf /var/lib/apt/lists/*

# node:22 ships npm 10, which resolves optional peer dependencies differently
# than the npm 11 the lock files are generated with — npm 10 tries to install
# vite's optional `esbuild` peer and then fails `npm ci` because those entries
# aren't in the lock. Pin the major so the build consumes the lock exactly as
# it was written.
RUN npm install -g npm@11

# 2. Set working directory
WORKDIR /app

# 3. Copy backend package files and install dependencies
COPY Backend/package*.json ./Backend/
WORKDIR /app/Backend
RUN npm ci

# 4. Copy frontend package files and install dependencies
WORKDIR /app
COPY Frontend/package*.json ./Frontend/
WORKDIR /app/Frontend
RUN npm ci

# 5. Copy rest of the code
WORKDIR /app
COPY Backend ./Backend
COPY Frontend ./Frontend

# 6. Build frontend and copy to backend
WORKDIR /app/Frontend
# Remove .env.local to ensure production build uses .env.production
RUN rm -f .env.local
RUN npm run build
RUN cp -r dist ../Backend/dist

# 7. Build backend (if using TypeScript)
WORKDIR /app/Backend
RUN npm run build

# 8. Expose port
EXPOSE 3000

# 9. Start the backend
CMD ["node", "build/index.js"]