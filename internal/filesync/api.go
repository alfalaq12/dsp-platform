package filesync

import (
	"bytes"
	"encoding/base64"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// APIConfig holds REST API connection configuration
type APIConfig struct {
	URL       string            // API endpoint URL
	Method    string            // GET, POST
	Headers   map[string]string // Custom headers
	AuthType  string            // none, bearer, basic, api_key
	AuthKey   string            // Header name for API key (e.g., X-API-Key)
	AuthValue string            // Token/key/password value
	Body      string            // Request body for POST
	Username  string            // Username for basic auth (optional)
}

// APIClient wraps HTTP client functionality for API calls
type APIClient struct {
	client *http.Client
}

// NewAPIClient creates a new API client with timeout
func NewAPIClient() *APIClient {
	return &APIClient{
		client: &http.Client{
			Timeout: 60 * time.Second,
		},
	}
}

// FetchAPI makes an HTTP request and returns the response body
func (c *APIClient) FetchAPI(config APIConfig) ([]byte, error) {
	// Default method
	if config.Method == "" {
		config.Method = "GET"
	}
	config.Method = strings.ToUpper(config.Method)

	// Create request body if provided
	var bodyReader io.Reader
	if config.Body != "" && (config.Method == "POST" || config.Method == "PUT" || config.Method == "PATCH") {
		bodyReader = bytes.NewBufferString(config.Body)
	}

	// Create request
	req, err := http.NewRequest(config.Method, config.URL, bodyReader)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	// Set default headers
	req.Header.Set("Accept", "application/json")
	if config.Body != "" {
		req.Header.Set("Content-Type", "application/json")
	}

	// Add custom headers
	for key, value := range config.Headers {
		req.Header.Set(key, value)
	}

	// Add authentication
	switch strings.ToLower(config.AuthType) {
	case "bearer":
		req.Header.Set("Authorization", "Bearer "+config.AuthValue)
	case "basic":
		// Auth value should be "username:password" or just use AuthValue as token
		auth := config.AuthValue
		if config.Username != "" {
			auth = config.Username + ":" + config.AuthValue
		}
		encoded := base64.StdEncoding.EncodeToString([]byte(auth))
		req.Header.Set("Authorization", "Basic "+encoded)
	case "api_key":
		// Use custom header name for API key
		headerName := config.AuthKey
		if headerName == "" {
			headerName = "X-API-Key"
		}
		req.Header.Set(headerName, config.AuthValue)
	}

	// Execute request
	resp, err := c.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	// Read response body
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	// Check status code
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("API returned status %d: %s", resp.StatusCode, string(body))
	}

	return body, nil
}

// ParseAPIResponse parses JSON API response into records
// Supports: array of objects, single object, or { "data": [...] } wrapper
func ParseAPIResponse(data []byte) ([]map[string]interface{}, error) {
	// Reuse existing JSON parser
	return ParseJSON(data)
}
