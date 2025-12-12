.PHONY: help build build-linux build-windows test clean install-linux run-master run-agent docker-build docker-up docker-down

help: ## Show this help message
	@echo "DSP Platform - Build and Deployment Commands"
	@echo ""
	@awk 'BEGIN {FS = ":.*##"; printf "\nUsage:\n  make \033[36m<target>\033[0m\n"} /^[a-zA-Z_-]+:.*?##/ { printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2 } /^##@/ { printf "\n\033[1m%s\033[0m\n", substr($$0, 5) } ' $(MAKEFILE_LIST)

##@ Build Commands

build: build-frontend ## Build for all platforms (Linux + Windows)
	@echo "🔨 Building for all platforms..."
	@chmod +x build.sh
	@./build.sh

build-frontend: ## Build Frontend (React)
	@echo "🎨 Building Frontend..."
	@cd frontend && npm install && npm run build
	@echo "✅ Frontend built"

build-linux: build-frontend ## Build only Linux binaries
	@echo "📦 Building for Linux..."
	@mkdir -p bin/linux/frontend
	@cp -r frontend/dist bin/linux/frontend/
	GOOS=linux GOARCH=amd64 go build -o bin/linux/dsp-master ./cmd/master
	GOOS=linux GOARCH=amd64 go build -o bin/linux/dsp-agent ./cmd/agent
	@chmod +x bin/linux/dsp-master bin/linux/dsp-agent
	@echo "✅ Linux binaries built"

build-windows: build-frontend ## Build only Windows binaries
	@echo "📦 Building for Windows..."
	@mkdir -p bin/windows/frontend
	@cp -r frontend/dist bin/windows/frontend/
	GOOS=windows GOARCH=amd64 go build -o bin/windows/dsp-master.exe ./cmd/master
	GOOS=windows GOARCH=amd64 go build -o bin/windows/dsp-agent.exe ./cmd/agent
	@echo "✅ Windows binaries built"

##@ Development

run-master: ## Run master server (development mode)
	@echo "🚀 Starting Master Server..."
	go run ./cmd/master

run-agent: ## Run agent (development mode)
	@echo "🚀 Starting Agent..."
	go run ./cmd/agent

test: ## Run tests
	@echo "🧪 Running tests..."
	go test ./...

clean: ## Clean build artifacts
	@echo "🗑️ Cleaning build artifacts..."
	rm -rf bin/
	@echo "✅ Clean complete"

##@ Deployment

install-master-linux: build-linux ## Install Master Server on Linux (requires sudo)
	@echo "📦 Installing Master Server to Linux..."
	@chmod +x deployment/linux/install-master.sh
	cd deployment/linux && sudo ./install-master.sh

install-agent-linux: ## Install Agent on Linux (requires sudo) - run from agent machine
	@echo "📦 Installing Agent to Linux..."
	@chmod +x deployment/linux/install-agent.sh
	cd deployment/linux && sudo ./install-agent.sh

update-master-linux: build-linux ## Quick update Master: build + copy + restart service
	@echo "🔄 Updating Master Server..."
	sudo cp bin/linux/dsp-master /opt/dsp-platform/
	sudo cp -r bin/linux/frontend/dist /opt/dsp-platform/frontend/
	sudo systemctl restart dsp-master
	@echo "✅ Master updated and restarted"

update-agent-linux: ## Quick update Agent: build + copy + restart service
	@echo "🔄 Updating Agent..."
	@echo "📦 Building Agent binary..."
	GOOS=linux GOARCH=amd64 go build -o bin/linux/dsp-agent ./cmd/agent
	sudo cp bin/linux/dsp-agent /opt/dsp-agent/
	sudo systemctl restart dsp-agent
	@echo "✅ Agent updated and restarted"

# Legacy alias for backwards compatibility
install-linux: install-master-linux ## Alias for install-master-linux

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
