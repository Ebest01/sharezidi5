interface GeolocationData {
  ip: string;
  country: string;
  country_code: string;
  region: string;
  city: string;
  timezone: string;
  latitude: string;
  longitude: string;
  isp: string;
}

export class GeolocationService {
  private static readonly FREE_API_ENDPOINTS = [
    'http://ip-api.com/json/',
    'https://ipapi.co/{ip}/json/',
    'https://freegeoip.app/json/'
  ];

  /**
   * Get geolocation data for an IP address using free APIs
   */
  static async getLocationData(ip: string): Promise<Partial<GeolocationData> | null> {
    // Skip private/local IPs
    if (this.isPrivateIP(ip)) {
      return {
        ip,
        country: 'Local Network',
        country_code: 'LN',
        region: 'Private',
        city: 'Local',
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        latitude: '0',
        longitude: '0',
        isp: 'Private Network'
      };
    }

    // Try different free APIs
    for (const apiUrl of this.FREE_API_ENDPOINTS) {
      try {
        const url = apiUrl.includes('{ip}') ? apiUrl.replace('{ip}', ip) : apiUrl + ip;
        console.log(`[Geolocation] Fetching location for IP ${ip} from ${url}`);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        const response = await fetch(url, {
          signal: controller.signal,
          headers: {
            'User-Agent': 'ShareZidi/1.0'
          }
        });
        
        clearTimeout(timeoutId);

        if (!response.ok) continue;

        const data = await response.json();
        
        // Normalize different API response formats
        return this.normalizeLocationData(data, ip);
        
      } catch (error) {
        console.warn(`[Geolocation] API ${apiUrl} failed:`, error instanceof Error ? error.message : 'Unknown error');
        continue;
      }
    }

    console.warn(`[Geolocation] All APIs failed for IP ${ip}`);
    return { ip, country: 'Unknown', country_code: 'XX' };
  }

  /**
   * Extract real IP from request headers
   */
  static extractIPAddress(req: any): string {
    // Check various headers for real IP
    const forwardedFor = req.headers['x-forwarded-for'];
    const realIP = req.headers['x-real-ip'];
    const cfConnectingIP = req.headers['cf-connecting-ip'];
    
    if (forwardedFor) {
      // X-Forwarded-For can contain multiple IPs, take the first one
      return forwardedFor.split(',')[0].trim();
    }
    
    if (realIP) return realIP;
    if (cfConnectingIP) return cfConnectingIP;
    
    // Fall back to connection remote address
    return req.connection?.remoteAddress || req.socket?.remoteAddress || '127.0.0.1';
  }

  /**
   * Check if IP is private/local
   */
  private static isPrivateIP(ip: string): boolean {
    const privateRanges = [
      /^127\./, // 127.x.x.x (localhost)
      /^10\./, // 10.x.x.x
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // 172.16.x.x - 172.31.x.x
      /^192\.168\./, // 192.168.x.x
      /^::1$/, // IPv6 localhost
      /^fc00:/, // IPv6 private
      /^fe80:/ // IPv6 link-local
    ];

    return privateRanges.some(range => range.test(ip)) || ip === '::1';
  }

  /**
   * Normalize different API response formats
   */
  private static normalizeLocationData(data: any, ip: string): GeolocationData {
    return {
      ip,
      country: data.country || data.country_name || 'Unknown',
      country_code: data.country_code || data.countryCode || 'XX',
      region: data.region || data.regionName || data.region_name || '',
      city: data.city || '',
      timezone: data.timezone || data.time_zone || '',
      latitude: String(data.lat || data.latitude || '0'),
      longitude: String(data.lon || data.longitude || '0'),
      isp: data.isp || data.org || data.organization || ''
    };
  }

  /**
   * Generate session ID for visitor tracking
   */
  static generateSessionId(): string {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }
}