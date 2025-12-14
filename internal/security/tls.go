package security

import (
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/tls"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/pem"
	"fmt"
	"math/big"
	"net"
	"os"
	"time"
)

// TLSConfig holds the TLS configuration paths
type TLSConfig struct {
	Enabled    bool
	CertPath   string
	KeyPath    string
	CAPath     string
	SkipVerify bool
}

// LoadTLSConfigFromEnv loads TLS configuration from environment variables
func LoadTLSConfigFromEnv() TLSConfig {
	return TLSConfig{
		Enabled:    getEnvBool("TLS_ENABLED", false),
		CertPath:   getEnv("TLS_CERT_PATH", "./certs/server.crt"),
		KeyPath:    getEnv("TLS_KEY_PATH", "./certs/server.key"),
		CAPath:     getEnv("TLS_CA_PATH", "./certs/ca.crt"),
		SkipVerify: getEnvBool("TLS_SKIP_VERIFY", false),
	}
}

// LoadServerTLSConfig loads TLS configuration for the server (Master)
// Used for both HTTPS and Agent TLS listener
func LoadServerTLSConfig(certPath, keyPath string) (*tls.Config, error) {
	cert, err := tls.LoadX509KeyPair(certPath, keyPath)
	if err != nil {
		return nil, fmt.Errorf("failed to load server certificate: %w", err)
	}

	return &tls.Config{
		Certificates: []tls.Certificate{cert},
		MinVersion:   tls.VersionTLS12,
		CipherSuites: []uint16{
			tls.TLS_ECDHE_ECDSA_WITH_AES_256_GCM_SHA384,
			tls.TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384,
			tls.TLS_ECDHE_ECDSA_WITH_AES_128_GCM_SHA256,
			tls.TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256,
		},
	}, nil
}

// LoadClientTLSConfig loads TLS configuration for the client (Agent)
func LoadClientTLSConfig(caPath string, skipVerify bool) (*tls.Config, error) {
	config := &tls.Config{
		MinVersion: tls.VersionTLS12,
	}

	if skipVerify {
		config.InsecureSkipVerify = true
		return config, nil
	}

	if caPath != "" {
		caCert, err := os.ReadFile(caPath)
		if err != nil {
			return nil, fmt.Errorf("failed to read CA certificate: %w", err)
		}

		caCertPool := x509.NewCertPool()
		if !caCertPool.AppendCertsFromPEM(caCert) {
			return nil, fmt.Errorf("failed to parse CA certificate")
		}

		config.RootCAs = caCertPool
	}

	return config, nil
}

// GenerateSelfSignedCert generates a self-signed certificate for development
// It creates both CA and server certificates
func GenerateSelfSignedCert(certDir string, hosts []string) error {
	// Ensure directory exists
	if err := os.MkdirAll(certDir, 0755); err != nil {
		return fmt.Errorf("failed to create cert directory: %w", err)
	}

	// Generate CA private key
	caPrivKey, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		return fmt.Errorf("failed to generate CA private key: %w", err)
	}

	// Create CA certificate template
	caTemplate := x509.Certificate{
		SerialNumber: big.NewInt(1),
		Subject: pkix.Name{
			Organization: []string{"DSP Platform"},
			Country:      []string{"ID"},
			Province:     []string{"Indonesia"},
			Locality:     []string{"Jakarta"},
			CommonName:   "DSP Platform CA",
		},
		NotBefore:             time.Now(),
		NotAfter:              time.Now().AddDate(10, 0, 0), // Valid for 10 years
		KeyUsage:              x509.KeyUsageCertSign | x509.KeyUsageCRLSign,
		IsCA:                  true,
		BasicConstraintsValid: true,
	}

	// Create CA certificate
	caCertDER, err := x509.CreateCertificate(rand.Reader, &caTemplate, &caTemplate, &caPrivKey.PublicKey, caPrivKey)
	if err != nil {
		return fmt.Errorf("failed to create CA certificate: %w", err)
	}

	// Save CA certificate
	caCertPath := certDir + "/ca.crt"
	caCertFile, err := os.Create(caCertPath)
	if err != nil {
		return fmt.Errorf("failed to create CA cert file: %w", err)
	}
	pem.Encode(caCertFile, &pem.Block{Type: "CERTIFICATE", Bytes: caCertDER})
	caCertFile.Close()

	// Save CA private key
	caKeyPath := certDir + "/ca.key"
	caKeyFile, err := os.Create(caKeyPath)
	if err != nil {
		return fmt.Errorf("failed to create CA key file: %w", err)
	}
	caPrivKeyBytes, _ := x509.MarshalECPrivateKey(caPrivKey)
	pem.Encode(caKeyFile, &pem.Block{Type: "EC PRIVATE KEY", Bytes: caPrivKeyBytes})
	caKeyFile.Close()

	// Generate server private key
	serverPrivKey, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		return fmt.Errorf("failed to generate server private key: %w", err)
	}

	// Create server certificate template
	serverTemplate := x509.Certificate{
		SerialNumber: big.NewInt(2),
		Subject: pkix.Name{
			Organization: []string{"DSP Platform"},
			Country:      []string{"ID"},
			CommonName:   "DSP Platform Server",
		},
		NotBefore:             time.Now(),
		NotAfter:              time.Now().AddDate(1, 0, 0), // Valid for 1 year
		KeyUsage:              x509.KeyUsageKeyEncipherment | x509.KeyUsageDigitalSignature,
		ExtKeyUsage:           []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth},
		BasicConstraintsValid: true,
	}

	// Add hosts to certificate
	for _, h := range hosts {
		if ip := net.ParseIP(h); ip != nil {
			serverTemplate.IPAddresses = append(serverTemplate.IPAddresses, ip)
		} else {
			serverTemplate.DNSNames = append(serverTemplate.DNSNames, h)
		}
	}

	// Default hosts
	serverTemplate.IPAddresses = append(serverTemplate.IPAddresses, net.ParseIP("127.0.0.1"))
	serverTemplate.DNSNames = append(serverTemplate.DNSNames, "localhost")

	// Parse CA certificate for signing
	caCert, _ := x509.ParseCertificate(caCertDER)

	// Create server certificate signed by CA
	serverCertDER, err := x509.CreateCertificate(rand.Reader, &serverTemplate, caCert, &serverPrivKey.PublicKey, caPrivKey)
	if err != nil {
		return fmt.Errorf("failed to create server certificate: %w", err)
	}

	// Save server certificate
	serverCertPath := certDir + "/server.crt"
	serverCertFile, err := os.Create(serverCertPath)
	if err != nil {
		return fmt.Errorf("failed to create server cert file: %w", err)
	}
	pem.Encode(serverCertFile, &pem.Block{Type: "CERTIFICATE", Bytes: serverCertDER})
	serverCertFile.Close()

	// Save server private key
	serverKeyPath := certDir + "/server.key"
	serverKeyFile, err := os.Create(serverKeyPath)
	if err != nil {
		return fmt.Errorf("failed to create server key file: %w", err)
	}
	serverPrivKeyBytes, _ := x509.MarshalECPrivateKey(serverPrivKey)
	pem.Encode(serverKeyFile, &pem.Block{Type: "EC PRIVATE KEY", Bytes: serverPrivKeyBytes})
	serverKeyFile.Close()

	return nil
}

// Helper functions
func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func getEnvBool(key string, defaultValue bool) bool {
	if value := os.Getenv(key); value != "" {
		return value == "true" || value == "1" || value == "yes"
	}
	return defaultValue
}
