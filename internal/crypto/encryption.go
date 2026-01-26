package crypto

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"os"

	"golang.org/x/crypto/pbkdf2"
)

const (
	// KeySize is the size of AES-256 key in bytes
	KeySize = 32
	// NonceSize is the size of GCM nonce in bytes
	NonceSize = 12
	// SaltSize is the size of PBKDF2 salt in bytes
	SaltSize = 16
	// PBKDF2Iterations is the number of iterations for key derivation
	PBKDF2Iterations = 100000
	// EncryptedPrefix marks encrypted messages
	EncryptedPrefix = "ENC:"
)

var (
	// ErrInvalidCiphertext is returned when ciphertext is malformed
	ErrInvalidCiphertext = errors.New("invalid ciphertext")
	// ErrEncryptionDisabled is returned when encryption is not configured
	ErrEncryptionDisabled = errors.New("encryption not configured")
)

// Encryptor handles AES-256-GCM encryption/decryption
type Encryptor struct {
	enabled bool
	key     []byte
}

// Config holds encryption configuration
type Config struct {
	Enabled bool
	Key     string // Shared secret key
}

// LoadConfigFromEnv loads encryption config from environment
func LoadConfigFromEnv() Config {
	return Config{
		Enabled: getEnvBool("PAYLOAD_ENCRYPTION", false),
		Key:     os.Getenv("ENCRYPTION_KEY"),
	}
}

// NewEncryptor creates a new Encryptor instance
func NewEncryptor(config Config) (*Encryptor, error) {
	if !config.Enabled || config.Key == "" {
		return &Encryptor{enabled: false}, nil
	}

	// Derive key from shared secret using PBKDF2
	salt := []byte("dsp-platform-v1") // Static salt - key uniqueness comes from ENCRYPTION_KEY
	key := pbkdf2.Key([]byte(config.Key), salt, PBKDF2Iterations, KeySize, sha256.New)

	return &Encryptor{
		enabled: true,
		key:     key,
	}, nil
}

// IsEnabled returns whether encryption is enabled
func (e *Encryptor) IsEnabled() bool {
	return e.enabled
}

// Encrypt encrypts plaintext using AES-256-GCM
// Returns base64-encoded ciphertext with EncryptedPrefix
func (e *Encryptor) Encrypt(plaintext []byte) (string, error) {
	if !e.enabled {
		// Return as-is if encryption disabled
		return string(plaintext), nil
	}

	block, err := aes.NewCipher(e.key)
	if err != nil {
		return "", fmt.Errorf("failed to create cipher: %w", err)
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", fmt.Errorf("failed to create GCM: %w", err)
	}

	// Generate random nonce
	nonce := make([]byte, NonceSize)
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", fmt.Errorf("failed to generate nonce: %w", err)
	}

	// Encrypt and prepend nonce
	ciphertext := gcm.Seal(nonce, nonce, plaintext, nil)

	// Encode to base64 and add prefix
	encoded := base64.StdEncoding.EncodeToString(ciphertext)
	return EncryptedPrefix + encoded, nil
}

// Decrypt decrypts base64-encoded ciphertext using AES-256-GCM
func (e *Encryptor) Decrypt(data string) ([]byte, error) {
	// Check if data is encrypted
	if len(data) < len(EncryptedPrefix) || data[:len(EncryptedPrefix)] != EncryptedPrefix {
		// Not encrypted, return as-is (backward compatibility)
		return []byte(data), nil
	}

	if !e.enabled {
		return nil, ErrEncryptionDisabled
	}

	// Remove prefix and decode base64
	encoded := data[len(EncryptedPrefix):]
	ciphertext, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil {
		return nil, fmt.Errorf("failed to decode base64: %w", err)
	}

	if len(ciphertext) < NonceSize {
		return nil, ErrInvalidCiphertext
	}

	block, err := aes.NewCipher(e.key)
	if err != nil {
		return nil, fmt.Errorf("failed to create cipher: %w", err)
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("failed to create GCM: %w", err)
	}

	// Extract nonce and decrypt
	nonce := ciphertext[:NonceSize]
	ciphertext = ciphertext[NonceSize:]

	plaintext, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to decrypt: %w", err)
	}

	return plaintext, nil
}

// EncryptString encrypts a string
func (e *Encryptor) EncryptString(plaintext string) (string, error) {
	return e.Encrypt([]byte(plaintext))
}

// DecryptString decrypts to a string
func (e *Encryptor) DecryptString(ciphertext string) (string, error) {
	data, err := e.Decrypt(ciphertext)
	if err != nil {
		return "", err
	}
	return string(data), nil
}

// IsEncrypted checks if data has encryption prefix
func IsEncrypted(data string) bool {
	return len(data) >= len(EncryptedPrefix) && data[:len(EncryptedPrefix)] == EncryptedPrefix
}

// Helper functions
func getEnvBool(key string, defaultValue bool) bool {
	if value := os.Getenv(key); value != "" {
		return value == "true" || value == "1" || value == "yes"
	}
	return defaultValue
}
