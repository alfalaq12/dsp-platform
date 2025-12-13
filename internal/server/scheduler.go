package server

import (
	"dsp-platform/internal/core"
	"log"
	"strings"
	"time"

	"github.com/robfig/cron/v3"
	"gorm.io/gorm"
)

// Scheduler manages automatic job execution using cron expressions
type Scheduler struct {
	db            *gorm.DB
	agentListener *AgentListener
	stopChan      chan struct{}
	cronParser    cron.Parser
}

// NewScheduler creates a new scheduler instance
func NewScheduler(db *gorm.DB, listener *AgentListener) *Scheduler {
	// Create parser that supports standard 5-field cron expressions
	// minute hour day-of-month month day-of-week
	parser := cron.NewParser(cron.Minute | cron.Hour | cron.Dom | cron.Month | cron.Dow)

	return &Scheduler{
		db:            db,
		agentListener: listener,
		stopChan:      make(chan struct{}),
		cronParser:    parser,
	}
}

// Start begins the scheduler loop
func (s *Scheduler) Start() {
	log.Println("Scheduler started (cron expression mode)")
	ticker := time.NewTicker(1 * time.Minute)
	defer ticker.Stop()

	// Run immediately on start
	s.checkAndRunJobs()

	for {
		select {
		case <-ticker.C:
			s.checkAndRunJobs()
		case <-s.stopChan:
			log.Println("Scheduler stopped")
			return
		}
	}
}

// Stop halts the scheduler
func (s *Scheduler) Stop() {
	close(s.stopChan)
}

// checkAndRunJobs checks all jobs and runs those that are due
func (s *Scheduler) checkAndRunJobs() {
	var jobs []core.Job
	if err := s.db.Preload("Schema").Preload("Network").Find(&jobs).Error; err != nil {
		log.Printf("Scheduler: Failed to fetch jobs: %v", err)
		return
	}

	now := time.Now()
	for _, job := range jobs {
		if s.shouldRun(job, now) {
			log.Printf("Scheduler: Running job %s (ID: %d)", job.Name, job.ID)
			go s.runJob(job)
		}
	}
}

// shouldRun determines if a job should run based on its cron expression
func (s *Scheduler) shouldRun(job core.Job, now time.Time) bool {
	// Skip if job is disabled (paused)
	if !job.Enabled {
		return false
	}

	// Skip if no schedule or manual
	schedule := strings.TrimSpace(job.Schedule)
	if schedule == "" || schedule == "manual" {
		return false
	}

	// Skip if job is currently running
	if job.Status == "running" {
		return false
	}

	// Parse cron expression
	cronSchedule, err := s.cronParser.Parse(schedule)
	if err != nil {
		log.Printf("Scheduler: Invalid cron expression for job %s: %s (error: %v)", job.Name, schedule, err)
		return false
	}

	// If never run before, check if current minute matches the cron schedule
	if job.LastRun.IsZero() {
		// Get the next scheduled time from a minute ago
		nextRun := cronSchedule.Next(now.Add(-1 * time.Minute))
		// Check if next run is within current minute
		return nextRun.Year() == now.Year() &&
			nextRun.Month() == now.Month() &&
			nextRun.Day() == now.Day() &&
			nextRun.Hour() == now.Hour() &&
			nextRun.Minute() == now.Minute()
	}

	// Get next scheduled run time after the last run
	nextRun := cronSchedule.Next(job.LastRun)

	// Check if the next run time has passed or is within the current minute
	return now.After(nextRun) || now.Equal(nextRun) ||
		(nextRun.Year() == now.Year() &&
			nextRun.Month() == now.Month() &&
			nextRun.Day() == now.Day() &&
			nextRun.Hour() == now.Hour() &&
			nextRun.Minute() == now.Minute())
}

// GetNextRunTime returns the next scheduled run time for a job
func (s *Scheduler) GetNextRunTime(job core.Job) (time.Time, error) {
	schedule := strings.TrimSpace(job.Schedule)
	if schedule == "" || schedule == "manual" {
		return time.Time{}, nil
	}

	cronSchedule, err := s.cronParser.Parse(schedule)
	if err != nil {
		return time.Time{}, err
	}

	var baseTime time.Time
	if job.LastRun.IsZero() {
		baseTime = time.Now()
	} else {
		baseTime = job.LastRun
	}

	return cronSchedule.Next(baseTime), nil
}

// runJob executes a job via the agent
func (s *Scheduler) runJob(job core.Job) {
	// Update status to running
	s.db.Model(&job).Updates(map[string]interface{}{
		"status":   "running",
		"last_run": time.Now(),
	})

	// Create job log
	jobLog := core.JobLog{
		JobID:     job.ID,
		Status:    "running",
		StartedAt: time.Now(),
	}
	s.db.Create(&jobLog)

	// Send command to agent
	command := core.AgentMessage{
		Type:      "RUN_JOB",
		Timestamp: time.Now(),
		Data: map[string]interface{}{
			"job_id":     job.ID,
			"job_log_id": jobLog.ID,
			"schema": map[string]interface{}{
				"id":           job.Schema.ID,
				"name":         job.Schema.Name,
				"sql_command":  job.Schema.SQLCommand,
				"target_table": job.Schema.TargetTable,
			},
		},
	}

	err := s.agentListener.SendCommandToAgent(job.Network.Name, command)
	if err != nil {
		log.Printf("Scheduler: Failed to send job to agent: %v", err)
		// Update job and log as failed
		s.db.Model(&job).Update("status", "failed")
		s.db.Model(&jobLog).Updates(map[string]interface{}{
			"status":       "failed",
			"completed_at": time.Now(),
			"error":        err.Error(),
		})
	}
}

// MigratePresetToCron converts old preset schedules to cron expressions
func MigratePresetToCron(schedule string) string {
	presetMap := map[string]string{
		"1min":   "*/1 * * * *",
		"5min":   "*/5 * * * *",
		"10min":  "*/10 * * * *",
		"15min":  "*/15 * * * *",
		"30min":  "*/30 * * * *",
		"1hour":  "0 * * * *",
		"3hour":  "0 */3 * * *",
		"6hour":  "0 */6 * * *",
		"12hour": "0 */12 * * *",
		"daily":  "0 0 * * *",
		"weekly": "0 0 * * 0",
	}

	if cronExpr, exists := presetMap[schedule]; exists {
		return cronExpr
	}

	// Already a cron expression or manual
	return schedule
}
