package filesync

import (
	"bytes"
	"fmt"
	"io"
	"net"
	"path"
	"path/filepath"
	"strings"
	"time"

	"github.com/pkg/sftp"
	"golang.org/x/crypto/ssh"
)

// SFTPClient wraps SFTP connection functionality
type SFTPClient struct {
	sshConn  *ssh.Client
	sftpConn *sftp.Client
	host     string
	port     string
}

// SFTPConfig holds SFTP connection configuration
type SFTPConfig struct {
	Host     string
	Port     string
	User     string
	Password string
	Path     string
}

// NewSFTPClient creates a new SFTP client and connects to the server
func NewSFTPClient(config SFTPConfig) (*SFTPClient, error) {
	sshConfig := &ssh.ClientConfig{
		User: config.User,
		Auth: []ssh.AuthMethod{
			ssh.Password(config.Password),
		},
		HostKeyCallback: ssh.InsecureIgnoreHostKey(), // Note: In production, use proper host key verification
		Timeout:         30 * time.Second,
	}

	addr := net.JoinHostPort(config.Host, config.Port)
	sshConn, err := ssh.Dial("tcp", addr, sshConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to SFTP server: %w", err)
	}

	sftpConn, err := sftp.NewClient(sshConn)
	if err != nil {
		sshConn.Close()
		return nil, fmt.Errorf("failed to create SFTP client: %w", err)
	}

	return &SFTPClient{
		sshConn:  sshConn,
		sftpConn: sftpConn,
		host:     config.Host,
		port:     config.Port,
	}, nil
}

// ListFiles lists files in the remote directory matching the pattern
func (c *SFTPClient) ListFiles(remotePath, pattern string) ([]string, error) {
	entries, err := c.sftpConn.ReadDir(remotePath)
	if err != nil {
		return nil, fmt.Errorf("failed to list directory: %w", err)
	}

	var files []string
	for _, entry := range entries {
		if !entry.IsDir() {
			// Match pattern if provided
			if pattern != "" {
				matched, err := filepath.Match(pattern, entry.Name())
				if err != nil {
					continue
				}
				if !matched {
					continue
				}
			}
			files = append(files, path.Join(remotePath, entry.Name()))
		}
	}

	return files, nil
}

// ReadFile reads a file from the SFTP server into memory
func (c *SFTPClient) ReadFile(remotePath string) ([]byte, error) {
	file, err := c.sftpConn.Open(remotePath)
	if err != nil {
		return nil, fmt.Errorf("failed to open file: %w", err)
	}
	defer file.Close()

	var buf bytes.Buffer
	_, err = io.Copy(&buf, file)
	if err != nil {
		return nil, fmt.Errorf("failed to read file content: %w", err)
	}

	return buf.Bytes(), nil
}

// FindAndReadFile finds a file matching the pattern and reads it
func (c *SFTPClient) FindAndReadFile(remotePath, pattern string) ([]byte, string, error) {
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

	// Read the first matching file
	data, err := c.ReadFile(files[0])
	if err != nil {
		return nil, "", err
	}

	return data, filepath.Base(files[0]), nil
}

// Close closes the SFTP and SSH connections
func (c *SFTPClient) Close() error {
	if c.sftpConn != nil {
		c.sftpConn.Close()
	}
	if c.sshConn != nil {
		c.sshConn.Close()
	}
	return nil
}
