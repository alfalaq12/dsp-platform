package database

import (
	"context"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
)

// RedisConfig holds Redis connection configuration
type RedisConfig struct {
	Host     string
	Port     string
	Password string
	DB       int    // Database number (0-15)
	Pattern  string // Key pattern to scan (e.g., "user:*")
}

// RedisConnection wraps Redis connection
type RedisConnection struct {
	Client *redis.Client
	Config RedisConfig
}

// RedisConnect establishes Redis connection
func RedisConnect(config RedisConfig) (*RedisConnection, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Default port
	if config.Port == "" {
		config.Port = "6379"
	}

	// Create Redis client with connection pooling for better concurrent performance
	client := redis.NewClient(&redis.Options{
		Addr:     fmt.Sprintf("%s:%s", config.Host, config.Port),
		Password: config.Password,
		DB:       config.DB,

		// Connection pooling
		PoolSize:     10, // Maximum connections in pool
		MinIdleConns: 3,  // Keep minimum idle connections ready

		// Timeouts for better reliability
		DialTimeout:  5 * time.Second,
		ReadTimeout:  3 * time.Second,
		WriteTimeout: 3 * time.Second,
	})

	// Ping to verify connection
	if err := client.Ping(ctx).Err(); err != nil {
		return nil, fmt.Errorf("failed to ping Redis: %w", err)
	}

	return &RedisConnection{
		Client: client,
		Config: config,
	}, nil
}

// Close closes Redis connection
func (c *RedisConnection) Close() error {
	if c.Client != nil {
		return c.Client.Close()
	}
	return nil
}

// ScanKeys scans keys matching a pattern and returns their values
func (c *RedisConnection) ScanKeys(pattern string) ([]map[string]interface{}, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	if pattern == "" {
		pattern = "*"
	}

	var results []map[string]interface{}
	var cursor uint64

	for {
		keys, nextCursor, err := c.Client.Scan(ctx, cursor, pattern, 1000).Result()
		if err != nil {
			return nil, fmt.Errorf("Redis scan failed: %w", err)
		}

		// Get values for each key
		for _, key := range keys {
			keyType, err := c.Client.Type(ctx, key).Result()
			if err != nil {
				continue
			}

			row := map[string]interface{}{
				"key":  key,
				"type": keyType,
			}

			// Get value based on type
			switch keyType {
			case "string":
				val, err := c.Client.Get(ctx, key).Result()
				if err == nil {
					row["value"] = val
				}
			case "hash":
				val, err := c.Client.HGetAll(ctx, key).Result()
				if err == nil {
					row["value"] = val
				}
			case "list":
				val, err := c.Client.LRange(ctx, key, 0, -1).Result()
				if err == nil {
					row["value"] = val
				}
			case "set":
				val, err := c.Client.SMembers(ctx, key).Result()
				if err == nil {
					row["value"] = val
				}
			case "zset":
				val, err := c.Client.ZRangeWithScores(ctx, key, 0, -1).Result()
				if err == nil {
					row["value"] = val
				}
			}

			// Get TTL
			ttl, err := c.Client.TTL(ctx, key).Result()
			if err == nil {
				row["ttl"] = ttl.Seconds()
			}

			results = append(results, row)
		}

		cursor = nextCursor
		if cursor == 0 {
			break
		}
	}

	return results, nil
}

// GetAllHashes gets all hash keys matching pattern as structured data
func (c *RedisConnection) GetAllHashes(pattern string) ([]map[string]interface{}, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	if pattern == "" {
		pattern = "*"
	}

	var results []map[string]interface{}
	var cursor uint64

	for {
		keys, nextCursor, err := c.Client.Scan(ctx, cursor, pattern, 1000).Result()
		if err != nil {
			return nil, fmt.Errorf("Redis scan failed: %w", err)
		}

		for _, key := range keys {
			keyType, _ := c.Client.Type(ctx, key).Result()
			if keyType != "hash" {
				continue
			}

			hashData, err := c.Client.HGetAll(ctx, key).Result()
			if err != nil {
				continue
			}

			// Convert hash to map with key included
			row := map[string]interface{}{
				"_key": key,
			}
			for k, v := range hashData {
				row[k] = v
			}
			results = append(results, row)
		}

		cursor = nextCursor
		if cursor == 0 {
			break
		}
	}

	return results, nil
}

// TestRedisConnection tests Redis connectivity
func TestRedisConnection(config RedisConfig) error {
	conn, err := RedisConnect(config)
	if err != nil {
		return err
	}
	defer conn.Close()
	return nil
}
