/**
 * Utility functions for managing authentication state and preventing limbo states
 */

/**
 * Cleans up all authentication-related state from localStorage and sessionStorage
 * This helps prevent authentication limbo states where old tokens might interfere
 */
export const cleanupAuthState = () => {
  try {
    // Remove standard auth tokens
    localStorage.removeItem('supabase.auth.token');
    
    // Remove all Supabase auth keys from localStorage
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith('supabase.auth.') || key.includes('sb-')) {
        localStorage.removeItem(key);
      }
    });
    
    // Remove from sessionStorage if in use
    if (typeof sessionStorage !== 'undefined') {
      Object.keys(sessionStorage).forEach((key) => {
        if (key.startsWith('supabase.auth.') || key.includes('sb-')) {
          sessionStorage.removeItem(key);
        }
      });
    }
    
    console.log('Auth state cleanup completed');
  } catch (error) {
    console.error('Error during auth state cleanup:', error);
  }
};

/**
 * Clears organization-related localStorage data
 */
export const clearOrganizationData = () => {
  try {
    localStorage.removeItem('activeOrganizationId');
    localStorage.removeItem('pendingBusinessInfo');
    console.log('Organization data cleared');
  } catch (error) {
    console.error('Error clearing organization data:', error);
  }
};

/**
 * Performs a complete auth reset - useful for troubleshooting
 */
export const performAuthReset = () => {
  cleanupAuthState();
  clearOrganizationData();
  
  // Force a page reload to ensure clean state
  setTimeout(() => {
    window.location.href = '/login';
  }, 100);
};