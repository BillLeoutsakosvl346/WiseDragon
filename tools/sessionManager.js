/**
 * Session Management for Screenshot Organization
 * 
 * Creates timestamped session folders for organizing screenshots
 * by conversation session instead of dumping all in one folder.
 */

const fs = require('fs');
const path = require('path');

class SessionManager {
  constructor() {
    this.currentSession = null;
    this.baseDir = path.join(__dirname, '..', 'screenshots_seen');
    this.ensureBaseDir();
  }

  /**
   * Ensure the base screenshots_seen directory exists
   */
  ensureBaseDir() {
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
  }

  /**
   * Start a new session with timestamp-based folder
   */
  startNewSession() {
    const now = new Date();
    const sessionTimestamp = now.toISOString()
      .replace(/[:.]/g, '-')
      .replace('T', '_')
      .split('.')[0]; // Format: 2025-09-14_15-30-45
    
    const sessionFolder = `session_${sessionTimestamp}`;
    const sessionPath = path.join(this.baseDir, sessionFolder);
    
    // Create the session directory
    if (!fs.existsSync(sessionPath)) {
      fs.mkdirSync(sessionPath, { recursive: true });
    }

    this.currentSession = {
      folder: sessionFolder,
      path: sessionPath,
      startTime: now,
      screenshotCount: 0
    };

    console.log(`📁 New session started: ${sessionFolder}`);
    return this.currentSession;
  }

  /**
   * Get current session, creating one if none exists
   */
  getCurrentSession() {
    if (!this.currentSession) {
      this.startNewSession();
    }
    return this.currentSession;
  }

  /**
   * Get the full path for saving a screenshot in the current session
   */
  getScreenshotPath(filename) {
    const session = this.getCurrentSession();
    session.screenshotCount++;
    return path.join(session.path, filename);
  }

  /**
   * Get session statistics
   */
  getSessionStats() {
    if (!this.currentSession) {
      return null;
    }

    return {
      folder: this.currentSession.folder,
      startTime: this.currentSession.startTime,
      screenshotCount: this.currentSession.screenshotCount,
      duration: Date.now() - this.currentSession.startTime.getTime()
    };
  }

  /**
   * Manually end current session (optional - mainly for cleanup/stats)
   */
  endSession() {
    if (this.currentSession) {
      const stats = this.getSessionStats();
      console.log(`📁 Session ended: ${stats.folder} (${stats.screenshotCount} screenshots, ${Math.round(stats.duration/1000)}s)`);
      this.currentSession = null;
      return stats;
    }
    return null;
  }
}

// Global session manager instance
const sessionManager = new SessionManager();

module.exports = sessionManager;
