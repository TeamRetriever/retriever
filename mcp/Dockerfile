FROM node:20-alpine

WORKDIR /app


COPY package*.json ./
COPY tsconfig.json ./
COPY authentication/ ./authentication/
COPY src/ ./src/


RUN npm ci && npm run build

EXPOSE 3000

CMD ["node", "build/src/server.js"]