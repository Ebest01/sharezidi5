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