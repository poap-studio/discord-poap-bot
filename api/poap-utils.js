// Simple POAP API utilities for serverless environment
export class PoapAPI {
    constructor() {
        this.apiKey = process.env.POAP_API_KEY;
        this.clientId = process.env.POAP_CLIENT_ID;
        this.clientSecret = process.env.POAP_CLIENT_SECRET;
        this.baseUrl = 'https://api.poap.tech';
        this.accessToken = null;
    }

    async getAccessToken() {
        if (this.accessToken) return this.accessToken;

        try {
            const response = await fetch('https://auth.accounts.poap.xyz/oauth/token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-Key': this.apiKey
                },
                body: JSON.stringify({
                    audience: 'https://api.poap.tech',
                    grant_type: 'client_credentials',
                    client_id: this.clientId,
                    client_secret: this.clientSecret
                })
            });

            if (!response.ok) {
                throw new Error(`OAuth failed: ${response.status}`);
            }

            const data = await response.json();
            this.accessToken = data.access_token;
            return this.accessToken;
        } catch (error) {
            console.error('Failed to get access token:', error);
            throw error;
        }
    }

    async getUserPOAPs(address) {
        try {
            // Simple validation
            if (!address || (!address.startsWith('0x') && !address.endsWith('.eth'))) {
                throw new Error('Invalid address format');
            }

            // Use simple API key authentication - no OAuth needed for scan endpoint
            const response = await fetch(`${this.baseUrl}/actions/scan/${address}`, {
                headers: {
                    'X-API-Key': this.apiKey
                }
            });

            if (!response.ok) {
                throw new Error(`POAP API error: ${response.status}`);
            }

            const poaps = await response.json();
            return Array.isArray(poaps) ? poaps : [];
        } catch (error) {
            console.error('Failed to fetch POAPs:', error);
            throw error;
        }
    }
}

// ENS resolution utility
export async function resolveENS(nameOrAddress) {
    if (nameOrAddress.startsWith('0x')) {
        return nameOrAddress; // Already an address
    }

    if (nameOrAddress.endsWith('.eth')) {
        try {
            // Use a public ENS resolver
            const response = await fetch(`https://api.ensdata.net/${nameOrAddress}`);
            if (response.ok) {
                const data = await response.json();
                return data.address || nameOrAddress;
            }
        } catch (error) {
            console.error('ENS resolution failed:', error);
        }
    }

    return nameOrAddress; // Return as-is if resolution fails
}