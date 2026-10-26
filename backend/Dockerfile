FROM php:8.3-cli
RUN --mount=type=secret,id=proxy_ca,target=/run/proxy-ca.pem apt-get -o Acquire::https::CaInfo=/run/proxy-ca.pem update && apt-get -o Acquire::https::CaInfo=/run/proxy-ca.pem install -y libpq-dev libonig-dev libxml2-dev unzip git libzip-dev && docker-php-ext-install pdo_pgsql mbstring bcmath pcntl dom xml xmlwriter zip && rm -rf /var/lib/apt/lists/*
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer
WORKDIR /app
COPY docker/php.ini /usr/local/etc/php/conf.d/chair.ini
CMD ["php","artisan","serve","--host=0.0.0.0","--port=8000"]
