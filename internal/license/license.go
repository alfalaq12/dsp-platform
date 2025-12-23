package license

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"net"
	"os"
	"strings"
	"time"
)

// Secret key for HMAC signing (in production, load from env or secure storage)
var licenseSecretKey = []byte("DSP-LICENSE-SECRET-KEY-2024-CHANGE-IN-PRODUCTION")

// Test mode flag - when true, days are treated as minutes for testing
var licenseTestMode = false

func init() {
	// Allow override from environment
	if key := os.Getenv("LICENSE_SECRET_KEY"); key != "" {
		licenseSecretKey = []byte(key)
	}
	// Check for test mode
	if os.Getenv("LICENSE_TEST_MODE") == "true" {
		licenseTestMode = true
	}
}

// GenerateMachineID creates a unique machine identifier based on hostname and MAC addresses
func GenerateMachineID() (string, error) {
	hostname, err := os.Hostname()
	if err != nil {
		hostname = "unknown"
	}

	// Get MAC addresses
	macs := []string{}
	interfaces, err := net.Interfaces()
	if err == nil {
		for _, iface := range interfaces {
			// Skip loopback and interfaces without hardware address
			if iface.Flags&net.FlagLoopback != 0 || len(iface.HardwareAddr) == 0 {
				continue
			}
			macs = append(macs, iface.HardwareAddr.String())
		}
	}

	// Combine hostname and MACs
	combined := hostname
	if len(macs) > 0 {
		combined += ":" + strings.Join(macs, ",")
	}

	// Hash it for privacy and consistent length
	hash := sha256.Sum256([]byte(combined))

	// Take first 16 bytes and format as readable code
	shortHash := hex.EncodeToString(hash[:8])
	machineID := fmt.Sprintf("DSP-%s-%s", strings.ToUpper(shortHash[:8]), strings.ToUpper(shortHash[8:]))

	return machineID, nil
}

// GenerateActivationCode creates an activation code for a given machine ID and expiry duration
// This function should be used by the vendor to generate codes for customers
// In test mode (LICENSE_TEST_MODE=true), days are treated as minutes
func GenerateActivationCode(machineID string, expiryDays int) string {
	var expiryDate time.Time
	if licenseTestMode {
		// Test mode: treat days as minutes
		expiryDate = time.Now().Add(time.Duration(expiryDays) * time.Minute)
	} else {
		expiryDate = time.Now().AddDate(0, 0, expiryDays)
	}
	// Use full timestamp format in test mode for precision
	var expiryStr string
	if licenseTestMode {
		expiryStr = expiryDate.Format(time.RFC3339)
	} else {
		expiryStr = expiryDate.Format("2006-01-02")
	}

	// Payload: machineID|expiryDate
	payload := fmt.Sprintf("%s|%s", machineID, expiryStr)
	encodedPayload := base64.RawURLEncoding.EncodeToString([]byte(payload))

	// Sign the payload
	signature := signData(encodedPayload)

	// Format: DSP-YEAR-PAYLOAD-SIGNATURE
	year := expiryDate.Year()
	activationCode := fmt.Sprintf("DSP-%d-%s-%s", year, encodedPayload, signature[:12])

	return activationCode
}

// ValidateActivationCode checks if the activation code is valid for this machine
// Returns: isValid, expiryDate, error
func ValidateActivationCode(machineID, activationCode string) (bool, time.Time, error) {
	// Parse the activation code
	parts := strings.Split(activationCode, "-")
	if len(parts) < 4 || parts[0] != "DSP" {
		return false, time.Time{}, fmt.Errorf("invalid activation code format")
	}

	// Extract payload and signature
	// Format: DSP-YEAR-PAYLOAD-SIGNATURE
	encodedPayload := parts[2]
	providedSig := parts[3]

	// Verify signature
	expectedSig := signData(encodedPayload)
	if !strings.HasPrefix(expectedSig, providedSig) {
		return false, time.Time{}, fmt.Errorf("invalid activation code signature")
	}

	// Decode payload
	payloadBytes, err := base64.RawURLEncoding.DecodeString(encodedPayload)
	if err != nil {
		return false, time.Time{}, fmt.Errorf("invalid activation code encoding")
	}

	payload := string(payloadBytes)
	payloadParts := strings.Split(payload, "|")
	if len(payloadParts) != 2 {
		return false, time.Time{}, fmt.Errorf("invalid activation code payload")
	}

	codeMachineID := payloadParts[0]
	expiryStr := payloadParts[1]

	// Verify machine ID matches
	if codeMachineID != machineID {
		return false, time.Time{}, fmt.Errorf("activation code is for a different machine")
	}

	// Parse expiry date - try RFC3339 first (test mode), then date only (production)
	expiryDate, err := time.Parse(time.RFC3339, expiryStr)
	if err != nil {
		// Fallback to date-only format
		expiryDate, err = time.Parse("2006-01-02", expiryStr)
		if err != nil {
			return false, time.Time{}, fmt.Errorf("invalid expiry date in activation code")
		}
		// For date-only, give until end of day
		expiryDate = expiryDate.Add(24 * time.Hour)
	}

	// Check if expired
	if time.Now().After(expiryDate) {
		return false, expiryDate, fmt.Errorf("activation code has expired")
	}

	return true, expiryDate, nil
}

// signData creates an HMAC-SHA256 signature of the data
func signData(data string) string {
	h := hmac.New(sha256.New, licenseSecretKey)
	h.Write([]byte(data))
	return hex.EncodeToString(h.Sum(nil))
}

// DaysUntilExpiry calculates remaining days until license expiry
func DaysUntilExpiry(expiryDate time.Time) int {
	duration := time.Until(expiryDate)
	days := int(duration.Hours() / 24)
	if days < 0 {
		return 0
	}
	return days
}

// IsExpiringSoon checks if license expires within given days
func IsExpiringSoon(expiryDate time.Time, warningDays int) bool {
	return DaysUntilExpiry(expiryDate) <= warningDays
}
