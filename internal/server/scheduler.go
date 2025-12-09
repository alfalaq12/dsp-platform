package server

import (
	"dsp-platform/internal/core"
	"log"
	"time"

	"gorm.io/gorm"
)

// Scheduler manages automatic job execution
type Scheduler struct {
	db            *gorm.DB
	agentListener *AgentListener
	stopChan      chan struct{}
}

// NewScheduler creates a new scheduler instance
func NewScheduler(db *gorm.DB, listener *AgentListener) *Scheduler {
	return &Scheduler{
		db:            db,
		agentListener: listener,
		stopChan:      make(chan struct{}),
	}
}

// Start begins the scheduler loop
func (s *Scheduler) Start() {
	log.Println("Scheduler started")
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

// shouldRun determines if a job should run based on its schedule
func (s *Scheduler) shouldRun(job core.Job, now time.Time) bool {
	// Skip if job is disabled (paused)
	if !job.Enabled {
		return false
	}

	if job.Schedule == "" || job.Schedule == "manual" {
		return false
	}

	// Skip if job is currently running
	if job.Status == "running" {
		return false
	}

	interval := s.parseSchedule(job.Schedule)
	if interval == 0 {
		return false
	}

	// Check if enough time has passed since last run
	if job.LastRun.IsZero() {
		return true // Never run before
	}

	return now.Sub(job.LastRun) >= interval
}

// parseSchedule converts schedule string to duration
func (s *Scheduler) parseSchedule(schedule string) time.Duration {
	switch schedule {
	case "1min":
		return 1 * time.Minute
	case "5min":
		return 5 * time.Minute
	case "10min":
		return 10 * time.Minute
	case "15min":
		return 15 * time.Minute
	case "30min":
		return 30 * time.Minute
	case "1hour":
		return 1 * time.Hour
	case "3hour":
		return 3 * time.Hour
	case "6hour":
		return 6 * time.Hour
	case "12hour":
		return 12 * time.Hour
	case "daily":
		return 24 * time.Hour
	case "weekly":
		return 7 * 24 * time.Hour
	default:
		return 0
	}
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
