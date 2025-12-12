#!/bin/bash
# Script untuk setup dummy data di VPS untuk testing DSP Platform
# Jalankan: chmod +x setup_test_data.sh && ./setup_test_data.sh

# Buat direktori untuk FTP/SFTP data
TEST_DIR="/home/ftpuser/data"
mkdir -p $TEST_DIR
cd $TEST_DIR

echo "📁 Creating test data files..."

# ================================================
# 1. CSV File
# ================================================
cat > employees.csv << 'EOF'
id,name,email,department,salary
1,John Doe,john@company.com,Engineering,75000
2,Jane Smith,jane@company.com,Marketing,65000
3,Bob Wilson,bob@company.com,Sales,70000
4,Alice Brown,alice@company.com,Engineering,80000
5,Charlie Davis,charlie@company.com,HR,55000
EOF
echo "✅ Created employees.csv"

# ================================================
# 2. TXT File (Pipe delimited)
# ================================================
cat > products.txt << 'EOF'
product_id|product_name|category|price|stock
P001|Laptop Pro|Electronics|1299.99|50
P002|Wireless Mouse|Electronics|29.99|200
P003|Office Chair|Furniture|249.99|30
P004|USB Cable|Accessories|9.99|500
P005|Monitor 27"|Electronics|399.99|40
EOF
echo "✅ Created products.txt (pipe delimited)"

# ================================================
# 3. TXT File (Tab delimited)
# ================================================
cat > orders.txt << 'EOF'
order_id	customer_name	product	quantity	total_amount	order_date
ORD001	John Doe	Laptop Pro	1	1299.99	2024-01-15
ORD002	Jane Smith	Wireless Mouse	3	89.97	2024-01-16
ORD003	Bob Wilson	Office Chair	2	499.98	2024-01-17
ORD004	Alice Brown	USB Cable	10	99.90	2024-01-18
ORD005	Charlie Davis	Monitor 27"	1	399.99	2024-01-19
EOF
echo "✅ Created orders.txt (tab delimited)"

# ================================================
# 4. JSON File
# ================================================
cat > users.json << 'EOF'
[
  {"id": 1, "username": "johndoe", "email": "john@test.com", "role": "admin", "active": true},
  {"id": 2, "username": "janesmith", "email": "jane@test.com", "role": "user", "active": true},
  {"id": 3, "username": "bobwilson", "email": "bob@test.com", "role": "user", "active": false},
  {"id": 4, "username": "alicebrown", "email": "alice@test.com", "role": "moderator", "active": true},
  {"id": 5, "username": "charlied", "email": "charlie@test.com", "role": "user", "active": true}
]
EOF
echo "✅ Created users.json"

# ================================================
# 5. JSON File (wrapped format)
# ================================================
cat > transactions.json << 'EOF'
{
  "status": "success",
  "data": [
    {"tx_id": "TX001", "amount": 150.00, "type": "credit", "date": "2024-01-15"},
    {"tx_id": "TX002", "amount": 75.50, "type": "debit", "date": "2024-01-16"},
    {"tx_id": "TX003", "amount": 200.00, "type": "credit", "date": "2024-01-17"},
    {"tx_id": "TX004", "amount": 50.25, "type": "debit", "date": "2024-01-18"},
    {"tx_id": "TX005", "amount": 300.00, "type": "credit", "date": "2024-01-19"}
  ]
}
EOF
echo "✅ Created transactions.json (wrapped format)"

# ================================================
# 6. Excel XLSX File (requires Python + openpyxl)
# ================================================
echo "Creating Excel file..."
python3 << 'PYEOF'
try:
    from openpyxl import Workbook
    wb = Workbook()
    ws = wb.active
    ws.title = "Inventory"
    
    # Header
    ws.append(["item_id", "item_name", "quantity", "unit_price", "warehouse"])
    
    # Data rows
    data = [
        ["INV001", "Keyboard", 100, 25.99, "WH-A"],
        ["INV002", "Monitor", 50, 299.99, "WH-B"],
        ["INV003", "Mouse", 200, 15.99, "WH-A"],
        ["INV004", "Headset", 75, 49.99, "WH-C"],
        ["INV005", "Webcam", 60, 79.99, "WH-B"],
        ["INV006", "USB Hub", 150, 19.99, "WH-A"],
        ["INV007", "Laptop Stand", 40, 45.99, "WH-C"],
    ]
    for row in data:
        ws.append(row)
    
    wb.save("/home/ftpuser/data/inventory.xlsx")
    print("✅ Created inventory.xlsx")
except ImportError:
    print("⚠️  openpyxl not installed. Run: pip3 install openpyxl")
    print("   Skipping XLSX generation...")
except Exception as e:
    print(f"⚠️  Error creating XLSX: {e}")
PYEOF

# Set permissions
chmod 644 $TEST_DIR/*
echo ""
echo "🎉 All test files created in $TEST_DIR"
ls -la $TEST_DIR
