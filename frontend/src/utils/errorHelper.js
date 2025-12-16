// Helper function to extract error message from API response
// Handles 403 Forbidden (permission denied) specially
export const getErrorMessage = (error, defaultMessage = 'Operation failed. Please try again.') => {
    // Check for 403 Forbidden (ownership/permission issues)
    if (error.response?.status === 403) {
        return error.response?.data?.error || 'You do not have permission to perform this action.';
    }

    // Check for other API error messages
    if (error.response?.data?.error) {
        return error.response.data.error;
    }

    // Check for network errors
    if (error.message) {
        return error.message;
    }

    return defaultMessage;
};

// Check if error is a permission error (403)
export const isPermissionError = (error) => {
    return error.response?.status === 403;
};
