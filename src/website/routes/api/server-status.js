import { Router } from 'express';
import { getAllServerStatus, getQueryMethod } from '../../services/arma-server-status.js';

const router = Router();

// Cache server status for 30 seconds to avoid overwhelming the servers
let cachedStatus = null;
let lastFetch = 0;
const CACHE_DURATION = 30000; // 30 seconds

router.get('/', async (req, res) => {
  try {
    const now = Date.now();
    
    // Return cached data if it's still fresh
    if (cachedStatus && (now - lastFetch) < CACHE_DURATION) {
      return res.json(cachedStatus);
    }
    
    // Fetch fresh data
    const serverStatus = await getAllServerStatus();
    
    // Update cache
    cachedStatus = serverStatus;
    lastFetch = now;
    
    res.json(serverStatus);
  } catch (error) {
    console.error('Error fetching server status:', error);
    res.status(500).json({ 
      error: 'Failed to fetch server status',
      details: error.message 
    });
  }
});

// Configuration endpoint for debugging
router.get('/config', (req, res) => {
  res.json({
    queryMethod: getQueryMethod(),
    cacheDuration: CACHE_DURATION,
    timestamp: new Date().toISOString()
  });
});

export default router;
