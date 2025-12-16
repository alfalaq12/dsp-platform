//go:build ignore
// +build ignore

package main

import (
	"bufio"
	"fmt"
	"os"
	"strconv"
	"strings"

	"dsp-platform/internal/license"
)

// License Generator Tool
// Run with: go run scripts/license-gen.go
// This tool is for the vendor (you) to generate activation codes for customers

func main() {
	reader := bufio.NewReader(os.Stdin)

	fmt.Println("╔══════════════════════════════════════════════╗")
	fmt.Println("║     DSP Platform - License Generator Tool    ║")
	fmt.Println("╚══════════════════════════════════════════════╝")
	fmt.Println()

	for {
		fmt.Println("Options:")
		fmt.Println("  1. Generate activation code for Machine ID")
		fmt.Println("  2. Generate Machine ID for this computer")
		fmt.Println("  3. Validate an activation code")
		fmt.Println("  4. Exit")
		fmt.Print("\nSelect option: ")

		input, _ := reader.ReadString('\n')
		input = strings.TrimSpace(input)

		switch input {
		case "1":
			generateCode(reader)
		case "2":
			showMachineID()
		case "3":
			validateCode(reader)
		case "4":
			fmt.Println("Goodbye!")
			os.Exit(0)
		default:
			fmt.Println("Invalid option")
		}
		fmt.Println()
	}
}

func generateCode(reader *bufio.Reader) {
	fmt.Print("Enter Machine ID (e.g., DSP-ABCD1234-EFGH5678): ")
	machineID, _ := reader.ReadString('\n')
	machineID = strings.TrimSpace(machineID)

	if machineID == "" {
		fmt.Println("Error: Machine ID is required")
		return
	}

	fmt.Print("Enter validity period in days (default: 365): ")
	daysStr, _ := reader.ReadString('\n')
	daysStr = strings.TrimSpace(daysStr)

	days := 365
	if daysStr != "" {
		if d, err := strconv.Atoi(daysStr); err == nil && d > 0 {
			days = d
		}
	}

	code := license.GenerateActivationCode(machineID, days)

	fmt.Println()
	fmt.Println("════════════════════════════════════════════════")
	fmt.Println("✅ ACTIVATION CODE GENERATED")
	fmt.Println("════════════════════════════════════════════════")
	fmt.Printf("Machine ID    : %s\n", machineID)
	fmt.Printf("Valid for     : %d days\n", days)
	fmt.Println("────────────────────────────────────────────────")
	fmt.Println("ACTIVATION CODE:")
	fmt.Println()
	fmt.Printf("  %s\n", code)
	fmt.Println()
	fmt.Println("════════════════════════════════════════════════")
}

func showMachineID() {
	machineID, err := license.GenerateMachineID()
	if err != nil {
		fmt.Printf("Error: %v\n", err)
		return
	}

	fmt.Println()
	fmt.Println("════════════════════════════════════════════════")
	fmt.Println("🖥️  THIS COMPUTER'S MACHINE ID")
	fmt.Println("════════════════════════════════════════════════")
	fmt.Println()
	fmt.Printf("  %s\n", machineID)
	fmt.Println()
	fmt.Println("════════════════════════════════════════════════")
}

func validateCode(reader *bufio.Reader) {
	fmt.Print("Enter Machine ID: ")
	machineID, _ := reader.ReadString('\n')
	machineID = strings.TrimSpace(machineID)

	fmt.Print("Enter Activation Code: ")
	code, _ := reader.ReadString('\n')
	code = strings.TrimSpace(code)

	valid, expiryDate, err := license.ValidateActivationCode(machineID, code)

	fmt.Println()
	fmt.Println("════════════════════════════════════════════════")
	if valid {
		fmt.Println("✅ ACTIVATION CODE IS VALID")
		fmt.Println("════════════════════════════════════════════════")
		fmt.Printf("Expires on    : %s\n", expiryDate.Format("2006-01-02"))
		fmt.Printf("Days remaining: %d\n", license.DaysUntilExpiry(expiryDate))
	} else {
		fmt.Println("❌ ACTIVATION CODE IS INVALID")
		fmt.Println("════════════════════════════════════════════════")
		fmt.Printf("Error: %v\n", err)
	}
	fmt.Println("════════════════════════════════════════════════")
}
