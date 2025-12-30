package filesync

import (
	"bytes"
	"context"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"io"
	"path"
	"path/filepath"
	"strings"
	"time"

	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
)

// MinIOConfig holds MinIO/S3 connection configuration
type MinIOConfig struct {
	Endpoint        string // e.g., "minio.example.com:9000" or "s3.amazonaws.com"
	AccessKeyID     string
	SecretAccessKey string
	BucketName      string
	ObjectPath      string // path prefix or specific object key
	UseSSL          bool
	Region          string // optional, default "us-east-1"
}

// MinIOClient wraps MinIO client functionality
type MinIOClient struct {
	client     *minio.Client
	bucketName string
	region     string
}

// ObjectInfo represents metadata about an object in MinIO
type ObjectInfo struct {
	Key          string
	Size         int64
	LastModified time.Time
	ContentType  string
}

// NewMinIOClient creates a new MinIO client and connects to the server
func NewMinIOClient(config MinIOConfig) (*MinIOClient, error) {
	if config.Endpoint == "" {
		return nil, fmt.Errorf("MinIO endpoint is required")
	}
	if config.AccessKeyID == "" || config.SecretAccessKey == "" {
		return nil, fmt.Errorf("MinIO access key and secret key are required")
	}
	if config.BucketName == "" {
		return nil, fmt.Errorf("MinIO bucket name is required")
	}

	region := config.Region
	if region == "" {
		region = "us-east-1"
	}

	// Initialize MinIO client
	client, err := minio.New(config.Endpoint, &minio.Options{
		Creds:  credentials.NewStaticV4(config.AccessKeyID, config.SecretAccessKey, ""),
		Secure: config.UseSSL,
		Region: region,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create MinIO client: %w", err)
	}

	return &MinIOClient{
		client:     client,
		bucketName: config.BucketName,
		region:     region,
	}, nil
}

// TestConnection verifies that we can access the bucket
func (c *MinIOClient) TestConnection() error {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	exists, err := c.client.BucketExists(ctx, c.bucketName)
	if err != nil {
		return fmt.Errorf("failed to check bucket: %w", err)
	}
	if !exists {
		return fmt.Errorf("bucket '%s' does not exist", c.bucketName)
	}

	return nil
}

// ListObjects lists objects in the bucket with optional prefix and pattern matching
func (c *MinIOClient) ListObjects(prefix string, pattern string) ([]ObjectInfo, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	var objects []ObjectInfo

	opts := minio.ListObjectsOptions{
		Prefix:    prefix,
		Recursive: true,
	}

	for object := range c.client.ListObjects(ctx, c.bucketName, opts) {
		if object.Err != nil {
			return nil, fmt.Errorf("error listing objects: %w", object.Err)
		}

		// Skip directories (objects ending with /)
		if strings.HasSuffix(object.Key, "/") {
			continue
		}

		// Apply pattern matching if provided
		if pattern != "" {
			matched, err := filepath.Match(pattern, path.Base(object.Key))
			if err != nil {
				continue
			}
			if !matched {
				continue
			}
		}

		objects = append(objects, ObjectInfo{
			Key:          object.Key,
			Size:         object.Size,
			LastModified: object.LastModified,
			ContentType:  object.ContentType,
		})
	}

	return objects, nil
}

// ReadObject reads an object from MinIO into memory
func (c *MinIOClient) ReadObject(objectKey string) ([]byte, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()

	obj, err := c.client.GetObject(ctx, c.bucketName, objectKey, minio.GetObjectOptions{})
	if err != nil {
		return nil, fmt.Errorf("failed to get object: %w", err)
	}
	defer obj.Close()

	var buf bytes.Buffer
	_, err = io.Copy(&buf, obj)
	if err != nil {
		return nil, fmt.Errorf("failed to read object content: %w", err)
	}

	return buf.Bytes(), nil
}

// FindAndReadObject finds an object matching the pattern and reads it
func (c *MinIOClient) FindAndReadObject(prefix string, pattern string) ([]byte, string, error) {
	// If pattern is a specific filename (no wildcards), try to read it directly
	if !strings.Contains(pattern, "*") && !strings.Contains(pattern, "?") {
		objectKey := path.Join(prefix, pattern)
		// Remove leading slash if present
		objectKey = strings.TrimPrefix(objectKey, "/")

		data, err := c.ReadObject(objectKey)
		if err != nil {
			return nil, "", err
		}
		return data, pattern, nil
	}

	// List objects and find matching ones
	objects, err := c.ListObjects(prefix, pattern)
	if err != nil {
		return nil, "", err
	}

	if len(objects) == 0 {
		return nil, "", fmt.Errorf("no objects matching pattern '%s' found in prefix '%s'", pattern, prefix)
	}

	// Read the first matching object
	data, err := c.ReadObject(objects[0].Key)
	if err != nil {
		return nil, "", err
	}

	return data, path.Base(objects[0].Key), nil
}

// WriteObject writes data to an object in MinIO
func (c *MinIOClient) WriteObject(objectKey string, data []byte, contentType string) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()

	reader := bytes.NewReader(data)

	_, err := c.client.PutObject(ctx, c.bucketName, objectKey, reader, int64(len(data)), minio.PutObjectOptions{
		ContentType: contentType,
	})
	if err != nil {
		return fmt.Errorf("failed to write object: %w", err)
	}

	return nil
}

// WriteRecordsAsCSV converts records to CSV format and writes to MinIO
func (c *MinIOClient) WriteRecordsAsCSV(objectKey string, records []map[string]interface{}) error {
	if len(records) == 0 {
		return fmt.Errorf("no records to write")
	}

	var buf bytes.Buffer
	writer := csv.NewWriter(&buf)

	// Get headers from first record
	var headers []string
	for key := range records[0] {
		headers = append(headers, key)
	}

	// Write header
	if err := writer.Write(headers); err != nil {
		return fmt.Errorf("failed to write CSV header: %w", err)
	}

	// Write records
	for _, record := range records {
		var row []string
		for _, header := range headers {
			val := record[header]
			row = append(row, fmt.Sprintf("%v", val))
		}
		if err := writer.Write(row); err != nil {
			return fmt.Errorf("failed to write CSV row: %w", err)
		}
	}

	writer.Flush()
	if err := writer.Error(); err != nil {
		return fmt.Errorf("CSV writer error: %w", err)
	}

	return c.WriteObject(objectKey, buf.Bytes(), "text/csv")
}

// WriteRecordsAsJSON converts records to JSON format and writes to MinIO
func (c *MinIOClient) WriteRecordsAsJSON(objectKey string, records []map[string]interface{}) error {
	if len(records) == 0 {
		return fmt.Errorf("no records to write")
	}

	data, err := json.MarshalIndent(records, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal JSON: %w", err)
	}

	return c.WriteObject(objectKey, data, "application/json")
}

// WriteRecordsAsParquet converts records to Parquet format and writes to MinIO
// Note: For full Parquet support, consider using github.com/parquet-go/parquet-go
// This is a simplified implementation that writes JSON (can be enhanced later)
func (c *MinIOClient) WriteRecordsAsParquet(objectKey string, records []map[string]interface{}) error {
	// TODO: Implement proper Parquet encoding using parquet-go library
	// For now, we'll write as JSON-lines format which is more portable
	if len(records) == 0 {
		return fmt.Errorf("no records to write")
	}

	var buf bytes.Buffer
	encoder := json.NewEncoder(&buf)

	for _, record := range records {
		if err := encoder.Encode(record); err != nil {
			return fmt.Errorf("failed to encode record: %w", err)
		}
	}

	// Use .jsonl extension for JSON lines format
	// When proper Parquet support is added, this will write actual Parquet files
	return c.WriteObject(objectKey, buf.Bytes(), "application/x-ndjson")
}

// WriteRecords writes records to MinIO in the specified format
func (c *MinIOClient) WriteRecords(objectKey string, records []map[string]interface{}, format string) error {
	switch strings.ToLower(format) {
	case "csv":
		return c.WriteRecordsAsCSV(objectKey, records)
	case "json":
		return c.WriteRecordsAsJSON(objectKey, records)
	case "parquet", "jsonl":
		return c.WriteRecordsAsParquet(objectKey, records)
	default:
		return fmt.Errorf("unsupported export format: %s (supported: csv, json, parquet)", format)
	}
}

// GetContentTypeForFormat returns the appropriate content type for a format
func GetContentTypeForFormat(format string) string {
	switch strings.ToLower(format) {
	case "csv":
		return "text/csv"
	case "json":
		return "application/json"
	case "parquet":
		return "application/octet-stream"
	case "jsonl":
		return "application/x-ndjson"
	default:
		return "application/octet-stream"
	}
}

// Close closes the MinIO client (no-op for MinIO, but kept for interface consistency)
func (c *MinIOClient) Close() error {
	// MinIO client doesn't need explicit closing
	return nil
}

// GetBucketName returns the bucket name of this client
func (c *MinIOClient) GetBucketName() string {
	return c.bucketName
}

// GetClient returns the underlying minio client for advanced operations
func (c *MinIOClient) GetClient() *minio.Client {
	return c.client
}

// MirrorOptions configures the mirror operation
type MirrorOptions struct {
	Prefix      string // Source prefix to mirror
	Pattern     string // Optional glob pattern filter (e.g., "*.csv")
	Incremental bool   // Skip objects that already exist in target (based on ETag/size)
	WatchMode   bool   // Enable continuous watch for new objects
}

// MirrorStats holds statistics from a mirror operation
type MirrorStats struct {
	ObjectsCopied  int64    `json:"objects_copied"`
	ObjectsSkipped int64    `json:"objects_skipped"`
	BytesCopied    int64    `json:"bytes_copied"`
	Errors         []string `json:"errors,omitempty"`
}

// GetObjectStat gets object metadata (size, ETag, etc.)
func (c *MinIOClient) GetObjectStat(objectKey string) (*minio.ObjectInfo, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	info, err := c.client.StatObject(ctx, c.bucketName, objectKey, minio.StatObjectOptions{})
	if err != nil {
		return nil, err
	}
	return &info, nil
}

// ObjectExists checks if an object exists in the bucket
func (c *MinIOClient) ObjectExists(objectKey string) (bool, error) {
	_, err := c.GetObjectStat(objectKey)
	if err != nil {
		// Check if error is "object not found"
		errResp := minio.ToErrorResponse(err)
		if errResp.Code == "NoSuchKey" {
			return false, nil
		}
		return false, err
	}
	return true, nil
}

// CopyObjectTo copies a single object from this client to target client
func (c *MinIOClient) CopyObjectTo(objectKey string, target *MinIOClient, targetKey string) (int64, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)
	defer cancel()

	// Get source object
	srcObj, err := c.client.GetObject(ctx, c.bucketName, objectKey, minio.GetObjectOptions{})
	if err != nil {
		return 0, fmt.Errorf("failed to get source object: %w", err)
	}
	defer srcObj.Close()

	// Get object info for size and content type
	srcInfo, err := srcObj.Stat()
	if err != nil {
		return 0, fmt.Errorf("failed to get source object stat: %w", err)
	}

	// Put to target
	_, err = target.client.PutObject(ctx, target.bucketName, targetKey, srcObj, srcInfo.Size, minio.PutObjectOptions{
		ContentType: srcInfo.ContentType,
	})
	if err != nil {
		return 0, fmt.Errorf("failed to put object to target: %w", err)
	}

	return srcInfo.Size, nil
}

// ShouldCopyObject checks if object should be copied (for incremental sync)
func (c *MinIOClient) ShouldCopyObject(srcInfo ObjectInfo, target *MinIOClient, targetKey string) bool {
	targetStat, err := target.GetObjectStat(targetKey)
	if err != nil {
		// Object doesn't exist in target, should copy
		return true
	}

	// Compare size and ETag for change detection
	if srcInfo.Size != targetStat.Size {
		return true
	}

	// ETag comparison (if available and meaningful)
	// Note: ETag may differ between servers for same content due to multipart upload handling
	// So we primarily rely on size and modification time

	if srcInfo.LastModified.After(targetStat.LastModified) {
		return true
	}

	return false
}

// MirrorTo syncs objects from this client to target client
func (c *MinIOClient) MirrorTo(target *MinIOClient, opts MirrorOptions, progressFn func(copied, skipped int64, currentObject string)) (*MirrorStats, error) {
	stats := &MirrorStats{}

	// List source objects
	objects, err := c.ListObjects(opts.Prefix, opts.Pattern)
	if err != nil {
		return nil, fmt.Errorf("failed to list source objects: %w", err)
	}

	for _, obj := range objects {
		targetKey := obj.Key
		if opts.Prefix != "" {
			// Keep the same path structure in target
			targetKey = obj.Key
		}

		// Check if we should skip (incremental mode)
		if opts.Incremental {
			if !c.ShouldCopyObject(obj, target, targetKey) {
				stats.ObjectsSkipped++
				if progressFn != nil {
					progressFn(stats.ObjectsCopied, stats.ObjectsSkipped, obj.Key+" (skipped)")
				}
				continue
			}
		}

		// Copy the object
		bytesCopied, err := c.CopyObjectTo(obj.Key, target, targetKey)
		if err != nil {
			stats.Errors = append(stats.Errors, fmt.Sprintf("%s: %v", obj.Key, err))
			continue
		}

		stats.ObjectsCopied++
		stats.BytesCopied += bytesCopied

		if progressFn != nil {
			progressFn(stats.ObjectsCopied, stats.ObjectsSkipped, obj.Key)
		}
	}

	return stats, nil
}

// WatchAndMirror watches for new objects and mirrors them to target (continuous sync)
func (c *MinIOClient) WatchAndMirror(target *MinIOClient, opts MirrorOptions, stopChan <-chan struct{}, eventFn func(event string, objectKey string)) error {
	// First, do an initial mirror
	_, err := c.MirrorTo(target, opts, nil)
	if err != nil {
		return fmt.Errorf("initial mirror failed: %w", err)
	}

	if eventFn != nil {
		eventFn("initial_sync_complete", "")
	}

	// Set up polling-based watch (MinIO notification requires bucket notification configuration)
	// Using polling as a simpler cross-compatible solution
	ticker := time.NewTicker(30 * time.Second) // Poll every 30 seconds
	defer ticker.Stop()

	// Track last sync time
	lastSyncTime := time.Now()

	for {
		select {
		case <-stopChan:
			if eventFn != nil {
				eventFn("watch_stopped", "")
			}
			return nil

		case <-ticker.C:
			// List new objects since last sync
			objects, err := c.ListObjects(opts.Prefix, opts.Pattern)
			if err != nil {
				if eventFn != nil {
					eventFn("list_error", err.Error())
				}
				continue
			}

			newObjects := 0
			for _, obj := range objects {
				// Check if object is new or modified since last sync
				if obj.LastModified.After(lastSyncTime) {
					targetKey := obj.Key

					// Check if should copy (incremental)
					if opts.Incremental && !c.ShouldCopyObject(obj, target, targetKey) {
						continue
					}

					_, err := c.CopyObjectTo(obj.Key, target, targetKey)
					if err != nil {
						if eventFn != nil {
							eventFn("copy_error", fmt.Sprintf("%s: %v", obj.Key, err))
						}
						continue
					}

					newObjects++
					if eventFn != nil {
						eventFn("object_copied", obj.Key)
					}
				}
			}

			if newObjects > 0 && eventFn != nil {
				eventFn("sync_complete", fmt.Sprintf("%d objects synced", newObjects))
			}

			lastSyncTime = time.Now()
		}
	}
}
