import { logUserActivity } from '../../bot/utils/database.js';

// Middleware to log user activity
export function activityLogger(activityType, details = null) {
  return async (req, res, next) => {
    // Store original send method
    const originalSend = res.send;
    
    // Override send method to log after response
    res.send = function(data) {
      // Log activity after response is sent
      if (req.user) {
        logUserActivity(
          req.user.id,
          activityType,
          details,
          req.ip,
          req.get('User-Agent')
        ).catch(err => {
          console.error('Error logging activity:', err);
        });
      }
      
      // Call original send method
      return originalSend.call(this, data);
    };
    
    next();
  };
}

// Specific activity loggers for common actions
export const logPageView = (pageName) => activityLogger('page_view', { page: pageName });
export const logFormSubmission = (formName) => activityLogger('form_submission', { form: formName });
export const logFileDownload = (fileName) => activityLogger('file_download', { file: fileName });
export const logAdminAction = (action) => activityLogger('admin_action', { action });
export const logLogin = () => activityLogger('login');
export const logLogout = () => activityLogger('logout'); 