import dgram from 'dgram';
import net from 'net';

// Arma server configuration
const ARMA_SERVERS = [
  {
    name: '1A Main Server',
    ip: '192.135.112.202',
    port: 9020,
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

// Comprehensive Arma 3 server query implementation with multiple query attempts
async function queryArma3Server(ip, port) {
  return new Promise((resolve) => {
    const client = dgram.createSocket('udp4');
    let queryIndex = 0;
    
    const timeout = setTimeout(() => {
      client.close();
      resolve({
        online: false,
        players: 0,
        maxPlayers: 0,
        map: 'Unknown',
        hostname: 'Unknown',
        error: 'Connection timeout'
      });
    }, QUERY_TIMEOUT);

    client.on('message', (msg) => {
      clearTimeout(timeout);
      client.close();
      
      try {
        // Arma 3 server response parsing
        const response = msg.toString('utf8');
        console.log(`Raw response from ${ip}:${port}:`, response);
        
        // Parse Arma 3 server info
        let players = 0;
        let maxPlayers = 50;
        let map = 'Unknown';
        let hostname = 'Unknown';
        
        // Arma 3 servers typically respond with key-value pairs
        const lines = response.split('\n');
        lines.forEach(line => {
          const trimmed = line.trim();
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
              case 'gametype':
                // Could be useful for additional info
                break;
            }
          }
        });
        
        resolve({
          online: true,
          players,
          maxPlayers,
          map,
          hostname
        });
      } catch (error) {
        console.error(`Error parsing response from ${ip}:${port}:`, error);
        resolve({
          online: true,
          players: 0,
          maxPlayers: 50,
          map: 'Unknown',
          hostname: 'Unknown',
          note: 'Server responded but data parsing failed'
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
        error: 'Connection failed'
      });
    });

    // Arma 3 specific query packets - try multiple formats
    const arma3Queries = [
      // Standard Source Engine query (most Arma servers respond to this)
      Buffer.from([0xFF, 0xFF, 0xFF, 0xFF, 0x54, 0x53, 0x6F, 0x75, 0x72, 0x63, 0x65, 0x20, 0x45, 0x6E, 0x67, 0x69, 0x6E, 0x65, 0x20, 0x51, 0x75, 0x65, 0x72, 0x79, 0x00]),
      // Alternative query format
      Buffer.from([0xFF, 0xFF, 0xFF, 0xFF, 0x55]),
      // Gamespy query (some Arma servers respond to this)
      Buffer.from([0xFE, 0xFD, 0x09, 0x00, 0x00, 0x00, 0x01]),
      // Simple ping for basic connectivity
      Buffer.from('ping'),
      // A2S_INFO query
      Buffer.from([0xFF, 0xFF, 0xFF, 0xFF, 0x54])
    ];

    // Send the first query
    client.send(arma3Queries[0], port, ip);
  });
}

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

// Main query function with proper Arma 3 server detection and multiple query types
async function queryArmaServer(ip, port, fallbackPorts = []) {
  const allPorts = [port, ...fallbackPorts];
  
  for (const testPort of allPorts) {
    try {
      console.log(`Trying Arma 3 query on ${ip}:${testPort}...`);
      
      // Try multiple query types for this port
      const queryTypes = [
        { name: 'Source Engine', packet: Buffer.from([0xFF, 0xFF, 0xFF, 0xFF, 0x54, 0x53, 0x6F, 0x75, 0x72, 0x63, 0x65, 0x20, 0x45, 0x6E, 0x67, 0x69, 0x6E, 0x65, 0x20, 0x51, 0x75, 0x65, 0x72, 0x79, 0x00]) },
        { name: 'A2S_INFO', packet: Buffer.from([0xFF, 0xFF, 0xFF, 0xFF, 0x54]) },
        { name: 'Gamespy', packet: Buffer.from([0xFE, 0xFD, 0x09, 0x00, 0x00, 0x00, 0x01]) },
        { name: 'Ping', packet: Buffer.from('ping') }
      ];
      
      for (const queryType of queryTypes) {
        try {
          console.log(`  Trying ${queryType.name} query...`);
          const result = await queryWithPacket(ip, testPort, queryType.packet);
          if (result.online) {
            return {
              ...result,
              actualPort: testPort,
              queryType: queryType.name
            };
          }
        } catch (error) {
          console.log(`  ${queryType.name} query failed:`, error.message);
          continue;
        }
      }
      
      // Fallback: test basic TCP connectivity
      const tcpOnline = await testTCPConnection(ip, testPort);
      if (tcpOnline) {
        return {
          online: true,
          players: 0,
          maxPlayers: 50,
          map: 'Unknown',
          hostname: `Server ${ip}:${testPort}`,
          note: 'Server online but all Arma 3 queries failed',
          actualPort: testPort
        };
      }
      
      // Additional fallback: test UDP port availability
      const udpAvailable = await testUDPPort(ip, testPort);
      if (udpAvailable) {
        return {
          online: true,
          players: 0,
          maxPlayers: 50,
          map: 'Unknown',
          hostname: `Server ${ip}:${testPort}`,
          note: 'Server online (UDP port open) but queries disabled',
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
    error: 'Server offline'
  };
}

// Helper function to send a specific query packet
async function queryWithPacket(ip, port, packet) {
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
        error: 'Query timeout'
      });
    }, 2000); // Shorter timeout for individual queries

    client.on('message', (msg) => {
      clearTimeout(timeout);
      client.close();
      
      try {
        const response = msg.toString('utf8');
        console.log(`    Raw response:`, response);
        
        // Parse response - handle different response formats
        let players = 0;
        let maxPlayers = 75;
        let map = 'Unknown';
        let hostname = 'Unknown';
        
        // Try different parsing approaches
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
          
          // Look for map name in various formats
          if (trimmed.toLowerCase().includes('map:') || trimmed.toLowerCase().includes('level:')) {
            const mapMatch = trimmed.match(/(?:map|level):\s*(.+)/i);
            if (mapMatch) {
              map = mapMatch[1].trim();
            }
          }
          
          // Look for hostname in various formats
          if (trimmed.toLowerCase().includes('hostname:') || trimmed.toLowerCase().includes('name:')) {
            const nameMatch = trimmed.match(/(?:hostname|name):\s*(.+)/i);
            if (nameMatch) {
              hostname = nameMatch[1].trim();
            }
          }
        });
        
        // If we got any response, the server is online
        resolve({
          online: true,
          players,
          maxPlayers,
          map,
          hostname
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
        error: 'Query failed'
      });
    });

    client.send(packet, port, ip);
  });
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
