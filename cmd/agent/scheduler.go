package main

import (
	"fmt"
	"strings"
	"time"
)

// Simple cron scheduler
// Supports basic cron format: "minute hour day month weekday"
// Examples:
//   "0 0 * * *"  = midnight daily
//   "*/5 * * * *" = every 5 minutes
//   "30 * * * *" = every hour at 30 minutes
//   "0 */2 * * *" = every 2 hours

func calculateNextRun(schedule string) time.Time {
	parts := strings.Split(strings.TrimSpace(schedule), " ")

	if len(parts) != 5 {
		// Invalid format, default to 30 seconds
		return time.Now().Add(30 * time.Second)
	}

	minute := parts[0]
	hour := parts[1]

	// Handle */N format (every N minutes/hours)
	if strings.HasPrefix(minute, "*/") {
		interval := parseInterval(minute)
		return time.Now().Add(time.Duration(interval) * time.Minute)
	}

	if strings.HasPrefix(hour, "*/") {
		interval := parseInterval(hour)
		return time.Now().Add(time.Duration(interval) * time.Hour)
	}

	// Handle specific time (e.g., "0 0 * * *" = midnight)
	if minute != "*" && hour != "*" {
		return nextScheduledTime(parseNum(hour), parseNum(minute))
	}

	// Handle every minute
	if minute == "*" && hour == "*" {
		return time.Now().Add(1 * time.Minute)
	}

	// Handle every hour (e.g., "30 * * * *")
	if minute != "*" && hour == "*" {
		return nextHourlyTime(parseNum(minute))
	}

	// Default: 30 seconds
	return time.Now().Add(30 * time.Second)
}

func parseInterval(s string) int {
	// Parse "*/5" → 5
	parts := strings.Split(s, "/")
	if len(parts) == 2 {
		var n int
		fmt.Sscanf(parts[1], "%d", &n)
		if n > 0 {
			return n
		}
	}
	return 30 // default
}

func parseNum(s string) int {
	var n int
	fmt.Sscanf(s, "%d", &n)
	return n
}

func nextScheduledTime(hour, minute int) time.Time {
	now := time.Now()
	next := time.Date(now.Year(), now.Month(), now.Day(), hour, minute, 0, 0, now.Location())

	// If time has passed today, schedule for tomorrow
	if next.Before(now) || next.Equal(now) {
		next = next.Add(24 * time.Hour)
	}

	return next
}

func nextHourlyTime(minute int) time.Time {
	now := time.Now()
	next := time.Date(now.Year(), now.Month(), now.Day(), now.Hour(), minute, 0, 0, now.Location())

	// If time has passed this hour, schedule for next hour
	if next.Before(now) || next.Equal(now) {
		next = next.Add(1 * time.Hour)
	}

	return next
}
