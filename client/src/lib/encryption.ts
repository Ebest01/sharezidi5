import { EventEmitter } from 'events';

export interface EncryptionKey {
  publicKey: string;
  privateKey: string;
  keyId: string;
  algorithm: string;
}

export interface EncryptedChunk {
  data: string;
  iv: string;
  tag: string;
  keyId: string;
  chunkIndex: number;
}

export interface KeyExchange {
  type: 'key-exchange';
  publicKey: string;
  keyId: string;
  algorithm: string;
  timestamp: number;
}

export class FileEncryption extends EventEmitter {
  private keys: Map<string, EncryptionKey> = new Map();
  private currentKeyId: string | null = null;
  private keyExchangeTimeout: NodeJS.Timeout | null = null;

  constructor() {
    super();
    this.generateKeyPair();
  }

  // Generate new key pair
  async generateKeyPair(): Promise<EncryptionKey> {
    try {
      const keyPair = await crypto.subtle.generateKey(
        {
          name: 'RSA-OAEP',
          modulusLength: 2048,
          publicExponent: new Uint8Array([1, 0, 1]),
          hash: 'SHA-256'
        },
        true,
        ['encrypt', 'decrypt']
      );

      const publicKeyBuffer = await crypto.subtle.exportKey('spki', keyPair.publicKey);
      const privateKeyBuffer = await crypto.subtle.exportKey('pkcs8', keyPair.privateKey);

      const keyId = this.generateKeyId();
      const encryptionKey: EncryptionKey = {
        publicKey: this.arrayBufferToBase64(publicKeyBuffer),
        privateKey: this.arrayBufferToBase64(privateKeyBuffer),
        keyId,
        algorithm: 'RSA-OAEP'
      };

      this.keys.set(keyId, encryptionKey);
      this.currentKeyId = keyId;

      this.emit('key-generated', encryptionKey);
      return encryptionKey;
    } catch (error) {
      console.error('[Encryption] Failed to generate key pair:', error);
      throw error;
    }
  }

  // Encrypt file chunk
  async encryptChunk(
    chunk: ArrayBuffer,
    chunkIndex: number,
    recipientPublicKey?: string
  ): Promise<EncryptedChunk> {
    try {
      // Generate random IV for this chunk
      const iv = crypto.getRandomValues(new Uint8Array(12));
      
      // Generate random AES key for this chunk
      const aesKey = await crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
      );

      // Encrypt chunk with AES-GCM
      const encryptedData = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        aesKey,
        chunk
      );

      // Encrypt AES key with recipient's public key (if provided)
      let encryptedAesKey: string;
      if (recipientPublicKey) {
        const publicKey = await this.importPublicKey(recipientPublicKey);
        const encryptedKey = await crypto.subtle.encrypt(
          { name: 'RSA-OAEP' },
          publicKey,
          await crypto.subtle.exportKey('raw', aesKey)
        );
        encryptedAesKey = this.arrayBufferToBase64(encryptedKey);
      } else {
        // Use our own public key for encryption
        const currentKey = this.keys.get(this.currentKeyId!);
        if (!currentKey) throw new Error('No encryption key available');
        
        const publicKey = await this.importPublicKey(currentKey.publicKey);
        const encryptedKey = await crypto.subtle.encrypt(
          { name: 'RSA-OAEP' },
          publicKey,
          await crypto.subtle.exportKey('raw', aesKey)
        );
        encryptedAesKey = this.arrayBufferToBase64(encryptedKey);
      }

      // Generate authentication tag
      const tag = await this.generateTag(encryptedData, iv);

      return {
        data: this.arrayBufferToBase64(encryptedData),
        iv: this.arrayBufferToBase64(iv),
        tag: this.arrayBufferToBase64(tag),
        keyId: this.currentKeyId!,
        chunkIndex
      };
    } catch (error) {
      console.error('[Encryption] Failed to encrypt chunk:', error);
      throw error;
    }
  }

  // Decrypt file chunk
  async decryptChunk(encryptedChunk: EncryptedChunk): Promise<ArrayBuffer> {
    try {
      const key = this.keys.get(encryptedChunk.keyId);
      if (!key) {
        throw new Error(`Encryption key not found: ${encryptedChunk.keyId}`);
      }

      // Import private key
      const privateKey = await this.importPrivateKey(key.privateKey);

      // Decrypt AES key
      const encryptedAesKeyBuffer = this.base64ToArrayBuffer(encryptedChunk.data);
      const aesKeyBuffer = await crypto.subtle.decrypt(
        { name: 'RSA-OAEP' },
        privateKey,
        encryptedAesKeyBuffer
      );

      // Import AES key
      const aesKey = await crypto.subtle.importKey(
        'raw',
        aesKeyBuffer,
        { name: 'AES-GCM' },
        false,
        ['decrypt']
      );

      // Decrypt chunk
      const iv = this.base64ToArrayBuffer(encryptedChunk.iv);
      const encryptedData = this.base64ToArrayBuffer(encryptedChunk.data);
      const tag = this.base64ToArrayBuffer(encryptedChunk.tag);

      const decryptedData = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv, tagLength: 128 },
        aesKey,
        encryptedData
      );

      return decryptedData;
    } catch (error) {
      console.error('[Encryption] Failed to decrypt chunk:', error);
      throw error;
    }
  }

  // Perform key exchange
  async performKeyExchange(recipientPublicKey: string): Promise<KeyExchange> {
    const currentKey = this.keys.get(this.currentKeyId!);
    if (!currentKey) {
      throw new Error('No encryption key available');
    }

    const keyExchange: KeyExchange = {
      type: 'key-exchange',
      publicKey: currentKey.publicKey,
      keyId: currentKey.keyId,
      algorithm: currentKey.algorithm,
      timestamp: Date.now()
    };

    this.emit('key-exchange-initiated', keyExchange);
    return keyExchange;
  }

  // Handle incoming key exchange
  async handleKeyExchange(keyExchange: KeyExchange): Promise<void> {
    try {
      // Import and store the public key
      const publicKey = await this.importPublicKey(keyExchange.publicKey);
      
      // Store the key for future use
      const encryptionKey: EncryptionKey = {
        publicKey: keyExchange.publicKey,
        privateKey: '', // We don't have the private key
        keyId: keyExchange.keyId,
        algorithm: keyExchange.algorithm
      };

      this.keys.set(keyExchange.keyId, encryptionKey);
      this.emit('key-exchange-received', keyExchange);
    } catch (error) {
      console.error('[Encryption] Failed to handle key exchange:', error);
      throw error;
    }
  }

  // Generate file checksum
  async generateFileChecksum(file: File): Promise<string> {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    return this.arrayBufferToBase64(hashBuffer);
  }

  // Verify file integrity
  async verifyFileIntegrity(
    file: File,
    expectedChecksum: string
  ): Promise<boolean> {
    const actualChecksum = await this.generateFileChecksum(file);
    return actualChecksum === expectedChecksum;
  }

  // Get current public key
  getCurrentPublicKey(): string | null {
    const currentKey = this.keys.get(this.currentKeyId!);
    return currentKey?.publicKey || null;
  }

  // Get current key ID
  getCurrentKeyId(): string | null {
    return this.currentKeyId;
  }

  // Import public key from base64
  private async importPublicKey(publicKeyBase64: string): Promise<CryptoKey> {
    const publicKeyBuffer = this.base64ToArrayBuffer(publicKeyBase64);
    return await crypto.subtle.importKey(
      'spki',
      publicKeyBuffer,
      {
        name: 'RSA-OAEP',
        hash: 'SHA-256'
      },
      false,
      ['encrypt']
    );
  }

  // Import private key from base64
  private async importPrivateKey(privateKeyBase64: string): Promise<CryptoKey> {
    const privateKeyBuffer = this.base64ToArrayBuffer(privateKeyBase64);
    return await crypto.subtle.importKey(
      'pkcs8',
      privateKeyBuffer,
      {
        name: 'RSA-OAEP',
        hash: 'SHA-256'
      },
      false,
      ['decrypt']
    );
  }

  // Generate authentication tag
  private async generateTag(data: ArrayBuffer, iv: Uint8Array): Promise<ArrayBuffer> {
    // In a real implementation, this would generate a proper authentication tag
    // For now, we'll create a simple hash
    const combined = new Uint8Array(data.byteLength + iv.length);
    combined.set(new Uint8Array(data));
    combined.set(iv, data.byteLength);
    
    return await crypto.subtle.digest('SHA-256', combined);
  }

  // Generate unique key ID
  private generateKeyId(): string {
    return 'key-' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
  }

  // Convert ArrayBuffer to base64
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  // Convert base64 to ArrayBuffer
  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }

  // Cleanup
  destroy(): void {
    if (this.keyExchangeTimeout) {
      clearTimeout(this.keyExchangeTimeout);
    }
    this.keys.clear();
    this.removeAllListeners();
  }
}
