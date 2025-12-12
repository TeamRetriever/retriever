FROM node:20-alpine

WORKDIR /app


COPY mcp/package*.json ./


RUN npm ci

COPY mcp/authentication/ ./authentication/


COPY mcp/src/ ./src/
COPY mcp/tsconfig.json ./


RUN npm run build


RUN npm prune --production


EXPOSE 3000


CMD ["node", "build/src/server.js"]