# syntax=docker/dockerfile:1

# =============================================================================
# Stage 1 — Composer dependencies (PHP vendor/)
# =============================================================================
FROM composer:2 AS vendor

WORKDIR /app

# Install deps first using only the manifest so this layer caches well.
# --no-scripts: package discovery needs the app code, which we copy next.
COPY composer.json composer.lock ./
RUN composer install \
    --no-dev \
    --no-scripts \
    --no-autoloader \
    --prefer-dist \
    --no-interaction \
    --no-progress

# Now bring in the full source and finish the autoloader + package discovery.
COPY . .
RUN composer install \
    --no-dev \
    --optimize-autoloader \
    --no-interaction \
    --no-progress \
    && composer clear-cache

# =============================================================================
# Stage 2 — Frontend build (Vite assets -> public/build)
# =============================================================================
FROM node:20-bookworm-slim AS assets

WORKDIR /app

# We use the system Chromium at runtime, so skip puppeteer's browser download.
ENV PUPPETEER_SKIP_DOWNLOAD=true

COPY package.json package-lock.json ./
RUN npm ci

# Source needed to build assets (Ziggy routes are read from vendor/composer).
COPY --from=vendor /app/vendor ./vendor
COPY . .
RUN npm run build \
    # Strip dev dependencies so only runtime node deps (puppeteer) remain.
    && npm prune --omit=dev

# =============================================================================
# Stage 3 — Runtime (php-fpm + nginx + supervisor + chromium)
# =============================================================================
FROM php:8.3-fpm-bookworm AS runtime

# Tell Browsershot where Node, npm and Chrome live (read by BrowsershotPdfRenderer).
ENV BROWSERSHOT_NODE_BINARY=/usr/bin/node \
    BROWSERSHOT_NPM_BINARY=/usr/bin/npm \
    BROWSERSHOT_CHROME_PATH=/usr/bin/chromium \
    PUPPETEER_SKIP_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    NODE_PATH=/var/www/html/node_modules

# --- System packages -------------------------------------------------------
# Build deps for PHP extensions + runtime deps for nginx/supervisor/chromium.
RUN apt-get update && apt-get install -y --no-install-recommends \
        git \
        curl \
        ca-certificates \
        gnupg \
        zip \
        unzip \
        supervisor \
        nginx \
        # PHP extension build dependencies
        libpng-dev \
        libjpeg-dev \
        libfreetype6-dev \
        libonig-dev \
        libxml2-dev \
        libzip-dev \
        libicu-dev \
        zlib1g-dev \
        # Headless Chromium for Browsershot PDF rendering
        chromium \
        fonts-liberation \
        fonts-noto-color-emoji \
        fonts-noto-cjk \
    && rm -rf /var/lib/apt/lists/*

# --- PHP extensions --------------------------------------------------------
RUN docker-php-ext-configure gd --with-freetype --with-jpeg \
    && docker-php-ext-install -j"$(nproc)" \
        pdo_mysql \
        mbstring \
        exif \
        pcntl \
        bcmath \
        gd \
        zip \
        sockets \
        intl \
        opcache \
    && pecl install redis \
    && docker-php-ext-enable redis

# --- Node.js 20 (runtime for Browsershot/puppeteer) ------------------------
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

# --- Composer (handy for artisan/maintenance inside the container) ---------
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

# --- Production PHP / opcache config ---------------------------------------
RUN { \
        echo 'opcache.enable=1'; \
        echo 'opcache.enable_cli=0'; \
        echo 'opcache.memory_consumption=192'; \
        echo 'opcache.interned_strings_buffer=16'; \
        echo 'opcache.max_accelerated_files=20000'; \
        echo 'opcache.validate_timestamps=0'; \
    } > /usr/local/etc/php/conf.d/opcache.ini \
    && { \
        echo 'memory_limit=512M'; \
        echo 'upload_max_filesize=50M'; \
        echo 'post_max_size=50M'; \
        echo 'max_execution_time=120'; \
    } > /usr/local/etc/php/conf.d/app.ini

WORKDIR /var/www/html

# --- Application code + built artifacts -------------------------------------
# Source first, then overlay the dependency outputs from the build stages.
COPY . .
COPY --from=vendor /app/vendor ./vendor
COPY --from=assets /app/public/build ./public/build
COPY --from=assets /app/node_modules ./node_modules

# --- nginx + supervisor configs --------------------------------------------
COPY docker/nginx.conf /etc/nginx/sites-available/default
COPY docker/supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# --- Permissions ------------------------------------------------------------
RUN chown -R www-data:www-data storage bootstrap/cache \
    && chmod -R 775 storage bootstrap/cache

# --- Entrypoint: warm caches + link storage, then hand off to supervisor ----
RUN printf '%s\n' \
        '#!/bin/sh' \
        'set -e' \
        'php artisan storage:link --force 2>/dev/null || true' \
        'php artisan config:cache' \
        'php artisan route:cache' \
        'php artisan view:cache' \
        'exec "$@"' \
        > /usr/local/bin/entrypoint.sh \
    && chmod +x /usr/local/bin/entrypoint.sh

# 80 = nginx/web, 8080 = Reverb websocket
EXPOSE 80 8080

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
