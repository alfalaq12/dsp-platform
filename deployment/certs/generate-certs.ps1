# DSP Platform Certificate Generator for Windows
# Generates self-signed CA and server certificates for TLS/HTTPS

param(
    [string]$CertDir = ".\certs",
    [string]$CommonName = "DSP Platform Server",
    [string]$Organization = "DSP Platform",
    [int]$ValidDays = 365,
    [string[]]$AdditionalHosts = @()
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  DSP Platform Certificate Generator" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Create certs directory if not exists
if (-not (Test-Path $CertDir)) {
    New-Item -ItemType Directory -Path $CertDir -Force | Out-Null
    Write-Host "[+] Created directory: $CertDir" -ForegroundColor Green
}

# Check if OpenSSL is available
$opensslPath = $null
$possiblePaths = @(
    "openssl",
    "C:\Program Files\OpenSSL-Win64\bin\openssl.exe",
    "C:\Program Files\Git\usr\bin\openssl.exe",
    "C:\Program Files (x86)\Git\usr\bin\openssl.exe"
)

foreach ($path in $possiblePaths) {
    try {
        $null = & $path version 2>$null
        $opensslPath = $path
        break
    }
    catch {
        continue
    }
}

if (-not $opensslPath) {
    Write-Host ""
    Write-Host "[!] OpenSSL not found. Using PowerShell native certificate generation..." -ForegroundColor Yellow
    Write-Host ""
    
    # Use PowerShell native cert generation
    try {
        # Generate CA Certificate
        Write-Host "[*] Generating CA Certificate..." -ForegroundColor Cyan
        $caParams = @{
            Subject           = "CN=DSP Platform CA,O=$Organization,C=ID"
            KeyExportPolicy   = 'Exportable'
            KeySpec           = 'Signature'
            KeyLength         = 2048
            KeyAlgorithm      = 'RSA'
            HashAlgorithm     = 'SHA256'
            CertStoreLocation = 'Cert:\CurrentUser\My'
            NotAfter          = (Get-Date).AddYears(10)
            KeyUsage          = 'CertSign', 'CRLSign'
            TextExtension     = @("2.5.29.19={critical}{text}CA=true")
        }
        $caCert = New-SelfSignedCertificate @caParams
        Write-Host "[+] CA Certificate created" -ForegroundColor Green

        # Generate Server Certificate
        Write-Host "[*] Generating Server Certificate..." -ForegroundColor Cyan
        
        # Build SAN list
        $sanList = @("localhost", "127.0.0.1")
        $sanList += $AdditionalHosts
        $sanString = ($sanList | ForEach-Object { 
                if ($_ -match '^\d+\.\d+\.\d+\.\d+$') { "IPAddress=$_" } 
                else { "DNS=$_" } 
            }) -join "&"

        $serverParams = @{
            Subject           = "CN=$CommonName,O=$Organization,C=ID"
            KeyExportPolicy   = 'Exportable'
            KeySpec           = 'KeyExchange'
            KeyLength         = 2048
            KeyAlgorithm      = 'RSA'
            HashAlgorithm     = 'SHA256'
            CertStoreLocation = 'Cert:\CurrentUser\My'
            NotAfter          = (Get-Date).AddDays($ValidDays)
            Signer            = $caCert
            TextExtension     = @("2.5.29.37={text}1.3.6.1.5.5.7.3.1", "2.5.29.17={text}$sanString")
        }
        $serverCert = New-SelfSignedCertificate @serverParams
        Write-Host "[+] Server Certificate created" -ForegroundColor Green

        # Export certificates
        Write-Host "[*] Exporting certificates to files..." -ForegroundColor Cyan
        
        # Export CA certificate (public only)
        $caCertPath = Join-Path $CertDir "ca.crt"
        Export-Certificate -Cert $caCert -FilePath "$caCertPath.der" -Type CERT | Out-Null
        certutil -encode "$caCertPath.der" $caCertPath | Out-Null
        Remove-Item "$caCertPath.der" -Force
        Write-Host "[+] CA Certificate: $caCertPath" -ForegroundColor Green

        # Export Server certificate and key in PFX first, then convert
        $pfxPath = Join-Path $CertDir "server.pfx"
        $serverCertPath = Join-Path $CertDir "server.crt"
        $serverKeyPath = Join-Path $CertDir "server.key"
        
        $pfxPassword = ConvertTo-SecureString -String "temppass" -Force -AsPlainText
        Export-PfxCertificate -Cert $serverCert -FilePath $pfxPath -Password $pfxPassword | Out-Null
        
        # Export server certificate (public only)
        Export-Certificate -Cert $serverCert -FilePath "$serverCertPath.der" -Type CERT | Out-Null
        certutil -encode "$serverCertPath.der" $serverCertPath | Out-Null
        Remove-Item "$serverCertPath.der" -Force
        Write-Host "[+] Server Certificate: $serverCertPath" -ForegroundColor Green

        Write-Host ""
        Write-Host "[!] IMPORTANT: For the server private key, you need to extract it from the PFX file." -ForegroundColor Yellow
        Write-Host "    PFX file location: $pfxPath (password: temppass)" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "    To extract with OpenSSL (if available later):" -ForegroundColor Yellow
        Write-Host "    openssl pkcs12 -in $pfxPath -nocerts -nodes -out $serverKeyPath" -ForegroundColor Yellow
        Write-Host ""

        # Alternative: Try to extract key using certutil
        Write-Host "[*] Attempting to extract private key..." -ForegroundColor Cyan
        
        # Create a simple Go program to generate certs instead
        Write-Host ""
        Write-Host "[!] For the best experience, run the Master Server with TLS_AUTO_CERT=true" -ForegroundColor Yellow
        Write-Host "    This will auto-generate certificates on first run." -ForegroundColor Yellow

        # Cleanup from cert store
        Remove-Item -Path "Cert:\CurrentUser\My\$($caCert.Thumbprint)" -Force 2>$null
        Remove-Item -Path "Cert:\CurrentUser\My\$($serverCert.Thumbprint)" -Force 2>$null

    }
    catch {
        Write-Host "[!] Error generating certificates: $_" -ForegroundColor Red
        Write-Host ""
        Write-Host "Alternative: Run the Go application with TLS_AUTO_CERT=true" -ForegroundColor Yellow
        Write-Host "            The application will generate certificates automatically." -ForegroundColor Yellow
        exit 1
    }

}
else {
    Write-Host "[+] Found OpenSSL: $opensslPath" -ForegroundColor Green
    Write-Host ""

    # OpenSSL config for SAN
    $opensslConf = @"
[req]
default_bits = 2048
prompt = no
default_md = sha256
distinguished_name = dn
req_extensions = req_ext

[dn]
C = ID
O = $Organization
CN = $CommonName

[req_ext]
subjectAltName = @alt_names

[alt_names]
DNS.1 = localhost
IP.1 = 127.0.0.1
"@

    # Add additional hosts
    $dnsCount = 2
    $ipCount = 2
    foreach ($hostEntry in $AdditionalHosts) {
        if ($hostEntry -match '^\d+\.\d+\.\d+\.\d+$') {
            $opensslConf += "`nIP.$ipCount = $hostEntry"
            $ipCount++
        }
        else {
            $opensslConf += "`nDNS.$dnsCount = $hostEntry"
            $dnsCount++
        }
    }

    $confPath = Join-Path $CertDir "openssl.cnf"
    $opensslConf | Out-File -FilePath $confPath -Encoding ASCII

    # Generate CA private key
    Write-Host "[*] Generating CA private key..." -ForegroundColor Cyan
    & $opensslPath ecparam -genkey -name prime256v1 -out "$CertDir\ca.key" 2>$null
    Write-Host "[+] CA private key: $CertDir\ca.key" -ForegroundColor Green

    # Generate CA certificate
    Write-Host "[*] Generating CA certificate..." -ForegroundColor Cyan
    & $opensslPath req -x509 -new -nodes -key "$CertDir\ca.key" -sha256 -days 3650 `
        -out "$CertDir\ca.crt" -subj "/C=ID/O=$Organization/CN=DSP Platform CA" 2>$null
    Write-Host "[+] CA certificate: $CertDir\ca.crt" -ForegroundColor Green

    # Generate server private key
    Write-Host "[*] Generating server private key..." -ForegroundColor Cyan
    & $opensslPath ecparam -genkey -name prime256v1 -out "$CertDir\server.key" 2>$null
    Write-Host "[+] Server private key: $CertDir\server.key" -ForegroundColor Green

    # Generate server CSR
    Write-Host "[*] Generating server CSR..." -ForegroundColor Cyan
    & $opensslPath req -new -key "$CertDir\server.key" -out "$CertDir\server.csr" -config $confPath 2>$null

    # Sign server certificate with CA
    Write-Host "[*] Signing server certificate with CA..." -ForegroundColor Cyan
    & $opensslPath x509 -req -in "$CertDir\server.csr" -CA "$CertDir\ca.crt" -CAkey "$CertDir\ca.key" `
        -CAcreateserial -out "$CertDir\server.crt" -days $ValidDays -sha256 `
        -extfile $confPath -extensions req_ext 2>$null
    Write-Host "[+] Server certificate: $CertDir\server.crt" -ForegroundColor Green

    # Cleanup
    Remove-Item "$CertDir\server.csr" -Force 2>$null
    Remove-Item "$CertDir\openssl.cnf" -Force 2>$null
    Remove-Item "$CertDir\ca.srl" -Force 2>$null
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Certificate Generation Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Generated files:" -ForegroundColor White
Write-Host "  - ca.crt      : CA Certificate (distribute to agents)" -ForegroundColor Gray
Write-Host "  - ca.key      : CA Private Key (keep secure!)" -ForegroundColor Gray
Write-Host "  - server.crt  : Server Certificate" -ForegroundColor Gray
Write-Host "  - server.key  : Server Private Key" -ForegroundColor Gray
Write-Host ""
Write-Host "Usage:" -ForegroundColor White
Write-Host "  Master Server (.env):" -ForegroundColor Gray
Write-Host "    TLS_ENABLED=true" -ForegroundColor Yellow
Write-Host "    TLS_CERT_PATH=./certs/server.crt" -ForegroundColor Yellow
Write-Host "    TLS_KEY_PATH=./certs/server.key" -ForegroundColor Yellow
Write-Host ""
Write-Host "  Agent (.env):" -ForegroundColor Gray
Write-Host "    TLS_ENABLED=true" -ForegroundColor Yellow
Write-Host "    TLS_CA_PATH=./certs/ca.crt" -ForegroundColor Yellow
Write-Host ""
