package filesync

import (
	"bytes"
	"fmt"
	"io"
	"path"
	"path/filepath"
	"strings"
	"time"

	"github.com/jlaffaye/ftp"
)

// FTPClient wraps FTP connection functionality
type FTPClient struct {
	conn *ftp.ServerConn
	host string
	port string
}

// FTPConfig holds FTP connection configuration
type FTPConfig struct {
	Host     string
	Port     string
	User     string
	Password string
	Path     string
	Passive  bool
}

// NewFTPClient creates a new FTP client and connects to the server
func NewFTPClient(config FTPConfig) (*FTPClient, error) {
	addr := fmt.Sprintf("%s:%s", config.Host, config.Port)

	conn, err := ftp.Dial(addr, ftp.DialWithTimeout(30*time.Second))
	if err != nil {
		return nil, fmt.Errorf("failed to connect to FTP server: %w", err)
	}

	if err := conn.Login(config.User, config.Password); err != nil {
		conn.Quit()
		return nil, fmt.Errorf("failed to login to FTP server: %w", err)
	}

	return &FTPClient{
		conn: conn,
		host: config.Host,
		port: config.Port,
	}, nil
}

// ListFiles lists files in the remote directory matching the pattern
func (c *FTPClient) ListFiles(remotePath, pattern string) ([]string, error) {
	entries, err := c.conn.List(remotePath)
	if err != nil {
		return nil, fmt.Errorf("failed to list directory: %w", err)
	}

	var files []string
	for _, entry := range entries {
		if entry.Type == ftp.EntryTypeFile {
			// Match pattern if provided
			if pattern != "" {
				matched, err := filepath.Match(pattern, entry.Name)
				if err != nil {
					continue
				}
				if !matched {
					continue
				}
			}
			files = append(files, path.Join(remotePath, entry.Name))
		}
	}

	return files, nil
}

// ReadFile reads a file from the FTP server into memory
func (c *FTPClient) ReadFile(remotePath string) ([]byte, error) {
	resp, err := c.conn.Retr(remotePath)
	if err != nil {
		return nil, fmt.Errorf("failed to retrieve file: %w", err)
	}
	defer resp.Close()

	var buf bytes.Buffer
	_, err = io.Copy(&buf, resp)
	if err != nil {
		return nil, fmt.Errorf("failed to read file content: %w", err)
	}

	return buf.Bytes(), nil
}

// FindAndReadFile finds a file matching the pattern and reads it
func (c *FTPClient) FindAndReadFile(remotePath, pattern string) ([]byte, string, error) {
	// If pattern is a specific filename (no wildcards), try to read it directly
	if !strings.Contains(pattern, "*") && !strings.Contains(pattern, "?") {
		fullPath := path.Join(remotePath, pattern)
		data, err := c.ReadFile(fullPath)
		if err != nil {
			return nil, "", err
		}
		return data, pattern, nil
	}

	// List files and find matching ones
	files, err := c.ListFiles(remotePath, pattern)
	if err != nil {
		return nil, "", err
	}

	if len(files) == 0 {
		return nil, "", fmt.Errorf("no files matching pattern '%s' found in '%s'", pattern, remotePath)
	}

	// Read the first matching file (or most recent - could be enhanced)
	data, err := c.ReadFile(files[0])
	if err != nil {
		return nil, "", err
	}

	return data, filepath.Base(files[0]), nil
}

// Close closes the FTP connection
func (c *FTPClient) Close() error {
	if c.conn != nil {
		return c.conn.Quit()
	}
	return nil
}
