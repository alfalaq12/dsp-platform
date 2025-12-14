#!/bin/bash
# DSP Platform Certificate Generator for Linux
# Generates self-signed CA and server certificates for TLS/HTTPS

set -e

CERT_DIR="${1:-./certs}"
COMMON_NAME="${2:-DSP Platform Server}"
ORGANIZATION="${3:-DSP Platform}"
VALID_DAYS="${4:-365}"

echo "========================================"
echo "  DSP Platform Certificate Generator"
echo "========================================"
echo ""

# Create certs directory
mkdir -p "$CERT_DIR"
echo "[+] Certificate directory: $CERT_DIR"

# Check for OpenSSL
if ! command -v openssl &> /dev/null; then
    echo "[!] OpenSSL is required but not installed."
    echo "    Install with: sudo apt-get install openssl"
    exit 1
fi

echo "[+] Found OpenSSL: $(openssl version)"
echo ""

# Create OpenSSL config
cat > "$CERT_DIR/openssl.cnf" << EOF
[req]
default_bits = 2048
prompt = no
default_md = sha256
distinguished_name = dn
req_extensions = req_ext

[dn]
C = ID
O = $ORGANIZATION
CN = $COMMON_NAME

[req_ext]
subjectAltName = @alt_names

[alt_names]
DNS.1 = localhost
IP.1 = 127.0.0.1
EOF

# Add additional hosts from arguments
DNS_COUNT=2
IP_COUNT=2
shift 4 2>/dev/null || true
for host in "$@"; do
    if [[ $host =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
        echo "IP.$IP_COUNT = $host" >> "$CERT_DIR/openssl.cnf"
        ((IP_COUNT++))
    else
        echo "DNS.$DNS_COUNT = $host" >> "$CERT_DIR/openssl.cnf"
        ((DNS_COUNT++))
    fi
done

# Generate CA private key
echo "[*] Generating CA private key..."
openssl ecparam -genkey -name prime256v1 -out "$CERT_DIR/ca.key" 2>/dev/null
chmod 600 "$CERT_DIR/ca.key"
echo "[+] CA private key: $CERT_DIR/ca.key"

# Generate CA certificate
echo "[*] Generating CA certificate..."
openssl req -x509 -new -nodes -key "$CERT_DIR/ca.key" -sha256 -days 3650 \
    -out "$CERT_DIR/ca.crt" -subj "/C=ID/O=$ORGANIZATION/CN=DSP Platform CA" 2>/dev/null
echo "[+] CA certificate: $CERT_DIR/ca.crt"

# Generate server private key
echo "[*] Generating server private key..."
openssl ecparam -genkey -name prime256v1 -out "$CERT_DIR/server.key" 2>/dev/null
chmod 600 "$CERT_DIR/server.key"
echo "[+] Server private key: $CERT_DIR/server.key"

# Generate server CSR
echo "[*] Generating server CSR..."
openssl req -new -key "$CERT_DIR/server.key" -out "$CERT_DIR/server.csr" \
    -config "$CERT_DIR/openssl.cnf" 2>/dev/null

# Sign server certificate with CA
echo "[*] Signing server certificate with CA..."
openssl x509 -req -in "$CERT_DIR/server.csr" -CA "$CERT_DIR/ca.crt" -CAkey "$CERT_DIR/ca.key" \
    -CAcreateserial -out "$CERT_DIR/server.crt" -days "$VALID_DAYS" -sha256 \
    -extfile "$CERT_DIR/openssl.cnf" -extensions req_ext 2>/dev/null
echo "[+] Server certificate: $CERT_DIR/server.crt"

# Cleanup
rm -f "$CERT_DIR/server.csr" "$CERT_DIR/openssl.cnf" "$CERT_DIR/ca.srl"

# Set permissions
chmod 644 "$CERT_DIR/ca.crt" "$CERT_DIR/server.crt"
chmod 600 "$CERT_DIR/ca.key" "$CERT_DIR/server.key"

echo ""
echo "========================================"
echo "  Certificate Generation Complete!"
echo "========================================"
echo ""
echo "Generated files:"
echo "  - ca.crt      : CA Certificate (distribute to agents)"
echo "  - ca.key      : CA Private Key (keep secure!)"
echo "  - server.crt  : Server Certificate"
echo "  - server.key  : Server Private Key"
echo ""
echo "Usage:"
echo "  Master Server (.env):"
echo "    TLS_ENABLED=true"
echo "    TLS_CERT_PATH=./certs/server.crt"
echo "    TLS_KEY_PATH=./certs/server.key"
echo ""
echo "  Agent (.env):"
echo "    TLS_ENABLED=true"
echo "    TLS_CA_PATH=./certs/ca.crt"
echo ""
