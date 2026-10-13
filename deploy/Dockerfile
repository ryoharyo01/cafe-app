# Production image. Build context is the repo root (see deploy/compose.yaml).
FROM node:22-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --include=dev
COPY . .
# NEXT_PUBLIC_* values are inlined into the browser bundle, so they must be
# present at build time (from deploy/build.env)
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_BASE_URL
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY \
    NEXT_PUBLIC_BASE_URL=$NEXT_PUBLIC_BASE_URL \
    NEXT_TELEMETRY_DISABLED=1
RUN npm run build
ENV NODE_ENV=production PORT=3000
EXPOSE 3000
CMD ["npx", "next", "start", "-p", "3000"]
