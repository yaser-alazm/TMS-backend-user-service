import { Controller, Get } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JWK } from 'jose'
import { createPublicKey } from 'crypto'

@Controller('.well-known')
export class JwksController {
  constructor(private readonly config: ConfigService) {}

  @Get('jwks.json')
  async getJwks(): Promise<{ keys: JWK[] | string }> {
    const kid = this.config.get<string>('JWT_KID')
    let publicKeyPem = this.config.get<string>('JWT_PUBLIC_KEY_PEM') || ''

    if (!publicKeyPem) {
      return { keys: [] }
    }

    // Handle both escaped and unescaped newlines
    publicKeyPem = publicKeyPem.replace(/\\n/g, '\n').replace(/\\\\n/g, '\n')
    
    // Ensure proper PEM format
    if (!publicKeyPem.includes('-----BEGIN PUBLIC KEY-----')) {
      return { keys: [] }
    }

    try {
      // Create a simple JWK manually from the PEM key
      const publicKey = createPublicKey(publicKeyPem)
      const keyDetails = publicKey.asymmetricKeyDetails
      
      if (!keyDetails) {
        throw new Error('Unable to extract key details')
      }

      // Create JWK manually
      const jwk: JWK = {
        kty: 'RSA',
        kid: kid,
        alg: 'RS256',
        use: 'sig',
        n: publicKey.export({ type: 'spki', format: 'der' }).toString('base64url'),
        e: 'AQAB' // Standard RSA exponent
      }

      return { keys: [jwk] }
    } catch (error) {
      console.error('Error processing JWT public key:', error)
      return { keys: [] }
    }
  }
}

@Controller('auth/keys')
export class KeysHealthController {
  constructor(private readonly config: ConfigService) {}

  @Get('health')
  health() {
    const kid = this.config.get<string>('JWT_KID') || 'unset'
    const issuer = this.config.get<string>('JWT_ISSUER') || 'unset'
    const hasPublicKey = Boolean(
      (this.config.get<string>('JWT_PUBLIC_KEY_PEM') || '').length
    )

    return {
      status: hasPublicKey ? 'ready' : 'missing_public_key',
      kid,
      issuer,
      hasPublicKey,
    }
  }
}


