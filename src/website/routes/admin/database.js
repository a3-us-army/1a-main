import { Router } from 'express';
import ensureAdmin from '../../middleware/ensureAdmin.js';
import { 
  getDatabaseHealthSummary, 
  getDatabaseHealthLogs,
  logDatabaseHealth,
  getDatabase,
  setupDatabase
} from '../../../bot/utils/database.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = Router();

// Ensure database is set up
setupDatabase();
const db = getDatabase();

// Database Health Dashboard
router.get('/', ensureAdmin, async (req, res) => {
  try {
    // Get database health summary
    const healthSummary = getDatabaseHealthSummary() || [];
    
    // Get recent health logs
    const healthLogs = getDatabaseHealthLogs(20) || [];
    
    // Get database file info
    const dbPath = path.resolve(__dirname, '../../../../events.db');
    let dbStats;
    try {
      dbStats = fs.statSync(dbPath);
    } catch (fsError) {
      console.error('Database file not found:', fsError);
      dbStats = { size: 0 };
    }
    
    // Get table sizes
    const tableSizes = [];
    try {
      const tables = db.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name NOT LIKE 'sqlite_%'
      `).all();
      
      for (const table of tables) {
        try {
          const recordCount = db.prepare(`SELECT COUNT(*) as count FROM ${table.name}`).get().count;
          const tableInfo = db.prepare(`PRAGMA table_info(${table.name})`).all();
          
          tableSizes.push({
            name: table.name,
            recordCount,
            columnCount: tableInfo.length,
            estimatedSize: recordCount * tableInfo.length * 100 // Rough estimate
          });
        } catch (tableError) {
          console.error(`Error processing table ${table.name}:`, tableError);
          tableSizes.push({
            name: table.name,
            recordCount: 0,
            columnCount: 0,
            estimatedSize: 0
          });
        }
      }
    } catch (tablesError) {
      console.error('Error getting table list:', tablesError);
    }
    
    // Calculate overall health score
    const overallHealth = healthSummary.length > 0 
      ? healthSummary.reduce((acc, table) => acc + table.healthScore, 0) / healthSummary.length 
      : 100;
    
    res.render('admin/database', {
      user: req.user,
      healthSummary,
      healthLogs,
      tableSizes,
      overallHealth: Math.round(overallHealth),
      dbStats,
      active: 'database',
      isAdmin: true,
      alert: req.query.alert,
      error: req.query.error
    });
  } catch (error) {
    console.error('Error loading database health:', error);
    res.redirect('/database-health?error=Failed to load database health data');
  }
});

// Database Health API
router.get('/api/health', ensureAdmin, async (req, res) => {
  try {
    const healthSummary = getDatabaseHealthSummary();
    const healthLogs = getDatabaseHealthLogs(50);
    
    // Get database performance metrics
    const performanceMetrics = {
      // Check for slow queries (this is a simplified version)
      slowQueries: 0,
      // Check for locked tables
      lockedTables: 0,
      // Check for fragmentation
      fragmentation: 0
    };
    
    // Get table growth over time
    const tableGrowth = db.prepare(`
      SELECT 
        table_name,
        COUNT(*) as record_count,
        DATE(last_updated) as date
      FROM database_health_logs 
      WHERE last_updated >= date('now', '-7 days')
      GROUP BY table_name, DATE(last_updated)
      ORDER BY table_name, date
    `).all();
    
    res.json({
      healthSummary,
      healthLogs,
      performanceMetrics,
      tableGrowth
    });
  } catch (error) {
    console.error('Error loading database health API:', error);
    res.status(500).json({ error: 'Failed to load database health data' });
  }
});

// Run Database Health Check
router.post('/health-check', ensureAdmin, async (req, res) => {
  try {
    const healthSummary = getDatabaseHealthSummary();
    
    // Log health check results
    for (const table of healthSummary) {
      await logDatabaseHealth(
        table.tableName,
        table.recordCount,
        table.estimatedSize || 0,
        table.healthScore,
        table.healthScore < 70 ? ['Low health score'] : null
      );
    }
    
    res.redirect('/database-health?alert=Database health check completed');
  } catch (error) {
    console.error('Error running health check:', error);
    res.redirect('/database-health?error=Failed to run health check');
  }
});

// Database Optimization
router.post('/optimize', ensureAdmin, async (req, res) => {
  try {
    // Run VACUUM to optimize database
    db.prepare('VACUUM').run();
    
    // Analyze tables for better query planning
    db.prepare('ANALYZE').run();
    
    // Update database statistics
    const tables = db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
    `).all();
    
    for (const table of tables) {
      db.prepare(`ANALYZE ${table.name}`).run();
    }
    
    res.redirect('/database-health?alert=Database optimization completed');
  } catch (error) {
    console.error('Error optimizing database:', error);
    res.redirect('/database-health?error=Failed to optimize database');
  }
});

// Database Backup
router.post('/backup', ensureAdmin, async (req, res) => {
  try {
    const dbPath = path.resolve(__dirname, '../../../../events.db');
    const backupDir = path.resolve(__dirname, '../../../../backup_db');
    const fs = await import('fs/promises');
    
    // Create backup directory if it doesn't exist
    try {
      await fs.access(backupDir);
    } catch {
      await fs.mkdir(backupDir, { recursive: true });
    }
    
    // Create backup with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(backupDir, `backup_${timestamp}.db`);
    
    // Create backup using fs.copyFile
    await fs.copyFile(dbPath, backupPath);
    
    res.redirect('/database-health?alert=Database backup created successfully');
  } catch (error) {
    console.error('Error creating backup:', error);
    res.redirect('/database-health?error=Failed to create backup');
  }
});

// Get Database Statistics
router.get('/api/stats', ensureAdmin, async (req, res) => {
  try {
    // Get table statistics
    const tables = db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
    `).all();
    
    const stats = {};
    for (const table of tables) {
      const recordCount = db.prepare(`SELECT COUNT(*) as count FROM ${table.name}`).get().count;
      const tableInfo = db.prepare(`PRAGMA table_info(${table.name})`).all();
      
      stats[table.name] = {
        recordCount,
        columnCount: tableInfo.length,
        hasPrimaryKey: tableInfo.some(col => col.pk > 0),
        columns: tableInfo.map(col => ({
          name: col.name,
          type: col.type,
          notNull: col.notnull,
          primaryKey: col.pk > 0
        }))
      };
    }
    
    res.json(stats);
  } catch (error) {
    console.error('Error loading database stats:', error);
    res.status(500).json({ error: 'Failed to load database statistics' });
  }
});

// List Backups
router.get('/backups', ensureAdmin, async (req, res) => {
  try {
    const backupDir = path.resolve(__dirname, '../../../../backup_db');
    const fs = await import('fs/promises');
    
    // Check if backup directory exists
    try {
      await fs.access(backupDir);
    } catch {
      return res.json([]);
    }
    
    // Get list of backup files
    const files = await fs.readdir(backupDir);
    const backups = [];
    
    for (const file of files) {
      if (file.endsWith('.db')) {
        const filePath = path.join(backupDir, file);
        const stats = await fs.stat(filePath);
        backups.push({
          name: file,
          size: stats.size,
          created: stats.birthtime,
          path: filePath
        });
      }
    }
    
    // Sort by creation date (newest first)
    backups.sort((a, b) => new Date(b.created) - new Date(a.created));
    
    res.json(backups);
  } catch (error) {
    console.error('Error listing backups:', error);
    res.status(500).json({ error: 'Failed to list backups' });
  }
});

// Delete Backup
router.delete('/backup/:filename', ensureAdmin, async (req, res) => {
  try {
    const backupDir = path.resolve(__dirname, '../../../../backup_db');
    const backupPath = path.join(backupDir, req.params.filename);
    const fs = await import('fs/promises');
    
    // Validate filename to prevent directory traversal
    if (!req.params.filename.endsWith('.db') || req.params.filename.includes('..')) {
      return res.status(400).json({ error: 'Invalid backup filename' });
    }
    
    await fs.unlink(backupPath);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting backup:', error);
    res.status(500).json({ error: 'Failed to delete backup' });
  }
});

export default router; 