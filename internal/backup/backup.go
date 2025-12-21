package backup

import (
	"archive/zip"
	"dsp-platform/internal/logger"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"
)

// BackupInfo contains metadata about a backup file
type BackupInfo struct {
	Filename  string    `json:"filename"`
	Size      int64     `json:"size"`
	CreatedAt time.Time `json:"created_at"`
}

// DefaultBackupDir is the default directory for backups
const DefaultBackupDir = "./backups"

// FilesToBackup lists the files/directories to include in backup
var FilesToBackup = []string{
	"dsp.db",
	".env",
	"certs",
}

// CreateBackup creates a ZIP backup of database, config, and certificates
func CreateBackup(backupDir string) (string, error) {
	// Ensure backup directory exists
	if err := os.MkdirAll(backupDir, 0755); err != nil {
		return "", fmt.Errorf("failed to create backup directory: %w", err)
	}

	// Generate backup filename with timestamp
	timestamp := time.Now().Format("20060102_150405")
	filename := fmt.Sprintf("backup_%s.zip", timestamp)
	zipPath := filepath.Join(backupDir, filename)

	// Create ZIP file
	zipFile, err := os.Create(zipPath)
	if err != nil {
		return "", fmt.Errorf("failed to create backup file: %w", err)
	}
	defer zipFile.Close()

	zipWriter := zip.NewWriter(zipFile)
	defer zipWriter.Close()

	// Add each file/directory to the backup
	for _, item := range FilesToBackup {
		info, err := os.Stat(item)
		if os.IsNotExist(err) {
			// Skip files that don't exist (e.g., certs might not exist)
			logger.Logger.Debug().Str("item", item).Msg("Backup item not found, skipping")
			continue
		}
		if err != nil {
			return "", fmt.Errorf("failed to stat %s: %w", item, err)
		}

		if info.IsDir() {
			// Add directory contents recursively
			if err := addDirToZip(zipWriter, item, item); err != nil {
				return "", fmt.Errorf("failed to add directory %s to backup: %w", item, err)
			}
		} else {
			// Add single file
			if err := addFileToZip(zipWriter, item, item); err != nil {
				return "", fmt.Errorf("failed to add file %s to backup: %w", item, err)
			}
		}
	}

	logger.Logger.Info().Str("filename", filename).Msg("Backup created successfully")
	return filename, nil
}

// addFileToZip adds a single file to the ZIP archive
func addFileToZip(zipWriter *zip.Writer, filePath, zipPath string) error {
	file, err := os.Open(filePath)
	if err != nil {
		return err
	}
	defer file.Close()

	info, err := file.Stat()
	if err != nil {
		return err
	}

	header, err := zip.FileInfoHeader(info)
	if err != nil {
		return err
	}
	header.Name = zipPath
	header.Method = zip.Deflate

	writer, err := zipWriter.CreateHeader(header)
	if err != nil {
		return err
	}

	_, err = io.Copy(writer, file)
	return err
}

// addDirToZip adds a directory and its contents recursively to the ZIP archive
func addDirToZip(zipWriter *zip.Writer, dirPath, basePath string) error {
	return filepath.Walk(dirPath, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}

		// Get relative path for ZIP
		relPath, err := filepath.Rel(filepath.Dir(basePath), path)
		if err != nil {
			return err
		}

		if info.IsDir() {
			return nil // Skip directories, they'll be created implicitly
		}

		return addFileToZip(zipWriter, path, relPath)
	})
}

// RestoreBackup extracts a backup ZIP and restores files
func RestoreBackup(zipPath string) error {
	reader, err := zip.OpenReader(zipPath)
	if err != nil {
		return fmt.Errorf("failed to open backup file: %w", err)
	}
	defer reader.Close()

	// Extract to current directory
	for _, file := range reader.File {
		destPath := filepath.Clean(file.Name)

		// Security check: prevent path traversal
		if strings.Contains(destPath, "..") {
			return fmt.Errorf("invalid file path in backup: %s", file.Name)
		}

		if file.FileInfo().IsDir() {
			if err := os.MkdirAll(destPath, file.Mode()); err != nil {
				return err
			}
			continue
		}

		// Create parent directories if needed
		if err := os.MkdirAll(filepath.Dir(destPath), 0755); err != nil {
			return err
		}

		// Extract file
		if err := extractFile(file, destPath); err != nil {
			return fmt.Errorf("failed to extract %s: %w", file.Name, err)
		}
	}

	logger.Logger.Info().Str("backup", zipPath).Msg("Backup restored successfully")
	return nil
}

// extractFile extracts a single file from the ZIP archive
func extractFile(file *zip.File, destPath string) error {
	src, err := file.Open()
	if err != nil {
		return err
	}
	defer src.Close()

	dest, err := os.OpenFile(destPath, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, file.Mode())
	if err != nil {
		return err
	}
	defer dest.Close()

	_, err = io.Copy(dest, src)
	return err
}

// ListBackups returns a list of available backups
func ListBackups(backupDir string) ([]BackupInfo, error) {
	backups := []BackupInfo{}

	// Check if backup directory exists
	if _, err := os.Stat(backupDir); os.IsNotExist(err) {
		return backups, nil // No backups yet
	}

	entries, err := os.ReadDir(backupDir)
	if err != nil {
		return nil, fmt.Errorf("failed to read backup directory: %w", err)
	}

	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".zip") {
			continue
		}

		info, err := entry.Info()
		if err != nil {
			continue
		}

		backups = append(backups, BackupInfo{
			Filename:  entry.Name(),
			Size:      info.Size(),
			CreatedAt: info.ModTime(),
		})
	}

	// Sort by creation time, newest first
	sort.Slice(backups, func(i, j int) bool {
		return backups[i].CreatedAt.After(backups[j].CreatedAt)
	})

	return backups, nil
}

// DeleteBackup deletes a backup file
func DeleteBackup(backupDir, filename string) error {
	// Security check: prevent path traversal
	if strings.Contains(filename, "..") || strings.Contains(filename, "/") || strings.Contains(filename, "\\") {
		return fmt.Errorf("invalid filename")
	}

	if !strings.HasSuffix(filename, ".zip") {
		return fmt.Errorf("invalid backup file")
	}

	path := filepath.Join(backupDir, filename)

	// Check if file exists
	if _, err := os.Stat(path); os.IsNotExist(err) {
		return fmt.Errorf("backup not found")
	}

	if err := os.Remove(path); err != nil {
		return fmt.Errorf("failed to delete backup: %w", err)
	}

	logger.Logger.Info().Str("filename", filename).Msg("Backup deleted")
	return nil
}

// GetBackupPath returns the full path for a backup file
func GetBackupPath(backupDir, filename string) (string, error) {
	// Security check
	if strings.Contains(filename, "..") || strings.Contains(filename, "/") || strings.Contains(filename, "\\") {
		return "", fmt.Errorf("invalid filename")
	}

	if !strings.HasSuffix(filename, ".zip") {
		return "", fmt.Errorf("invalid backup file")
	}

	path := filepath.Join(backupDir, filename)

	if _, err := os.Stat(path); os.IsNotExist(err) {
		return "", fmt.Errorf("backup not found")
	}

	return path, nil
}
