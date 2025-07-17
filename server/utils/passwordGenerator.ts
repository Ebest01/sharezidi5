/**
 * Password Generator Utility
 * Generates passwords in format: [A-Z{3}][0-9{5}][a-z{2}]
 * Example: AXZ23224mp
 */

export function generatePassword(): string {
  // Generate 3 uppercase letters
  const uppercase = Array.from({ length: 3 }, () => 
    String.fromCharCode(65 + Math.floor(Math.random() * 26))
  ).join('');
  
  // Generate 6 digits
  const digits = Array.from({ length: 6 }, () => 
    Math.floor(Math.random() * 10).toString()
  ).join('');
  
  // Generate 2 lowercase letters
  const lowercase = Array.from({ length: 2 }, () => 
    String.fromCharCode(97 + Math.floor(Math.random() * 26))
  ).join('');
  
  return uppercase + digits + lowercase;
}

export function extractUsernameFromEmail(email: string): string {
  return email.split('@')[0];
}

export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Generate Device ID using only uppercase letters and numbers [A-Z0-9]
 * This avoids visual confusion between "I", "1", and "l" in browser fonts
 * Example: "A3K8X2", "B7N4M9", "P2R6Q1"
 */
export function generateDeviceId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  return result;
}