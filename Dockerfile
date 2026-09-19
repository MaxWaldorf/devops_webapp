# Stage 1: build both deliverables from src/ and fail the image build if they drift.
FROM python:3.13-alpine AS build
WORKDIR /app
COPY src ./src
COPY tools ./tools
RUN python3 tools/build.py && python3 tools/build.py --check

# Stage 2: serve dist/web and the per-browser model API (tools/server.py, stdlib only).
# The standalone file is built in stage 1 for the sync check but never copied here.
FROM python:3.13-alpine
WORKDIR /app
COPY --from=build /app/dist/web ./web
COPY tools/server.py ./server.py
ENV DATA_DIR=/data
RUN adduser -D -u 10001 app && mkdir /data && chown app /data
USER app
VOLUME /data
EXPOSE 80
HEALTHCHECK CMD wget -qO /dev/null http://127.0.0.1/ || exit 1
CMD ["python3", "server.py", "--dir", "web", "--port", "80"]
