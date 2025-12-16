//go:build ignore
// +build ignore

package main

import (
	"fmt"

	sqlite "github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func main() {
	db, err := gorm.Open(sqlite.Open("dsp.db"), &gorm.Config{})
	if err != nil {
		fmt.Println("Error opening database:", err)
		return
	}

	result := db.Exec("DELETE FROM licenses")
	if result.Error != nil {
		fmt.Println("Error deleting license:", result.Error)
		return
	}

	fmt.Println("✅ License deleted! You can test activation flow again.")
	fmt.Println("   Restart the master server and login to see limited menu.")
}
