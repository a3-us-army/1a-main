import { Router } from 'express';
import ensureAdmin from '../../middleware/ensureAdmin.js';
import os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const router = Router();

router.get('/', ensureAdmin, (req, res) => {
  res.render('admin/vps-status', {
    user: req.user,
    active: 'vps-status',
    isAdmin: true,
  });
});

// API endpoint to get VPS resource usage
router.get('/api', ensureAdmin, async (req, res) => {
  try {
    // Get basic system info
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    const memoryUsagePercent = ((usedMemory / totalMemory) * 100).toFixed(2);
    
    const cpuUsage = os.loadavg();
    const uptime = os.uptime();
    
    // Get disk usage
    let diskUsage = {};
    try {
      const { stdout } = await execAsync('df -h / | tail -1');
      const parts = stdout.trim().split(/\s+/);
      diskUsage = {
        total: parts[1],
        used: parts[2],
        available: parts[3],
        usagePercent: parts[4].replace('%', '')
      };
    } catch (error) {
      diskUsage = { error: 'Unable to get disk usage' };
    }
    
    // Get SWAP usage
    let swapUsage = {};
    try {
      const { stdout } = await execAsync('free -h | grep Swap');
      const parts = stdout.trim().split(/\s+/);
      if (parts.length >= 4) {
        const totalSwap = parts[1];
        const usedSwap = parts[2];
        const freeSwap = parts[3];
        const swapPercent = totalSwap !== '0B' ? 
          ((parseFloat(usedSwap.replace(/[A-Za-z]/g, '')) / parseFloat(totalSwap.replace(/[A-Za-z]/g, ''))) * 100).toFixed(2) : '0';
        
        swapUsage = {
          total: totalSwap,
          used: usedSwap,
          free: freeSwap,
          usagePercent: swapPercent
        };
      } else {
        swapUsage = { error: 'Unable to parse SWAP information' };
      }
    } catch (error) {
      swapUsage = { error: 'Unable to get SWAP usage' };
    }
    
    // Get network info
    const networkInterfaces = os.networkInterfaces();
    
    // Get process count
    let processCount = 0;
    try {
      const { stdout } = await execAsync('ps aux | wc -l');
      processCount = parseInt(stdout.trim()) - 1; // Subtract header line
    } catch (error) {
      processCount = 'Unknown';
    }
    
    // Get system temperature (if available)
    let temperature = 'N/A';
    try {
      const { stdout } = await execAsync('cat /sys/class/thermal/thermal_zone*/temp 2>/dev/null | head -1');
      if (stdout.trim()) {
        const tempCelsius = parseInt(stdout.trim()) / 1000;
        temperature = `${tempCelsius.toFixed(1)}°C`;
      }
    } catch (error) {
      // Temperature not available
    }
    
    const data = {
      system: {
        platform: os.platform(),
        arch: os.arch(),
        hostname: os.hostname(),
        nodeVersion: process.version,
        uptime: {
          seconds: uptime,
          formatted: formatUptime(uptime)
        }
      },
      memory: {
        total: formatBytes(totalMemory),
        used: formatBytes(usedMemory),
        free: formatBytes(freeMemory),
        usagePercent: memoryUsagePercent
      },
      cpu: {
        loadAverage: {
          '1min': cpuUsage[0].toFixed(2),
          '5min': cpuUsage[1].toFixed(2),
          '15min': cpuUsage[2].toFixed(2)
        },
        cores: os.cpus().length,
        model: os.cpus()[0].model
      },
      disk: diskUsage,
      swap: swapUsage,
      network: {
        interfaces: Object.keys(networkInterfaces).filter(iface => 
          !iface.startsWith('lo') && networkInterfaces[iface]?.some(addr => addr.family === 'IPv4')
        )
      },
      processes: processCount,
      temperature: temperature,
      timestamp: new Date().toISOString()
    };
    
    res.json(data);
  } catch (error) {
    console.error('Error fetching VPS status:', error);
    res.status(500).json({ error: 'Failed to fetch VPS status' });
  }
});

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`;
  } else if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else {
    return `${minutes}m`;
  }
}

export default router; 