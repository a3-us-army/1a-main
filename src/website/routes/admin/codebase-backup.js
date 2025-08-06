import { Router } from 'express';
import ensureAdmin from '../../middleware/ensureAdmin.js';
import archiver from 'archiver';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import cron from 'node-cron';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = Router();

// Codebase backup function
async function performCodebaseBackup() {
  try {
    const projectRoot = path.resolve(__dirname, '../../../../');
    const backupDir = path.resolve(projectRoot, 'backup_codebase');
    const fsPromises = await import('fs/promises');
    
    // Create backup directory if it doesn't exist
    try {
      await fsPromises.access(backupDir);
    } catch {
      await fsPromises.mkdir(backupDir, { recursive: true });
    }
    
    // Create backup with readable timestamp
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
    const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-'); // HH-MM-SS
    const backupFilename = `codebase-backup-${dateStr}-${timeStr}.zip`;
    const backupPath = path.join(backupDir, backupFilename);
    
    // Create ZIP archive
    const output = fs.createWriteStream(backupPath);
    const archive = archiver('zip', {
      zlib: { level: 9 } // Maximum compression
    });
    
    // Listen for archive events
    output.on('close', async () => {
      console.log(`Codebase backup created: ${backupFilename} (${archive.pointer()} bytes)`);
      
      // Upload to Cloudflare CDN if configured
      if (process.env.R2_BUCKET && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY) {
        try {
          await uploadToCloudflare(backupPath, backupFilename);
          console.log(`Codebase backup uploaded to Cloudflare: ${backupFilename}`);
        } catch (uploadError) {
          console.error('Error uploading to Cloudflare:', uploadError);
        }
      }
      
      // Clean up old backups (keep only 5 most recent)
      await cleanupOldBackups(backupDir);
    });
    
    archive.on('error', (err) => {
      throw err;
    });
    
    // Pipe archive data to the file
    archive.pipe(output);
    
    // Load exclusion rules
    let exclusionRules = [];
    const exclusionFile = path.resolve(projectRoot, 'backup_exclusions.json');
    
    try {
      const data = await fsPromises.readFile(exclusionFile, 'utf8');
      exclusionRules = JSON.parse(data);
      console.log('Backup: Loaded exclusion rules:', exclusionRules);
    } catch (fileError) {
      console.log('Backup: Error reading exclusion file:', fileError.message);
      // Use default exclusions if file doesn't exist
      exclusionRules = [
        { pattern: 'node_modules', type: 'directory' },
        { pattern: '.git', type: 'directory' },
        { pattern: 'backup_db', type: 'directory' },
        { pattern: 'backup_codebase', type: 'directory' },
        { pattern: '.vscode', type: 'directory' },
        { pattern: '.idea', type: 'directory' },
        { pattern: 'logs', type: 'directory' },
        { pattern: 'temp', type: 'directory' },
        { pattern: 'tmp', type: 'directory' },
        { pattern: '.env', type: 'file' },
        { pattern: '.env.local', type: 'file' },
        { pattern: '.env.production', type: 'file' },
        { pattern: 'package-lock.json', type: 'file' },
        { pattern: 'yarn.lock', type: 'file' },
        { pattern: '.DS_Store', type: 'file' },
        { pattern: 'Thumbs.db', type: 'file' }
      ];
    }
    
    // Function to check if path should be excluded
    const shouldExclude = (filePath) => {
      const relativePath = path.relative(projectRoot, filePath);
      const fileName = path.basename(filePath);
      
      for (const rule of exclusionRules) {
        // Handle both old format (type: 'exclude') and new format (type: 'file'/'directory')
        if (rule.type === 'exclude' || rule.type === 'directory') {
          if (relativePath.startsWith(rule.pattern + path.sep) || relativePath === rule.pattern) {
            return true;
          }
        } else if (rule.type === 'file') {
          if (fileName === rule.pattern || relativePath === rule.pattern) {
            return true;
          }
        }
      }
      
      return false;
    };
    
    // Recursively add files to archive
    const addDirectoryToArchive = async (dirPath, archivePath = '') => {
      const items = await fsPromises.readdir(dirPath);
      
      for (const item of items) {
        const fullPath = path.join(dirPath, item);
        const relativePath = path.relative(projectRoot, fullPath);
        const archiveItemPath = archivePath ? path.join(archivePath, item) : item;
        
        console.log(`Backup: Processing: ${relativePath}`);
        
        if (shouldExclude(fullPath)) {
          console.log(`Backup: Skipping excluded file/directory: ${relativePath}`);
          continue;
        }
        
        const stats = await fsPromises.stat(fullPath);
        
        if (stats.isDirectory()) {
          await addDirectoryToArchive(fullPath, archiveItemPath);
        } else {
          archive.file(fullPath, { name: archiveItemPath });
        }
      }
    };
    
    await addDirectoryToArchive(projectRoot);
    
    // Finalize the archive
    await archive.finalize();
    
  } catch (error) {
    console.error('Error performing codebase backup:', error);
  }
}

// Upload to Cloudflare R2/CDN
async function uploadToCloudflare(filePath, filename) {
  try {
    const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');
    
    const client = new S3Client({
      region: 'auto',
      endpoint: process.env.R2_ENDPOINT,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      },
    });
    
    const fileContent = await fs.promises.readFile(filePath);
    
    const command = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET,
      Key: `codebase-backups/${filename}`,
      Body: fileContent,
      ContentType: 'application/zip',
    });
    
    await client.send(command);
    console.log(`Successfully uploaded ${filename} to Cloudflare R2`);
  } catch (error) {
    console.error('Error uploading to Cloudflare:', error);
    throw error;
  }
}

// Clean up old backups
async function cleanupOldBackups(backupDir) {
  try {
    const fsPromises = await import('fs/promises');
    
    const files = await fsPromises.readdir(backupDir);
    const backupFiles = files
      .filter(file => file.endsWith('.zip'))
      .map(file => ({
        name: file,
        path: path.join(backupDir, file),
        stats: null
      }));
    
    // Get file stats for sorting
    for (const file of backupFiles) {
      try {
        file.stats = await fsPromises.stat(file.path);
      } catch (err) {
        console.error(`Error getting stats for ${file.name}:`, err);
      }
    }
    
    // Sort by creation time (oldest first)
    backupFiles.sort((a, b) => {
      if (!a.stats || !b.stats) return 0;
      return a.stats.birthtime.getTime() - b.stats.birthtime.getTime();
    });
    
    // Delete oldest backups if we have more than 5
    if (backupFiles.length > 5) {
      const filesToDelete = backupFiles.slice(0, backupFiles.length - 5);
      for (const file of filesToDelete) {
        try {
          await fsPromises.unlink(file.path);
          console.log(`Deleted old codebase backup: ${file.name}`);
        } catch (err) {
          console.error(`Error deleting codebase backup ${file.name}:`, err);
        }
      }
    }
  } catch (error) {
    console.error('Error cleaning up old codebase backups:', error);
  }
}

// Schedule daily codebase backup at 3:00 AM (1 hour after database backup)
cron.schedule('0 3 * * *', performCodebaseBackup, {
  timezone: 'UTC'
});

console.log('Automated daily codebase backup scheduled for 3:00 AM UTC');

// Render codebase backup page
router.get('/', ensureAdmin, async (req, res) => {
  res.render('admin/codebase-backup', {
    user: req.user,
    active: 'codebase-backup',
    isAdmin: true,
    alert: req.query.alert,
    error: req.query.error
  });
});

// Manual trigger for testing
router.post('/trigger', ensureAdmin, async (req, res) => {
  try {
    await performCodebaseBackup();
    res.redirect('/codebase-backup?alert=Codebase backup completed successfully');
  } catch (error) {
    console.error('Error triggering codebase backup:', error);
    res.redirect('/codebase-backup?error=Failed to trigger codebase backup');
  }
});

// Get file structure
router.get('/structure', ensureAdmin, async (req, res) => {
  try {
    const projectRoot = path.resolve(__dirname, '../../../../');
    const fsPromises = await import('fs/promises');
    
    // Load exclusion rules
    let exclusionRules = [];
    const exclusionFile = path.resolve(__dirname, '../../../../backup_exclusions.json');
    
    try {
      const data = await fsPromises.readFile(exclusionFile, 'utf8');
      exclusionRules = JSON.parse(data);
    } catch (fileError) {
      // Use default exclusions if file doesn't exist
      exclusionRules = [
        { pattern: 'node_modules', type: 'directory' },
        { pattern: '.git', type: 'directory' },
        { pattern: 'backup_db', type: 'directory' },
        { pattern: 'backup_codebase', type: 'directory' },
        { pattern: '.vscode', type: 'directory' },
        { pattern: '.idea', type: 'directory' },
        { pattern: 'logs', type: 'directory' },
        { pattern: 'temp', type: 'directory' },
        { pattern: 'tmp', type: 'directory' },
        { pattern: '.env', type: 'file' },
        { pattern: '.env.local', type: 'file' },
        { pattern: '.env.production', type: 'file' },
        { pattern: 'package-lock.json', type: 'file' },
        { pattern: 'yarn.lock', type: 'file' },
        { pattern: '.DS_Store', type: 'file' },
        { pattern: 'Thumbs.db', type: 'file' }
      ];
    }
    
    const structure = [];
    
    // Function to check if path should be excluded
    const shouldExclude = (filePath) => {
      const relativePath = path.relative(projectRoot, filePath);
      const fileName = path.basename(filePath);
      
      for (const rule of exclusionRules) {
        // Handle both old format (type: 'exclude') and new format (type: 'file'/'directory')
        if (rule.type === 'exclude' || rule.type === 'directory') {
          if (relativePath.startsWith(rule.pattern + path.sep) || relativePath === rule.pattern) {
            return true;
          }
        } else if (rule.type === 'file') {
          if (fileName === rule.pattern || relativePath === rule.pattern) {
            return true;
          }
        }
      }
      
      return false;
    };
    
    // Recursively scan directory
    const scanDirectory = async (dirPath, depth = 0) => {
      try {
        const items = await fsPromises.readdir(dirPath);
        
        for (const item of items) {
          const fullPath = path.join(dirPath, item);
          const relativePath = path.relative(projectRoot, fullPath);
          const isExcluded = shouldExclude(fullPath);
          
          try {
            const stats = await fsPromises.stat(fullPath);
            
            if (stats.isDirectory()) {
              structure.push({
                name: item,
                path: relativePath,
                type: 'directory',
                depth,
                excluded: isExcluded
              });
              
              // Always scan directories to show their contents, even if excluded
              await scanDirectory(fullPath, depth + 1);
            } else {
              structure.push({
                name: item,
                path: relativePath,
                type: 'file',
                depth,
                excluded: isExcluded,
                size: stats.size
              });
            }
          } catch (statError) {
            console.error(`Error getting stats for ${fullPath}:`, statError);
          }
        }
      } catch (readError) {
        console.error(`Error reading directory ${dirPath}:`, readError);
      }
    };
    
    await scanDirectory(projectRoot);
    
    // Sort by path for better display
    structure.sort((a, b) => a.path.localeCompare(b.path));
    
    res.json(structure);
  } catch (error) {
    console.error('Error getting file structure:', error);
    res.status(500).json({ error: 'Failed to get file structure' });
  }
});

// Get exclusion rules
router.get('/exclusions', ensureAdmin, async (req, res) => {
  try {
    const exclusionFile = path.resolve(__dirname, '../../../../backup_exclusions.json');
    const fsPromises = await import('fs/promises');
    
    try {
      const data = await fsPromises.readFile(exclusionFile, 'utf8');
      const exclusions = JSON.parse(data);
      res.json(exclusions);
    } catch (fileError) {
      // File doesn't exist, return default exclusions
      const defaultExclusions = [
        { pattern: 'node_modules', type: 'directory' },
        { pattern: '.git', type: 'directory' },
        { pattern: 'backup_db', type: 'directory' },
        { pattern: 'backup_codebase', type: 'directory' },
        { pattern: '.vscode', type: 'directory' },
        { pattern: '.idea', type: 'directory' },
        { pattern: 'logs', type: 'directory' },
        { pattern: 'temp', type: 'directory' },
        { pattern: 'tmp', type: 'directory' },
        { pattern: '.env', type: 'file' },
        { pattern: '.env.local', type: 'file' },
        { pattern: '.env.production', type: 'file' },
        { pattern: 'package-lock.json', type: 'file' },
        { pattern: 'yarn.lock', type: 'file' },
        { pattern: '.DS_Store', type: 'file' },
        { pattern: 'Thumbs.db', type: 'file' }
      ];
      res.json(defaultExclusions);
    }
  } catch (error) {
    console.error('Error getting exclusion rules:', error);
    res.status(500).json({ error: 'Failed to get exclusion rules' });
  }
});

// Update exclusion rules
router.post('/exclusions', ensureAdmin, async (req, res) => {
  try {
    const { pattern, type, action } = req.body;
    const exclusionFile = path.resolve(__dirname, '../../../../backup_exclusions.json');
    const fsPromises = await import('fs/promises');
    
    let exclusions = [];
    
    try {
      const data = await fsPromises.readFile(exclusionFile, 'utf8');
      exclusions = JSON.parse(data);
    } catch (fileError) {
      // File doesn't exist, start with empty array
    }
    
    if (action === 'add') {
      // Check if pattern already exists
      const exists = exclusions.some(ex => ex.pattern === pattern);
      if (!exists) {
        // Determine if it's a file or directory based on the pattern
        const isDirectory = pattern.endsWith('/') || !pattern.includes('.');
        exclusions.push({ pattern, type: isDirectory ? 'directory' : 'file' });
      }
    } else if (action === 'remove') {
      exclusions = exclusions.filter(ex => ex.pattern !== pattern);
    }
    
    // Save updated exclusions
    await fsPromises.writeFile(exclusionFile, JSON.stringify(exclusions, null, 2));
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating exclusion rules:', error);
    res.status(500).json({ error: 'Failed to update exclusion rules' });
  }
});

// Get backup statistics
router.get('/stats', ensureAdmin, async (req, res) => {
  try {
    const projectRoot = path.resolve(__dirname, '../../../../');
    const backupDir = path.resolve(projectRoot, 'backup_codebase');
    const fsPromises = await import('fs/promises');
    
    let totalBackups = 0;
    let totalSize = '0 MB';
    let lastBackup = null;
    let nextBackup = '3:00 AM UTC';
    
    try {
      await fsPromises.access(backupDir);
      const files = await fsPromises.readdir(backupDir);
      const backupFiles = files.filter(file => file.endsWith('.zip'));
      
      totalBackups = backupFiles.length;
      
      if (backupFiles.length > 0) {
        let totalBytes = 0;
        let latestTime = 0;
        
        for (const file of backupFiles) {
          const filePath = path.join(backupDir, file);
          const stats = await fsPromises.stat(filePath);
          totalBytes += stats.size;
          
          if (stats.birthtime.getTime() > latestTime) {
            latestTime = stats.birthtime.getTime();
            lastBackup = stats.birthtime.toLocaleDateString();
          }
        }
        
        totalSize = (totalBytes / 1024 / 1024).toFixed(2) + ' MB';
      }
    } catch (dirError) {
      // Backup directory doesn't exist yet
    }
    
    res.json({
      totalBackups,
      totalSize,
      lastBackup,
      nextBackup
    });
  } catch (error) {
    console.error('Error getting backup stats:', error);
    res.status(500).json({ error: 'Failed to get backup stats' });
  }
});

// List codebase backups
router.get('/list', ensureAdmin, async (req, res) => {
  try {
    const projectRoot = path.resolve(__dirname, '../../../../');
    const backupDir = path.resolve(projectRoot, 'backup_codebase');
    const fsPromises = await import('fs/promises');
    
    // Check if backup directory exists
    try {
      await fsPromises.access(backupDir);
    } catch {
      return res.json([]);
    }
    
    // Get list of backup files
    const files = await fsPromises.readdir(backupDir);
    const backups = [];
    
    for (const file of files) {
      if (file.endsWith('.zip')) {
        const filePath = path.join(backupDir, file);
        const stats = await fsPromises.stat(filePath);
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
    console.error('Error listing codebase backups:', error);
    res.status(500).json({ error: 'Failed to list codebase backups' });
  }
});

// Download codebase backup
router.get('/download/:filename', ensureAdmin, async (req, res) => {
  try {
    const projectRoot = path.resolve(__dirname, '../../../../');
    const backupDir = path.resolve(projectRoot, 'backup_codebase');
    const backupPath = path.join(backupDir, req.params.filename);
    const fsPromises = await import('fs/promises');
    const fs = await import('fs');
    
    // Validate filename to prevent directory traversal
    if (!req.params.filename.endsWith('.zip') || req.params.filename.includes('..')) {
      return res.status(400).json({ error: 'Invalid backup filename' });
    }
    
    // Check if file exists
    try {
      await fsPromises.access(backupPath);
    } catch {
      return res.status(404).json({ error: 'Backup file not found' });
    }
    
    // Get file stats
    const stats = await fsPromises.stat(backupPath);
    
    // Set headers for file download
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${req.params.filename}"`);
    res.setHeader('Content-Length', stats.size);
    
    // Stream the file
    const fileStream = fs.default.createReadStream(backupPath);
    fileStream.pipe(res);
  } catch (error) {
    console.error('Error downloading codebase backup:', error);
    res.status(500).json({ error: 'Failed to download codebase backup' });
  }
});

// Delete codebase backup
router.delete('/delete/:filename', ensureAdmin, async (req, res) => {
  try {
    const projectRoot = path.resolve(__dirname, '../../../../');
    const backupDir = path.resolve(projectRoot, 'backup_codebase');
    const backupPath = path.join(backupDir, req.params.filename);
    const fsPromises = await import('fs/promises');
    
    // Validate filename to prevent directory traversal
    if (!req.params.filename.endsWith('.zip') || req.params.filename.includes('..')) {
      return res.status(400).json({ error: 'Invalid backup filename' });
    }
    
    await fsPromises.unlink(backupPath);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting codebase backup:', error);
    res.status(500).json({ error: 'Failed to delete codebase backup' });
  }
});

export default router; 