//go:build ignore
// +build ignore

// Certificate Generator Script
// This script generates self-signed TLS certificates for DSP Platform
// Run with: go run scripts/gen-cert.go

package main

import (
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/pem"
	"fmt"
	"math/big"
	"net"
	"os"
	"time"
)

func main() {
	certDir := "./certs"

	fmt.Println("🔐 DSP Platform Certificate Generator")
	fmt.Println("=====================================")

	// Create directory
	if err := os.MkdirAll(certDir, 0755); err != nil {
		fmt.Printf("❌ Failed to create directory: %v\n", err)
		os.Exit(1)
	}

	// Generate CA
	fmt.Println("\n📜 Generating CA Certificate...")
	caPrivKey, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		fmt.Printf("❌ Failed to generate CA key: %v\n", err)
		os.Exit(1)
	}

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
		NotAfter:              time.Now().AddDate(10, 0, 0),
		KeyUsage:              x509.KeyUsageCertSign | x509.KeyUsageCRLSign,
		IsCA:                  true,
		BasicConstraintsValid: true,
	}

	caCertDER, err := x509.CreateCertificate(rand.Reader, &caTemplate, &caTemplate, &caPrivKey.PublicKey, caPrivKey)
	if err != nil {
		fmt.Printf("❌ Failed to create CA cert: %v\n", err)
		os.Exit(1)
	}

	// Save CA cert
	if err := saveCert(certDir+"/ca.crt", caCertDER); err != nil {
		fmt.Printf("❌ %v\n", err)
		os.Exit(1)
	}
	fmt.Println("   ✅ CA Certificate: certs/ca.crt")

	// Save CA key
	if err := saveKey(certDir+"/ca.key", caPrivKey); err != nil {
		fmt.Printf("❌ %v\n", err)
		os.Exit(1)
	}
	fmt.Println("   ✅ CA Private Key: certs/ca.key")

	// Generate Server Certificate
	fmt.Println("\n📜 Generating Server Certificate...")
	serverPrivKey, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		fmt.Printf("❌ Failed to generate server key: %v\n", err)
		os.Exit(1)
	}

	serverTemplate := x509.Certificate{
		SerialNumber: big.NewInt(2),
		Subject: pkix.Name{
			Organization: []string{"DSP Platform"},
			Country:      []string{"ID"},
			CommonName:   "DSP Platform Server",
		},
		NotBefore:             time.Now(),
		NotAfter:              time.Now().AddDate(1, 0, 0),
		KeyUsage:              x509.KeyUsageKeyEncipherment | x509.KeyUsageDigitalSignature,
		ExtKeyUsage:           []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth},
		BasicConstraintsValid: true,
		DNSNames:              []string{"localhost"},
		IPAddresses:           []net.IP{net.ParseIP("127.0.0.1")},
	}

	caCert, _ := x509.ParseCertificate(caCertDER)
	serverCertDER, err := x509.CreateCertificate(rand.Reader, &serverTemplate, caCert, &serverPrivKey.PublicKey, caPrivKey)
	if err != nil {
		fmt.Printf("❌ Failed to create server cert: %v\n", err)
		os.Exit(1)
	}

	// Save Server cert
	if err := saveCert(certDir+"/server.crt", serverCertDER); err != nil {
		fmt.Printf("❌ %v\n", err)
		os.Exit(1)
	}
	fmt.Println("   ✅ Server Certificate: certs/server.crt")

	// Save Server key
	if err := saveKey(certDir+"/server.key", serverPrivKey); err != nil {
		fmt.Printf("❌ %v\n", err)
		os.Exit(1)
	}
	fmt.Println("   ✅ Server Private Key: certs/server.key")

	fmt.Println("\n=====================================")
	fmt.Println("✅ Certificate generation complete!")
	fmt.Println("\n📋 Next steps:")
	fmt.Println("   1. Start Master with: TLS_ENABLED=true")
	fmt.Println("   2. Copy ca.crt to Agent machines")
	fmt.Println("   3. Start Agent with: TLS_ENABLED=true TLS_CA_PATH=./certs/ca.crt")
}

func saveCert(path string, certDER []byte) error {
	f, err := os.Create(path)
	if err != nil {
		return fmt.Errorf("failed to create %s: %v", path, err)
	}
	defer f.Close()
	return pem.Encode(f, &pem.Block{Type: "CERTIFICATE", Bytes: certDER})
}

func saveKey(path string, key *ecdsa.PrivateKey) error {
	f, err := os.Create(path)
	if err != nil {
		return fmt.Errorf("failed to create %s: %v", path, err)
	}
	defer f.Close()
	keyBytes, _ := x509.MarshalECPrivateKey(key)
	return pem.Encode(f, &pem.Block{Type: "EC PRIVATE KEY", Bytes: keyBytes})
}
