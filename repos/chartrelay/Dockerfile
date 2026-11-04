FROM node:22-alpine AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat python3 make g++
COPY package*.json ./
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
# node:22-alpine ships no fonts at all. Without these, librsvg resolves every family in a chart's font
# stack to nothing and rasterises each glyph as .notdef — the PNG comes back the right size, the right
# byte count and completely unreadable, which is exactly how this shipped unnoticed. Liberation Sans is
# metric-compatible with Arial, so it stands in for the Helvetica the charts were drawn against without
# moving any hand-computed label. src/lib/charts/fonts.ts names these families explicitly and a test
# holds the two files to each other.
# Liberation and DejaVu cover Latin, Cyrillic and Greek. The Noto packages cover what is left — CJK,
# Korean, Arabic and emoji — which until now rasterised as tofu boxes in a chart that still returned
# 200. font-noto-cjk is the large one; it is the price of serving a non-English customer a readable
# chart. src/lib/charts/fonts.ts maps every promised family to the package below and a test holds the
# two files to each other.
RUN apk add --no-cache font-liberation font-dejavu font-noto-cjk font-noto-arabic \
      font-noto-devanagari font-noto-bengali font-noto-tamil font-noto-thai font-noto-ethiopic \
      font-noto-emoji fontconfig && fc-cache -f
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
RUN mkdir -p .data && chown nextjs:nodejs .data
USER nextjs
EXPOSE 3000
ENV PORT=3000 HOSTNAME=0.0.0.0 DATABASE_PATH=./.data/chartrelay.db
CMD ["node", "server.js"]
