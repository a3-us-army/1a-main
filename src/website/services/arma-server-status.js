import dgram from 'dgram';
import net from 'net';
import https from 'https';

// BattleMetrics API Configuration
const BATTLEMETRICS_API_KEY = process.env.BATTLEMETRICS_API_KEY || null;
const BATTLEMETRICS_SERVER_IDS = {
  '192.135.112.202': '34768597', // Replace with your actual server ID
  '74.112.77.254': '35315780'    // Replace with your actual server ID
};

// Arma server configuration
const ARMA_SERVERS = [
  {
    name: '1A Main Server',
    ip: '192.135.112.202',
    port: 9021,
    password: '1A75',
    // Try multiple ports if the first one doesn't work
    fallbackPorts: [9021, 9022, 9023, 9024]
  },
  {
    name: '1A Antistasi Server', 
    ip: '74.112.77.254',
    port: 9190,
    password: '',
    // Try multiple ports if the first one doesn't work
    fallbackPorts: [9191, 9192, 9193, 9194]
  }
];

// Configuration
const QUERY_TIMEOUT = 3000; // 3 seconds timeout



// TCP connection test (fallback for Bisect hosting)
async function testTCPConnection(ip, port) {
  return new Promise((resolve) => {
    const client = new net.Socket();
    
    const timeout = setTimeout(() => {
      client.destroy();
      resolve(false);
    }, 2000);

    client.connect(port, ip, () => {
      clearTimeout(timeout);
      client.destroy();
      resolve(true);
    });

    client.on('error', () => {
      clearTimeout(timeout);
      client.destroy();
      resolve(false);
    });
  });
}

// Test UDP port availability
async function testUDPPort(ip, port) {
  return new Promise((resolve) => {
    const client = dgram.createSocket('udp4');
    
    const timeout = setTimeout(() => {
      client.close();
      resolve(false);
    }, 1000);

    client.on('error', () => {
      clearTimeout(timeout);
      client.close();
      resolve(false);
    });

    // Send a simple ping to test if port is open
    client.send(Buffer.from('ping'), port, ip, (err) => {
      if (err) {
        clearTimeout(timeout);
        client.close();
        resolve(false);
      } else {
        // If we can send without error, port is likely open
        clearTimeout(timeout);
        client.close();
        resolve(true);
      }
    });
  });
}

// BattleMetrics-style Steam Query API with detailed info
async function querySteamAPI(ip, port) {
  return new Promise(async (resolve) => {
    try {
      // Step 1: Check if server is registered with Steam Master Server
      const masterServerUrl = `https://api.steampowered.com/ISteamApps/GetServersAtAddress/v1/?addr=${ip}&appid=107410`;
      
      const masterServerResponse = await new Promise((resolveMaster) => {
        const timeout = setTimeout(() => {
          resolveMaster(null);
        }, 3000);

        https.get(masterServerUrl, (res) => {
          clearTimeout(timeout);
          let data = '';
          
          res.on('data', (chunk) => {
            data += chunk;
          });
          
          res.on('end', () => {
            try {
              const response = JSON.parse(data);
              console.log('Steam Master Server API response:', response);
              resolveMaster(response);
            } catch (error) {
              resolveMaster(null);
            }
          });
        }).on('error', () => {
          clearTimeout(timeout);
          resolveMaster(null);
        });
      });

      // Step 2: If server is registered, try to get detailed info
      if (masterServerResponse && masterServerResponse.response && masterServerResponse.response.servers && masterServerResponse.response.servers.length > 0) {
        const serverInfo = masterServerResponse.response.servers.find(server => 
          server.addr && server.addr.includes(`:${port}`)
        ) || masterServerResponse.response.servers[0];
        
        // Step 3: Try to get detailed server info using Steam's detailed query
        const detailedInfo = await querySteamDetailedInfo(ip, port);
        
        if (detailedInfo.online) {
          resolve({
            online: true,
            players: detailedInfo.players || serverInfo.players || 0,
            maxPlayers: detailedInfo.maxPlayers || serverInfo.max_players || 50,
            map: detailedInfo.map || serverInfo.map || 'Unknown',
            hostname: detailedInfo.hostname || serverInfo.name || 'Unknown',
            note: 'Detailed data from Steam API'
          });
        } else {
          // Fallback to basic master server info
          resolve({
            online: true,
            players: serverInfo.players || 0,
            maxPlayers: serverInfo.max_players || 50,
            map: serverInfo.map || 'Unknown',
            hostname: serverInfo.name || 'Unknown',
            note: 'Basic data from Steam Master Server API'
          });
        }
      } else {
        // Server not in Steam master list, try direct query
        const directInfo = await querySteamDetailedInfo(ip, port);
        resolve(directInfo);
      }
      
    } catch (error) {
      resolve({
        online: false,
        players: 0,
        maxPlayers: 0,
        map: 'Unknown',
        hostname: 'Unknown',
        error: 'Steam API error'
      });
    }
  });
}

// Steam detailed server info query (like BattleMetrics uses)
async function querySteamDetailedInfo(ip, port) {
  return new Promise((resolve) => {
    // Steam's detailed server info query
    const url = `https://api.steampowered.com/ISteamApps/GetServersAtAddress/v1/?addr=${ip}:${port}&appid=107410&detailed=1`;
    
    const timeout = setTimeout(() => {
      resolve({
        online: false,
        players: 0,
        maxPlayers: 0,
        map: 'Unknown',
        hostname: 'Unknown',
        error: 'Detailed query timeout'
      });
    }, 3000);

    https.get(url, (res) => {
      clearTimeout(timeout);
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          console.log('Steam detailed query response:', response);
          
          if (response.response && response.response.servers && response.response.servers.length > 0) {
            const serverInfo = response.response.servers[0];
            resolve({
              online: true,
              players: serverInfo.players || 0,
              maxPlayers: serverInfo.max_players || 50,
              map: serverInfo.map || 'Unknown',
              hostname: serverInfo.name || 'Unknown',
              note: 'Detailed Steam query successful'
            });
          } else {
            resolve({
              online: false,
              players: 0,
              maxPlayers: 0,
              map: 'Unknown',
              hostname: 'Unknown',
              error: 'No detailed server info available'
            });
          }
        } catch (error) {
          resolve({
            online: false,
            players: 0,
            maxPlayers: 0,
            map: 'Unknown',
            hostname: 'Unknown',
            error: 'Detailed query parsing failed'
          });
        }
      });
    }).on('error', (err) => {
      clearTimeout(timeout);
      resolve({
        online: false,
        players: 0,
        maxPlayers: 0,
        map: 'Unknown',
        hostname: 'Unknown',
        error: 'Detailed query failed'
      });
    });
  });
}

// BattleMetrics API query (get detailed server info)
async function queryBattleMetricsAPI(ip, port) {
  return new Promise((resolve) => {
    const serverId = BATTLEMETRICS_SERVER_IDS[ip];
    
    if (!serverId || !BATTLEMETRICS_API_KEY) {
      resolve({
        online: false,
        players: 0,
        maxPlayers: 0,
        map: 'Unknown',
        hostname: 'Unknown',
        error: 'BattleMetrics API not configured'
      });
      return;
    }
    
    // BattleMetrics API endpoint for server info
    const url = `https://api.battlemetrics.com/servers/${serverId}`;
    
    const timeout = setTimeout(() => {
      resolve({
        online: false,
        players: 0,
        maxPlayers: 0,
        map: 'Unknown',
        hostname: 'Unknown',
        error: 'BattleMetrics API timeout'
      });
    }, 5000);

    const options = {
      headers: {
        'Authorization': `Bearer ${BATTLEMETRICS_API_KEY}`,
        'Content-Type': 'application/json'
      }
    };

    https.get(url, options, (res) => {
      clearTimeout(timeout);
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          console.log('BattleMetrics API response:', response);
          
          if (response.data && response.data.attributes) {
            const serverInfo = response.data.attributes;
            
            // Parse location array if present
            let location = 'Unknown';
            if (serverInfo.location && Array.isArray(serverInfo.location) && serverInfo.location.length >= 2) {
              location = `${serverInfo.location[0]}, ${serverInfo.location[1]}`;
            }
            
            // Parse details object if present
            let map = 'Unknown';
            if (serverInfo.details && typeof serverInfo.details === 'object') {
              map = serverInfo.details.map || serverInfo.details.level || 'Unknown';
            }
            
            resolve({
              online: serverInfo.status === 'online',
              players: serverInfo.players || 0,
              maxPlayers: serverInfo.maxPlayers || 50,
              map: map,
              hostname: serverInfo.name || 'Unknown',
              location: location,
              country: serverInfo.country || 'Unknown',
              port: serverInfo.port || port,
              queryStatus: serverInfo.queryStatus || 'Unknown',
              note: 'Data from BattleMetrics API'
            });
          } else {
            resolve({
              online: false,
              players: 0,
              maxPlayers: 0,
              map: 'Unknown',
              hostname: 'Unknown',
              error: 'Invalid BattleMetrics API response'
            });
          }
        } catch (error) {
          resolve({
            online: false,
            players: 0,
            maxPlayers: 0,
            map: 'Unknown',
            hostname: 'Unknown',
            error: 'BattleMetrics API parsing failed'
          });
        }
      });
    }).on('error', (err) => {
      clearTimeout(timeout);
      resolve({
        online: false,
        players: 0,
        maxPlayers: 0,
        map: 'Unknown',
        hostname: 'Unknown',
        error: 'BattleMetrics API request failed'
      });
    });
  });
}

// Direct server query (like BattleMetrics does when Steam API fails)
async function queryDirectServer(ip, port) {
  return new Promise((resolve) => {
    const client = dgram.createSocket('udp4');
    
    const timeout = setTimeout(() => {
      client.close();
      resolve({
        online: false,
        players: 0,
        maxPlayers: 0,
        map: 'Unknown',
        hostname: 'Unknown',
        error: 'Direct query timeout'
      });
    }, 2000);

    client.on('message', (msg) => {
      clearTimeout(timeout);
      client.close();
      
      try {
        const response = msg.toString('utf8');
        console.log(`Direct server response from ${ip}:${port}:`, response);
        
        // Parse Arma 3 server response
        let players = 0;
        let maxPlayers = 50;
        let map = 'Unknown';
        let hostname = 'Unknown';
        
        // Try to extract information from response
        const lines = response.split('\n');
        lines.forEach(line => {
          const trimmed = line.trim();
          
          // Key-value format (hostname=value)
          if (trimmed.includes('=')) {
            const [key, value] = trimmed.split('=');
            const cleanKey = key.trim().toLowerCase();
            const cleanValue = value.trim();
            
            switch (cleanKey) {
              case 'players':
                players = parseInt(cleanValue) || 0;
                break;
              case 'maxplayers':
                maxPlayers = parseInt(cleanValue) || 50;
                break;
              case 'map':
                map = cleanValue;
                break;
              case 'hostname':
                hostname = cleanValue;
                break;
            }
          }
          
          // Alternative format: "players: 5/50"
          if (trimmed.includes('players:') && trimmed.includes('/')) {
            const match = trimmed.match(/players:\s*(\d+)\/(\d+)/i);
            if (match) {
              players = parseInt(match[1]);
              maxPlayers = parseInt(match[2]);
            }
          }
        });
        
        resolve({
          online: true,
          players,
          maxPlayers,
          map,
          hostname,
          note: 'Direct server query successful'
        });
      } catch (error) {
        resolve({
          online: true,
          players: 0,
          maxPlayers: 50,
          map: 'Unknown',
          hostname: 'Unknown',
          note: 'Server responded but parsing failed'
        });
      }
    });

    client.on('error', (err) => {
      clearTimeout(timeout);
      client.close();
      resolve({
        online: false,
        players: 0,
        maxPlayers: 0,
        map: 'Unknown',
        hostname: 'Unknown',
        error: 'Direct query failed'
      });
    });

    // Send Arma 3 query packet
    const queryPacket = Buffer.from([0xFF, 0xFF, 0xFF, 0xFF, 0x54, 0x53, 0x6F, 0x75, 0x72, 0x63, 0x65, 0x20, 0x45, 0x6E, 0x67, 0x69, 0x6E, 0x65, 0x20, 0x51, 0x75, 0x65, 0x72, 0x79, 0x00]);
    client.send(queryPacket, port, ip);
  });
}



// BattleMetrics API first, then fallback query function
async function queryArmaServer(ip, port, fallbackPorts = []) {
  const allPorts = [port, ...fallbackPorts];
  
  for (const testPort of allPorts) {
    try {
      console.log(`Trying BattleMetrics API query on ${ip}:${testPort}...`);
      
      // Try BattleMetrics API first (most reliable)
      const battleMetricsResult = await queryBattleMetricsAPI(ip, testPort);
      if (battleMetricsResult.online || (battleMetricsResult.error && !battleMetricsResult.error.includes('not configured'))) {
        return {
          ...battleMetricsResult,
          actualPort: testPort,
          queryType: 'BattleMetrics API'
        };
      }
      
      // Fallback: Try Steam API
      console.log(`  Trying Steam API query for ${ip}:${testPort}...`);
      const steamResult = await querySteamAPI(ip, testPort);
      if (steamResult.online) {
        return {
          ...steamResult,
          actualPort: testPort,
          queryType: 'Steam API'
        };
      }
      
      // Fallback: Try direct server query
      console.log(`  Trying direct server query for ${ip}:${testPort}...`);
      const directResult = await queryDirectServer(ip, testPort);
      if (directResult.online) {
        return {
          ...directResult,
          actualPort: testPort,
          queryType: 'Direct Server Query'
        };
      }
      
      // Final fallback: test basic connectivity
      const udpAvailable = await testUDPPort(ip, testPort);
      if (udpAvailable) {
        return {
          online: true,
          players: 0,
          maxPlayers: 50,
          map: 'Unknown',
          hostname: `Server ${ip}:${testPort}`,
          note: 'Server online but queries unavailable',
          actualPort: testPort
        };
      }
      
    } catch (error) {
      console.error(`Error querying server ${ip}:${testPort}:`, error);
      continue;
    }
  }
  
  // All ports failed
  return {
    online: false,
    players: 0,
    maxPlayers: 0,
    map: 'Unknown',
    hostname: 'Unknown',
    error: 'Server offline (all ports tried)'
  };
}



export async function getAllServerStatus() {
  const results = [];
  
  for (const server of ARMA_SERVERS) {
    try {
      console.log(`Querying server: ${server.name} (${server.ip}:${server.port})`);
      const status = await queryArmaServer(server.ip, server.port, server.fallbackPorts);
      console.log(`Server ${server.name} status:`, status);
      
      results.push({
        name: server.name,
        ip: server.ip,
        port: server.port,
        actualPort: status.actualPort || server.port,
        ...status
      });
    } catch (error) {
      console.error(`Error querying server ${server.name}:`, error);
      results.push({
        name: server.name,
        ip: server.ip,
        port: server.port,
        online: false,
        players: 0,
        maxPlayers: 0,
        map: 'Unknown',
        hostname: 'Unknown',
        error: error.message || 'Unknown error'
      });
    }
  }
  
  return results;
}

export async function getServerStatus(serverIndex = 0) {
  if (serverIndex >= ARMA_SERVERS.length) {
    throw new Error('Invalid server index');
  }
  
  const server = ARMA_SERVERS[serverIndex];
  const status = await queryArmaServer(server.ip, server.port, server.fallbackPorts);
  
  return {
    name: server.name,
    ip: server.ip,
    port: server.port,
    actualPort: status.actualPort || server.port,
    ...status
  };
}

// Configuration helper
export function getQueryMethod() {
  return 'bisect-direct';
}

export function isBattleMetricsConfigured() {
  return false;
}
