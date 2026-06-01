# Docker & Containerized Deployment

This guide explains how to run the `stock-scanner-mcp` server or Sidecar in a containerized environment, with a focus on persisting workspace data.

## 💾 Workspace Persistence

When the Workspace module is enabled (`--enable-workspace`), the server saves user profiles, watchlists, and investment theses to a local directory. By default, this is `~/.stock-scanner-mcp`.

In a Docker environment, you must mount a host directory to the container to ensure this data is not lost when the container is restarted.

### Docker CLI Example

```bash
docker run -d \
  --name stock-scanner-sidecar \
  -p 3200:3200 \
  -v $(pwd)/my-market-data:/data \
  -e FINNHUB_API_KEY=your_key \
  stock-scanner-mcp \
  npx stock-scanner-sidecar --enable-workspace --data-dir /data
```

### Docker Compose Example

```yaml
services:
  sidecar:
    image: stock-scanner-mcp
    ports:
      - "3200:3200"
    environment:
      - FINNHUB_API_KEY=${FINNHUB_API_KEY}
    volumes:
      - ./market-data:/data
    command: npx stock-scanner-sidecar --enable-workspace --data-dir /data
```

## 🏗️ Building the Image

If you are building your own image, ensure the `dist` and `skills` directories are included.

```dockerfile
FROM node:20-slim
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
# Ensure the data directory exists and is writable
RUN mkdir -p /data && chmod 777 /data
EXPOSE 3200
```

## 🔐 Security Considerations

- **API Keys**: Always pass API keys via environment variables, never hardcode them in the Dockerfile.
- **Volume Permissions**: Ensure the host directory mounted to `/data` has appropriate write permissions for the Node.js process inside the container.
