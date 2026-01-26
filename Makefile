.PHONY: help build build-linux build-windows test clean install-linux run-master run-agent docker-build docker-up docker-down gen-certs

help: ## Show this help message
	@echo "DSP Platform - Build and Deployment Commands"
	@echo ""
	@awk 'BEGIN {FS = ":.*##"; printf "\nUsage:\n  make \033[36m<target>\033[0m\n"} /^[a-zA-Z_-]+:.*?##/ { printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2 } /^##@/ { printf "\n\033[1m%s\033[0m\n", substr($$0, 5) } ' $(MAKEFILE_LIST)

##@ Build Commands

build: gen-certs build-frontend build-all-binaries package-all ## 🚀 Build EVERYTHING: certs + frontend + all binaries + package
	@echo ""
	@echo "✅ ========================================"
	@echo "✅  BUILD COMPLETE!"
	@echo "✅ ========================================"
	@echo ""
	@echo "📦 Output directories:"
	@echo "   - bin/linux/   (Master + Agent for Linux)"
	@echo "   - bin/windows/ (Master + Agent for Windows)"
	@echo ""
	@echo "🔒 TLS certificates included in each package"
	@echo ""

gen-certs: ## 🔐 Generate TLS certificates (if not exist)
	@if [ ! -f certs/server.crt ]; then \
		echo "🔐 Generating TLS certificates..."; \
		mkdir -p certs; \
		go run -ldflags="-s -w" scripts/gen-cert.go; \
		echo "✅ Certificates generated in ./certs/"; \
	else \
		echo "ℹ️  Certificates already exist in ./certs/"; \
	fi

build-frontend: ## Build Frontend (React)
	@echo "🎨 Building Frontend..."
	@cd frontend && npm install && npm run build
	@echo "✅ Frontend built"

build-all-binaries: ## Build all binaries (Linux + Windows)
	@echo "📦 Building all binaries..."
	@mkdir -p bin/linux bin/windows
	@echo "  → Building Linux Master..."
	@GOOS=linux GOARCH=amd64 go build -ldflags="-s -w" -o bin/linux/dsp-master ./cmd/master
	@echo "  → Building Linux Agent..."
	@GOOS=linux GOARCH=amd64 go build -ldflags="-s -w" -o bin/linux/dsp-agent ./cmd/agent
	@echo "  → Building Windows Master..."
	@GOOS=windows GOARCH=amd64 go build -ldflags="-s -w" -o bin/windows/dsp-master.exe ./cmd/master
	@echo "  → Building Windows Agent..."
	@GOOS=windows GOARCH=amd64 go build -ldflags="-s -w" -o bin/windows/dsp-agent.exe ./cmd/agent
	@chmod +x bin/linux/dsp-master bin/linux/dsp-agent 2>/dev/null || true
	@echo "✅ All binaries built"

package-all: ## Package binaries with frontend, certs, and config
	@echo "📦 Packaging deployments..."
	@# Linux Master
	@mkdir -p bin/linux/master/frontend bin/linux/master/certs bin/linux/master/deployment/linux
	@cp bin/linux/dsp-master bin/linux/master/
	@cp -r frontend/dist bin/linux/master/frontend/
	@cp -r certs/* bin/linux/master/certs/ 2>/dev/null || true
	@cp .env.example bin/linux/master/.env.example
	@cp deployment/linux/dsp-master.service bin/linux/master/deployment/linux/
	@cp deployment/linux/install-master.sh bin/linux/master/deployment/linux/
	@cp deployment/certs/generate-certs.sh bin/linux/master/
	@# Linux Agent
	@mkdir -p bin/linux/agent/certs bin/linux/agent/deployment/linux
	@cp bin/linux/dsp-agent bin/linux/agent/
	@cp certs/ca.crt bin/linux/agent/certs/ 2>/dev/null || true
	@cp .env.example bin/linux/agent/.env.example
	@cp deployment/linux/dsp-agent.service bin/linux/agent/deployment/linux/
	@cp deployment/linux/install-agent.sh bin/linux/agent/deployment/linux/
	@# Windows Master
	@mkdir -p bin/windows/master/frontend bin/windows/master/certs bin/windows/master/deployment/windows
	@cp bin/windows/dsp-master.exe bin/windows/master/
	@cp -r frontend/dist bin/windows/master/frontend/
	@cp -r certs/* bin/windows/master/certs/ 2>/dev/null || true
	@cp .env.example bin/windows/master/.env.example
	@cp deployment/windows/install-service.ps1 bin/windows/master/deployment/windows/ 2>/dev/null || true
	@cp deployment/certs/generate-certs.ps1 bin/windows/master/
	@# Windows Agent
	@mkdir -p bin/windows/agent/certs bin/windows/agent/deployment/windows
	@cp bin/windows/dsp-agent.exe bin/windows/agent/
	@cp certs/ca.crt bin/windows/agent/certs/ 2>/dev/null || true
	@cp .env.example bin/windows/agent/.env.example
	@echo "✅ All packages ready"

zip-all: package-all ## 📦 Create ZIP files for portable deployment (flashdisk)
	@echo "📦 Creating deployment ZIP files..."
	@mkdir -p dist
	@# Linux Master ZIP
	@cd bin/linux && zip -r ../../dist/dsp-master-linux-amd64.zip master/
	@echo "  ✅ dist/dsp-master-linux-amd64.zip"
	@# Linux Agent ZIP
	@cd bin/linux && zip -r ../../dist/dsp-agent-linux-amd64.zip agent/
	@echo "  ✅ dist/dsp-agent-linux-amd64.zip"
	@# Windows Master ZIP
	@cd bin/windows && zip -r ../../dist/dsp-master-windows-amd64.zip master/
	@echo "  ✅ dist/dsp-master-windows-amd64.zip"
	@# Windows Agent ZIP
	@cd bin/windows && zip -r ../../dist/dsp-agent-windows-amd64.zip agent/
	@echo "  ✅ dist/dsp-agent-windows-amd64.zip"
	@echo ""
	@echo "✅ ========================================"
	@echo "✅  ZIP PACKAGES READY FOR DEPLOYMENT!"
	@echo "✅ ========================================"
	@echo ""
	@echo "📦 Files in dist/:"
	@ls -lh dist/*.zip
	@echo ""
	@echo "💾 Copy these to flashdisk for tenant deployment"

build-linux: gen-certs build-frontend ## Build only Linux binaries (Master + Agent)
	@echo "📦 Building for Linux..."
	@mkdir -p bin/linux/frontend
	@cp -r frontend/dist bin/linux/frontend/
	GOOS=linux GOARCH=amd64 go build -ldflags="-s -w" -o bin/linux/dsp-master ./cmd/master
	GOOS=linux GOARCH=amd64 go build -ldflags="-s -w" -o bin/linux/dsp-agent ./cmd/agent
	@chmod +x bin/linux/dsp-master bin/linux/dsp-agent
	@mkdir -p bin/linux/certs && cp -r certs/* bin/linux/certs/ 2>/dev/null || true
	@echo "✅ Linux binaries built (with TLS certs)"

build-windows: gen-certs build-frontend ## Build only Windows binaries (Master + Agent)
	@echo "📦 Building for Windows..."
	@mkdir -p bin/windows/frontend
	@cp -r frontend/dist bin/windows/frontend/
	GOOS=windows GOARCH=amd64 go build -ldflags="-s -w" -o bin/windows/dsp-master.exe ./cmd/master
	GOOS=windows GOARCH=amd64 go build -ldflags="-s -w" -o bin/windows/dsp-agent.exe ./cmd/agent
	@mkdir -p bin/windows/certs && cp -r certs/* bin/windows/certs/ 2>/dev/null || true
	@echo "✅ Windows binaries built (with TLS certs)"

##@ Development

run-master: ## Run master server (development mode)
	@echo "🚀 Starting Master Server..."
	go run ./cmd/master

run-agent: ## Run agent (development mode)
	@echo "🚀 Starting Agent..."
	go run ./cmd/agent

run-master-tls: gen-certs ## Run master server with TLS enabled
	@echo "🔒 Starting Master Server with TLS..."
	TLS_ENABLED=true go run ./cmd/master

run-agent-tls: ## Run agent with TLS enabled
	@echo "🔒 Starting Agent with TLS..."
	TLS_ENABLED=true TLS_SKIP_VERIFY=true go run ./cmd/agent

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
	sudo cp -r bin/linux/certs/* /opt/dsp-platform/certs/ 2>/dev/null || true
	sudo systemctl restart dsp-master
	@echo "✅ Master updated and restarted"

update-agent-linux: ## Quick update Agent: build + copy + restart service
	@echo "🔄 Updating Agent..."
	@echo "📦 Building Agent binary..."
	GOOS=linux GOARCH=amd64 go build -ldflags="-s -w" -o bin/linux/dsp-agent ./cmd/agent
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
	@ls -lh bin/linux/*.go bin/windows/*.exe 2>/dev/null || ls -lh bin/linux/ bin/windows/ 2>/dev/null || echo "No binaries found. Run 'make build' first."

