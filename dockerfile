# 1. Use Node.js base image
FROM node:22

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