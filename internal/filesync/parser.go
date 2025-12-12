package filesync

import (
	"bytes"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"io"
	"strconv"
	"strings"

	"github.com/xuri/excelize/v2"
)

// ParseCSV parses CSV data into a slice of maps
func ParseCSV(data []byte, hasHeader bool, delimiter rune) ([]map[string]interface{}, error) {
	reader := csv.NewReader(bytes.NewReader(data))
	reader.Comma = delimiter
	reader.LazyQuotes = true
	reader.TrimLeadingSpace = true

	var records []map[string]interface{}
	var headers []string

	lineNum := 0
	for {
		record, err := reader.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, fmt.Errorf("error reading CSV line %d: %w", lineNum+1, err)
		}

		if lineNum == 0 && hasHeader {
			// First line is header
			headers = make([]string, len(record))
			for i, h := range record {
				headers[i] = strings.TrimSpace(h)
			}
			lineNum++
			continue
		}

		// If no header, generate column names
		if headers == nil {
			headers = make([]string, len(record))
			for i := range record {
				headers[i] = fmt.Sprintf("column_%d", i+1)
			}
		}

		// Create record map
		row := make(map[string]interface{})
		for i, value := range record {
			if i < len(headers) {
				row[headers[i]] = inferType(strings.TrimSpace(value))
			}
		}
		records = append(records, row)
		lineNum++
	}

	return records, nil
}

// ParseExcel parses Excel (.xlsx) data into a slice of maps
func ParseExcel(data []byte, hasHeader bool) ([]map[string]interface{}, error) {
	f, err := excelize.OpenReader(bytes.NewReader(data))
	if err != nil {
		return nil, fmt.Errorf("failed to open Excel file: %w", err)
	}
	defer f.Close()

	// Get the first sheet
	sheets := f.GetSheetList()
	if len(sheets) == 0 {
		return nil, fmt.Errorf("no sheets found in Excel file")
	}

	rows, err := f.GetRows(sheets[0])
	if err != nil {
		return nil, fmt.Errorf("failed to read rows: %w", err)
	}

	if len(rows) == 0 {
		return nil, nil
	}

	var records []map[string]interface{}
	var headers []string

	for i, row := range rows {
		if i == 0 && hasHeader {
			headers = make([]string, len(row))
			for j, h := range row {
				headers[j] = strings.TrimSpace(h)
			}
			continue
		}

		// If no header, generate column names
		if headers == nil {
			maxCols := 0
			for _, r := range rows {
				if len(r) > maxCols {
					maxCols = len(r)
				}
			}
			headers = make([]string, maxCols)
			for j := range headers {
				headers[j] = fmt.Sprintf("column_%d", j+1)
			}
		}

		// Create record map
		record := make(map[string]interface{})
		for j, value := range row {
			if j < len(headers) {
				record[headers[j]] = inferType(strings.TrimSpace(value))
			}
		}
		records = append(records, record)
	}

	return records, nil
}

// ParseJSON parses JSON data into a slice of maps
// Supports both array of objects and single object
func ParseJSON(data []byte) ([]map[string]interface{}, error) {
	// Try to parse as array first
	var records []map[string]interface{}
	if err := json.Unmarshal(data, &records); err == nil {
		return records, nil
	}

	// Try to parse as single object
	var single map[string]interface{}
	if err := json.Unmarshal(data, &single); err == nil {
		return []map[string]interface{}{single}, nil
	}

	// Try to parse as object with data array (common API response format)
	var wrapper struct {
		Data []map[string]interface{} `json:"data"`
	}
	if err := json.Unmarshal(data, &wrapper); err == nil && len(wrapper.Data) > 0 {
		return wrapper.Data, nil
	}

	return nil, fmt.Errorf("failed to parse JSON: unsupported format")
}

// inferType tries to convert string to appropriate Go type
func inferType(value string) interface{} {
	if value == "" {
		return nil
	}

	// Try integer
	if i, err := strconv.ParseInt(value, 10, 64); err == nil {
		return i
	}

	// Try float
	if f, err := strconv.ParseFloat(value, 64); err == nil {
		return f
	}

	// Try boolean
	if strings.EqualFold(value, "true") {
		return true
	}
	if strings.EqualFold(value, "false") {
		return false
	}

	// Return as string
	return value
}

// ParseFile parses file data based on format
func ParseFile(data []byte, format string, hasHeader bool, delimiter string) ([]map[string]interface{}, error) {
	switch strings.ToLower(format) {
	case "csv":
		delim := ','
		if len(delimiter) > 0 {
			delim = rune(delimiter[0])
		}
		return ParseCSV(data, hasHeader, delim)
	case "txt", "text":
		// TXT files: try to parse as delimited, otherwise line-by-line
		delim := ','
		if len(delimiter) > 0 {
			delim = rune(delimiter[0])
		}
		// Try parsing as delimited first
		records, err := ParseCSV(data, hasHeader, delim)
		if err != nil || len(records) == 0 {
			// Fallback to line-by-line parsing
			return ParseTextLines(data)
		}
		return records, nil
	case "xlsx", "excel":
		return ParseExcel(data, hasHeader)
	case "json":
		return ParseJSON(data)
	default:
		return nil, fmt.Errorf("unsupported file format: %s", format)
	}
}

// ParseTextLines parses plain text file line by line
func ParseTextLines(data []byte) ([]map[string]interface{}, error) {
	lines := strings.Split(string(data), "\n")
	var records []map[string]interface{}

	for i, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue // Skip empty lines
		}
		record := map[string]interface{}{
			"line_number": i + 1,
			"content":     line,
		}
		records = append(records, record)
	}

	return records, nil
}
