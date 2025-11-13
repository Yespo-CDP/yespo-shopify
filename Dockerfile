FROM node:18-alpine
RUN apk add --no-cache openssl

EXPOSE 3000

WORKDIR /app

ENV NODE_ENV=production

COPY package.json package-lock.json* ./

# Install all dependencies (including dev) for build
RUN npm ci && npm cache clean --force
# Remove CLI packages since we don't need them in production by default.
# Remove this line if you want to run CLI commands in your container.
RUN npm remove @shopify/cli

COPY . .

# Build the application (requires dev dependencies)
RUN npm run build

# Remove dev dependencies after build to reduce image size and security surface
RUN npm prune --production

CMD ["npm", "run", "docker-start"]
