package main

import (
	"runtime"

	"github.com/kardianos/service"
)

// program implements the service.Interface
type program struct{}

// Start is called when the service starts
func (p *program) Start(s service.Service) error {
	// Start should not block. Do the actual work async.
	go p.run()
	return nil
}

// run contains the main agent logic
func (p *program) run() {
	// Run the main agent loop
	runAgent()
}

// Stop is called when the service stops
func (p *program) Stop(s service.Service) error {
	// Cleanup on stop will be handled by OS signal
	return nil
}

// serviceConfig returns the service configuration
func serviceConfig() *service.Config {
	return &service.Config{
		Name:        "DSPAgent",
		DisplayName: "DSP Platform Agent",
		Description: "Data Synchronization Platform Tenant Agent - Syncs data from local database to master server",
	}
}

// runServiceMode handles service install/uninstall/start/stop
func runServiceMode(action string) error {
	svcConfig := serviceConfig()
	prg := &program{}
	s, err := service.New(prg, svcConfig)
	if err != nil {
		return err
	}

	switch action {
	case "install":
		return s.Install()
	case "uninstall":
		return s.Uninstall()
	case "start":
		return s.Start()
	case "stop":
		return s.Stop()
	case "status":
		status, err := s.Status()
		if err != nil {
			return err
		}
		switch status {
		case service.StatusRunning:
			println("Service is running")
		case service.StatusStopped:
			println("Service is stopped")
		default:
			println("Service status unknown")
		}
		return nil
	}

	return nil
}

// isWindowsService checks if running as Windows service
func isWindowsService() bool {
	if runtime.GOOS != "windows" {
		return false
	}
	// Check if running interactively (has console)
	// This is a simplified check
	return false
}

// RunAsService runs the agent as a Windows/Linux service
func RunAsService() error {
	svcConfig := serviceConfig()
	prg := &program{}
	s, err := service.New(prg, svcConfig)
	if err != nil {
		return err
	}
	return s.Run()
}
