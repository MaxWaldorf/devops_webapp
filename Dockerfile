# Stage 1: build both deliverables from src/ and fail the image build if they drift.
FROM python:3.13-alpine AS build
WORKDIR /app
COPY src ./src
COPY tools ./tools
RUN python3 tools/build.py && python3 tools/build.py --check

# Stage 2: serve only the static site from nginx's default location.
# The standalone file is built in stage 1 for the sync check but never copied here.
FROM nginx:stable-alpine
COPY --from=build /app/dist/web /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK CMD wget -qO /dev/null http://127.0.0.1/ || exit 1
