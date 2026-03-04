# ===========================================
# DSP Platform Master Server - Dockerfile
# ===========================================
# Multi-stage build for minimal image size

# Stage 1: Build Frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci --silent
COPY frontend/ ./
RUN npm run build

# Stage 2: Build Go binaries
FROM golang:1.24-alpine AS go-builder
WORKDIR /app

# Install build dependencies
RUN apk add --no-cache git ca-certificates tzdata

# Copy go mod files first for caching
COPY go.mod go.sum ./
RUN go mod download

# Copy source code
COPY cmd/ ./cmd/
COPY internal/ ./internal/

# Build Master binary
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build \
    -ldflags="-s -w" \
    -o dsp-master \
    ./cmd/master

# Build Agent binary
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build \
    -ldflags="-s -w" \
    -o dsp-agent \
    ./cmd/agent

# Stage 3: Final minimal image for Master
FROM alpine:3.19 AS master
WORKDIR /app

# Install runtime dependencies
RUN apk add --no-cache ca-certificates tzdata

# Create non-root user
RUN addgroup -g 1000 dsp && \
    adduser -u 1000 -G dsp -s /bin/sh -D dsp

# Copy binaries
COPY --from=go-builder /app/dsp-master /app/

# Copy frontend build
COPY --from=frontend-builder /app/frontend/dist /app/frontend/dist

# Create directories
RUN mkdir -p /app/data /app/logs /app/certs && \
    chown -R dsp:dsp /app

# Switch to non-root user
USER dsp

# Expose ports
EXPOSE 4410 4470

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider --no-check-certificate https://localhost:4410/health || exit 1

# Default environment
ENV HTTP_PORT=4410 \
    TCP_PORT=4470 \
    TLS_ENABLED=false

# Run
CMD ["/app/dsp-master"]

# ===========================================
# Agent image (separate target)
# ===========================================
FROM alpine:3.19 AS agent
WORKDIR /app

RUN apk add --no-cache ca-certificates tzdata

RUN addgroup -g 1000 dsp && \
    adduser -u 1000 -G dsp -s /bin/sh -D dsp

COPY --from=go-builder /app/dsp-agent /app/

RUN mkdir -p /app/data /app/logs /app/certs && \
    chown -R dsp:dsp /app

USER dsp

ENV MASTER_HOST=localhost \
    MASTER_PORT=4470 \
    AGENT_NAME=docker-agent \
    TLS_ENABLED=false

CMD ["/app/dsp-agent"]
