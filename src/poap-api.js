import fetch from 'node-fetch';

export class PoapAPI {
    constructor() {
        this.apiKey = process.env.POAP_API_KEY;
        this.clientId = process.env.POAP_CLIENT_ID;
        this.clientSecret = process.env.POAP_CLIENT_SECRET;
        this.baseURL = 'https://api.poap.tech';
        this.authURL = 'https://auth.accounts.poap.xyz/oauth/token';
        this.accessToken = null;
        this.tokenExpiry = null;
    }

    async getAccessToken() {
        // Check if token is still valid (with 5min buffer)
        if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry - 300000) {
            return this.accessToken;
        }

        try {
            const response = await fetch(this.authURL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    audience: 'https://api.poap.tech',
                    grant_type: 'client_credentials',
                    client_id: this.clientId,
                    client_secret: this.clientSecret
                })
            });

            if (!response.ok) {
                throw new Error(`Auth failed: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            this.accessToken = data.access_token;
            this.tokenExpiry = Date.now() + (data.expires_in * 1000);
            
            console.log('✅ POAP access token refreshed');
            return this.accessToken;
        } catch (error) {
            console.error('Failed to get POAP access token:', error);
            throw error;
        }
    }

    async makeRequest(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const headers = {
            'X-API-Key': this.apiKey,
            'Content-Type': 'application/json',
            ...options.headers
        };

        // Add auth token for protected endpoints
        if (options.requiresAuth) {
            const token = await this.getAccessToken();
            headers['Authorization'] = `Bearer ${token}`;
        }

        try {
            const response = await fetch(url, {
                method: options.method || 'GET',
                headers,
                body: options.body ? JSON.stringify(options.body) : undefined
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`POAP API Error: ${response.status} ${response.statusText} - ${errorText}`);
            }

            return await response.json();
        } catch (error) {
            console.error(`POAP API request failed for ${endpoint}:`, error);
            throw error;
        }
    }

    // Get user's POAP collection
    async getUserPOAPs(address) {
        return await this.makeRequest(`/actions/scan/${address}`);
    }

    // Get event information
    async getEvent(eventId) {
        return await this.makeRequest(`/events/id/${eventId}`);
    }

    // Get mint links for an event (requires auth)
    async getMintLinks(eventId, secretCode) {
        return await this.makeRequest(`/event/${eventId}/qr-codes`, {
            method: 'POST',
            requiresAuth: true,
            body: { secret_code: secretCode }
        });
    }

    // Claim a POAP using mint link (requires auth)
    async claimPOAP(qrHash, address, secretCode) {
        return await this.makeRequest('/actions/claim-qr', {
            method: 'POST',
            requiresAuth: true,
            body: {
                qr_hash: qrHash,
                address: address,
                secret: secretCode
            }
        });
    }

    // Check mint link status
    async getMintLinkInfo(qrHash) {
        return await this.makeRequest(`/actions/claim-qr?qr_hash=${qrHash}`, {
            requiresAuth: true
        });
    }

    // Search events
    async searchEvents(query) {
        return await this.makeRequest(`/events?name=${encodeURIComponent(query)}`);
    }

    // Get event statistics
    async getEventStats(eventId) {
        return await this.makeRequest(`/events/${eventId}/poaps`);
    }
}