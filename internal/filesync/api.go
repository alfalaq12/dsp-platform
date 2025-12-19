package filesync

import (
	"bytes"
	"encoding/base64"
	"fmt"
	"io"
	"math"
	"net/http"
	"strings"
	"time"
)

// RetryConfig holds retry configuration for API calls
type RetryConfig struct {
	MaxRetries int           // Maximum number of retry attempts
	BaseDelay  time.Duration // Initial delay between retries
	MaxDelay   time.Duration // Maximum delay between retries
	Multiplier float64       // Exponential backoff multiplier
}

// DefaultRetryConfig returns sensible defaults for retry configuration
func DefaultRetryConfig() RetryConfig {
	return RetryConfig{
		MaxRetries: 3,
		BaseDelay:  1 * time.Second,
		MaxDelay:   30 * time.Second,
		Multiplier: 2.0,
	}
}

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
	client      *http.Client
	retryConfig RetryConfig
}

// NewAPIClient creates a new API client with timeout and retry config
func NewAPIClient() *APIClient {
	return &APIClient{
		client: &http.Client{
			Timeout: 60 * time.Second,
		},
		retryConfig: DefaultRetryConfig(),
	}
}

// NewAPIClientWithRetry creates API client with custom retry configuration
func NewAPIClientWithRetry(config RetryConfig) *APIClient {
	return &APIClient{
		client: &http.Client{
			Timeout: 60 * time.Second,
		},
		retryConfig: config,
	}
}

// calculateBackoff calculates delay with exponential backoff
func (c *APIClient) calculateBackoff(attempt int) time.Duration {
	delay := float64(c.retryConfig.BaseDelay) * math.Pow(c.retryConfig.Multiplier, float64(attempt))
	if delay > float64(c.retryConfig.MaxDelay) {
		delay = float64(c.retryConfig.MaxDelay)
	}
	return time.Duration(delay)
}

// isRetryable checks if HTTP status code is retryable
func isRetryable(statusCode int) bool {
	// Retry on server errors (5xx) and rate limiting (429)
	return statusCode >= 500 || statusCode == 429
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

	var lastErr error
	var respBody []byte

	// Retry loop with exponential backoff
	for attempt := 0; attempt <= c.retryConfig.MaxRetries; attempt++ {
		// Wait before retry (skip on first attempt)
		if attempt > 0 {
			delay := c.calculateBackoff(attempt - 1)
			fmt.Printf("⏳ API request failed, retrying in %v (attempt %d/%d)...\n", delay, attempt, c.retryConfig.MaxRetries)
			time.Sleep(delay)

			// Recreate body reader for retry (since it was consumed)
			if config.Body != "" && (config.Method == "POST" || config.Method == "PUT" || config.Method == "PATCH") {
				bodyReader = bytes.NewBufferString(config.Body)
				req, err = http.NewRequest(config.Method, config.URL, bodyReader)
				if err != nil {
					return nil, fmt.Errorf("failed to create request: %w", err)
				}
				// Re-set headers
				req.Header.Set("Accept", "application/json")
				req.Header.Set("Content-Type", "application/json")
				for key, value := range config.Headers {
					req.Header.Set(key, value)
				}
				// Re-apply authentication
				switch strings.ToLower(config.AuthType) {
				case "bearer":
					req.Header.Set("Authorization", "Bearer "+config.AuthValue)
				case "basic":
					auth := config.AuthValue
					if config.Username != "" {
						auth = config.Username + ":" + config.AuthValue
					}
					encoded := base64.StdEncoding.EncodeToString([]byte(auth))
					req.Header.Set("Authorization", "Basic "+encoded)
				case "api_key":
					headerName := config.AuthKey
					if headerName == "" {
						headerName = "X-API-Key"
					}
					req.Header.Set(headerName, config.AuthValue)
				}
			}
		}

		// Execute request
		resp, err := c.client.Do(req)
		if err != nil {
			lastErr = fmt.Errorf("request failed: %w", err)
			continue // retry on connection errors
		}

		// Read response body
		respBody, err = io.ReadAll(resp.Body)
		resp.Body.Close()
		if err != nil {
			lastErr = fmt.Errorf("failed to read response: %w", err)
			continue
		}

		// Check status code
		if resp.StatusCode >= 200 && resp.StatusCode < 300 {
			// Success!
			return respBody, nil
		}

		// Check if error is retryable
		if isRetryable(resp.StatusCode) {
			lastErr = fmt.Errorf("API returned status %d: %s", resp.StatusCode, string(respBody))
			continue
		}

		// Non-retryable error (4xx except 429)
		return nil, fmt.Errorf("API returned status %d: %s", resp.StatusCode, string(respBody))
	}

	// All retries exhausted
	return nil, fmt.Errorf("all %d retries failed, last error: %w", c.retryConfig.MaxRetries, lastErr)
}

// ParseAPIResponse parses JSON API response into records
// Supports: array of objects, single object, or { "data": [...] } wrapper
func ParseAPIResponse(data []byte) ([]map[string]interface{}, error) {
	// Reuse existing JSON parser
	return ParseJSON(data)
}
