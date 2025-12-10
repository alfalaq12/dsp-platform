package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
)

func main() {
	baseURL := "http://localhost:441/api/login" // Port 441 from server logs

	tests := []struct {
		name     string
		username string
		password string
		wantCode int
	}{
		{"Correct Credentials", "admin", "admin", 200},
		{"Wrong Password", "admin", "wrong", 401},
	}

	for _, tt := range tests {
		fmt.Printf("Testing %s... ", tt.name)
		payload := map[string]string{"username": tt.username, "password": tt.password}
		data, _ := json.Marshal(payload)

		resp, err := http.Post(baseURL, "application/json", bytes.NewBuffer(data))
		if err != nil {
			fmt.Printf("FAILED: %v\n", err)
			os.Exit(1)
		}
		defer resp.Body.Close()

		if resp.StatusCode != tt.wantCode {
			fmt.Printf("FAILED: Got %d, want %d\n", resp.StatusCode, tt.wantCode)
			body, _ := io.ReadAll(resp.Body)
			fmt.Printf("Body: %s\n", string(body))
			os.Exit(1)
		}
		fmt.Println("PASSED")
	}
}
