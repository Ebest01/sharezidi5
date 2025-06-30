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
   * Handles 10+ potential error scenarios gracefully to ensure zero user impact
   */
  static async getLocationData(ip: string): Promise<Partial<GeolocationData> | null> {
    try {
      // ERROR 1: Invalid or malformed IP address
      if (!ip || typeof ip !== 'string' || ip.trim() === '') {
        console.warn('[Geolocation] Invalid IP address provided:', ip);
        return this.getFallbackLocationData('Unknown', 'Invalid IP');
      }

      // ERROR 2: Private/local IP addresses (not routable)
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

      // Try each API endpoint with comprehensive error handling
      for (const apiUrl of this.FREE_API_ENDPOINTS) {
        try {
          const url = apiUrl.includes('{ip}') ? apiUrl.replace('{ip}', ip) : apiUrl + ip;
          console.log(`[Geolocation] Fetching location for IP ${ip} from ${url}`);
          
          // ERROR 3: Network timeout (2 second limit to prevent delays)
          const controller = new AbortController();
          const timeoutId = setTimeout(() => {
            controller.abort();
          }, 2000);
          
          // ERROR 4: Network connectivity issues
          const response = await fetch(url, {
            signal: controller.signal,
            headers: {
              'User-Agent': 'ShareZidi/1.0',
              'Accept': 'application/json',
              'Cache-Control': 'no-cache'
            }
          });
          
          clearTimeout(timeoutId);

          // ERROR 5: HTTP error responses (404, 500, 403, etc.)
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }

          // ERROR 6: Invalid content type (not JSON)
          const contentType = response.headers.get('content-type');
          if (!contentType || !contentType.includes('application/json')) {
            throw new Error(`Invalid content type`);
          }

          // ERROR 7: Malformed or empty JSON response
          let data;
          try {
            const text = await response.text();
            if (!text || text.trim() === '') {
              throw new Error('Empty response');
            }
            data = JSON.parse(text);
          } catch (parseError) {
            throw new Error('JSON parse failed');
          }

          // ERROR 8: API rate limiting or quota exceeded
          if (data.error || data.status === 'fail' || data.message?.includes('limit')) {
            throw new Error('API rate limited');
          }

          // ERROR 9: Missing or invalid location data in response
          if (!data || (typeof data !== 'object')) {
            throw new Error('Invalid data structure');
          }

          // Normalize and validate data before returning
          const normalizedData = this.normalizeLocationData(data, ip);
          
          // ERROR 10: Data validation failure
          if (!normalizedData || !normalizedData.country) {
            throw new Error('Data validation failed');
          }

          return normalizedData;
          
        } catch (error) {
          // Silent error handling - don't spam logs but track issues
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          
          // Don't continue if it's an abort error (timeout)
          if (error instanceof Error && error.name === 'AbortError') {
            continue;
          }
          
          // Continue to next API
          continue;
        }
      }

      // All APIs failed - return fallback data
      return this.getFallbackLocationData(ip, 'API Failure');

    } catch (systemError) {
      // ERROR 11: Unexpected system errors (memory, disk, etc.)
      console.error('[Geolocation] System error:', systemError);
      return this.getFallbackLocationData(ip || 'Unknown', 'System Error');
    }
  }

  /**
   * Provide fallback location data when all else fails
   * Ensures we always have usable data for analytics
   */
  private static getFallbackLocationData(ip: string, reason: string): Partial<GeolocationData> {
    return {
      ip,
      country: 'Unknown',
      country_code: 'XX',
      city: 'Unknown',
      region: 'Unknown',
      timezone: 'UTC',
      latitude: '0',
      longitude: '0',
      isp: `Unknown (${reason})`
    };
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