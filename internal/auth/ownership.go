package auth

// CanModifyResource checks if user can modify a resource based on ownership
// Admin can modify any resource, regular users can only modify their own
func CanModifyResource(userRole string, userID uint, resourceCreatedBy uint) bool {
	// Admin can modify anything
	if userRole == "admin" {
		return true
	}

	// Owner can modify their own resources
	if userID == resourceCreatedBy {
		return true
	}

	// CreatedBy == 0 means legacy resource without ownership (allow for backwards compat)
	if resourceCreatedBy == 0 {
		return true
	}

	return false
}
