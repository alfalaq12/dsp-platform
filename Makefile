.PHONY: help build build-linux build-windows test clean install-linux run-master run-agent docker-build docker-up docker-down

help: ## Show this help message
	@echo "DSP Platform - Build and Deployment Commands"
	@echo ""
	@awk 'BEGIN {FS = ":.*##"; printf "\nUsage:\n  make \033[36m<target>\033[0m\n"} /^[a-zA-Z_-]+:.*?##/ { printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2 } /^##@/ { printf "\n\033[1m%s\033[0m\n", substr($$0, 5) } ' $(MAKEFILE_LIST)

##@ Build Commands

build: ## Build for all platforms (Linux + Windows)
	@echo "🔨 Building for all platforms..."
	@chmod +x build.sh
	@./build.sh

build-linux: ## Build only Linux binaries
	@echo "📦 Building for Linux..."
	@mkdir -p bin/linux
	GOOS=linux GOARCH=amd64 go build -o bin/linux/dsp-master cmd/master/main.go
	GOOS=linux GOARCH=amd64 go build -o bin/linux/dsp-agent cmd/agent/main.go
	@chmod +x bin/linux/dsp-master bin/linux/dsp-agent
	@echo "✅ Linux binaries built"

build-windows: ## Build only Windows binaries
	@echo "📦 Building for Windows..."
	@mkdir -p bin/windows
	GOOS=windows GOARCH=amd64 go build -o bin/windows/dsp-master.exe cmd/master/main.go
	GOOS=windows GOARCH=amd64 go build -o bin/windows/dsp-agent.exe cmd/agent/main.go
	@echo "✅ Windows binaries built"

##@ Development

run-master: ## Run master server (development mode)
	@echo "🚀 Starting Master Server..."
	go run cmd/master/main.go

run-agent: ## Run agent (development mode)
	@echo "🚀 Starting Agent..."
	go run cmd/agent/main.go

test: ## Run tests
	@echo "🧪 Running tests..."
	go test ./...

clean: ## Clean build artifacts
	@echo "🗑️ Cleaning build artifacts..."
	rm -rf bin/
	@echo "✅ Clean complete"

##@ Deployment

install-linux: build-linux ## Install as Linux systemd service (requires sudo)
	@echo "📦 Installing to Linux..."
	cd deployment/linux && sudo ./install.sh

##@ Docker

docker-build: ## Build Docker image
	@echo "🐳 Building Docker image..."
	docker-compose build

docker-up: ## Start services with Docker Compose
	@echo "🚀 Starting Docker services..."
	docker-compose up -d

docker-down: ## Stop Docker services
	@echo "🛑 Stopping Docker services..."
	docker-compose down

docker-logs: ## View Docker logs
	docker-compose logs -f

##@ Utilities

deps: ## Download Go dependencies
	@echo "📥 Downloading dependencies..."
	go mod download
	go mod tidy

fmt: ## Format Go code
	@echo "🎨 Formatting code..."
	go fmt ./...

lint: ## Run linter
	@echo "🔍 Running linter..."
	golangci-lint run

size: ## Show binary sizes
	@echo "📊 Binary sizes:"
	@ls -lh bin/linux/ bin/windows/ 2>/dev/null || echo "No binaries found. Run 'make build' first."
