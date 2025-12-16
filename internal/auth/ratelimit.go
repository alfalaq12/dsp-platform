package auth

import (
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

// RateLimiter implements a simple in-memory rate limiter
type RateLimiter struct {
	mu       sync.RWMutex
	attempts map[string]*attemptInfo
	maxRate  int           // max attempts
	window   time.Duration // time window
}

type attemptInfo struct {
	count     int
	firstSeen time.Time
}

// NewRateLimiter creates a new rate limiter
func NewRateLimiter(maxAttempts int, window time.Duration) *RateLimiter {
	rl := &RateLimiter{
		attempts: make(map[string]*attemptInfo),
		maxRate:  maxAttempts,
		window:   window,
	}
	// Cleanup goroutine
	go rl.cleanup()
	return rl
}

// Allow checks if the request is allowed based on the IP
func (rl *RateLimiter) Allow(key string) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	now := time.Now()
	info, exists := rl.attempts[key]

	if !exists {
		rl.attempts[key] = &attemptInfo{count: 1, firstSeen: now}
		return true
	}

	// Reset if window has passed
	if now.Sub(info.firstSeen) > rl.window {
		info.count = 1
		info.firstSeen = now
		return true
	}

	// Check if rate exceeded
	if info.count >= rl.maxRate {
		return false
	}

	info.count++
	return true
}

// cleanup removes old entries periodically
func (rl *RateLimiter) cleanup() {
	ticker := time.NewTicker(time.Minute)
	for range ticker.C {
		rl.mu.Lock()
		now := time.Now()
		for key, info := range rl.attempts {
			if now.Sub(info.firstSeen) > rl.window*2 {
				delete(rl.attempts, key)
			}
		}
		rl.mu.Unlock()
	}
}

// Global rate limiter for login: 5 attempts per minute per IP
var loginLimiter = NewRateLimiter(5, time.Minute)

// RateLimitMiddleware creates a rate limiting middleware for login endpoint
func RateLimitMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		ip := c.ClientIP()

		if !loginLimiter.Allow(ip) {
			c.JSON(http.StatusTooManyRequests, gin.H{
				"error":       "Too many login attempts. Please try again later.",
				"retry_after": "60 seconds",
			})
			c.Abort()
			return
		}

		c.Next()
	}
}
