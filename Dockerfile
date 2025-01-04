# Build stage
FROM node:16-alpine AS builder

WORKDIR /app

# Copia apenas os arquivos necessários para instalar dependências
COPY package*.json ./

# Instala apenas as dependências de produção
RUN npm ci --only=production && \
  npm cache clean --force

# Final stage
FROM alpine:3.18

# Instala Node.js e apenas as dependências mínimas necessárias para o Chromium
RUN apk add --no-cache \
  nodejs \
  chromium \
  nss \
  freetype \
  ttf-freefont \
  font-noto-emoji \
  ca-certificates \
  && rm -rf /var/cache/apk/*

# Cria usuário não-root
RUN addgroup -S stacksync && \
  adduser -S -G stacksync stacksync && \
  mkdir -p /home/stacksync/Downloads && \
  chown -R stacksync:stacksync /home/stacksync

WORKDIR /app

# Copia apenas os node_modules necessários do estágio de build
COPY --from=builder /app/node_modules ./node_modules

# Copia o código da aplicação
COPY --chown=stacksync:stacksync . .

# Configura permissões
RUN chown -R stacksync:stacksync /app

# Configura variáveis de ambiente para o Puppeteer
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
  PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Muda para usuário não-root
USER stacksync

# Comando de execução
CMD ["node", "index.js"]