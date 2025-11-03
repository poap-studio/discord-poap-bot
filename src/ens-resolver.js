import { ethers } from 'ethers';

export class ENSResolver {
    constructor() {
        // Use multiple providers as fallback
        this.providers = [
            'https://eth.llamarpc.com',
            'https://rpc.ankr.com/eth',
            'https://eth.public-rpc.com',
            'https://ethereum.publicnode.com',
            'https://cloudflare-eth.com',
            'https://mainnet.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161'
        ];
        this.currentProvider = null;
        this.initProvider();
    }
    
    async initProvider() {
        for (const url of this.providers) {
            try {
                const provider = new ethers.JsonRpcProvider(url);
                // Test the provider
                await provider.getBlockNumber();
                this.currentProvider = provider;
                console.log(`✅ ENS provider connected: ${url}`);
                return;
            } catch (error) {
                console.log(`❌ Failed to connect to ${url}`);
                continue;
            }
        }
        console.log('⚠️ No ENS providers available - ENS resolution disabled');
    }

    /**
     * Resolve an address (ENS name or Ethereum address) to a standard Ethereum address
     * @param {string} addressOrENS - Either an ENS name (vitalik.eth) or Ethereum address (0x...)
     * @returns {Promise<string>} - Resolved Ethereum address
     */
    async resolveAddress(addressOrENS) {
        if (!addressOrENS) {
            throw new Error('Address or ENS name is required');
        }

        const input = addressOrENS.trim();

        // Check if it's already a valid Ethereum address
        if (this.isValidEthereumAddress(input)) {
            return input.toLowerCase();
        }

        // Check if it looks like an ENS name
        if (this.isENSName(input)) {
            // Check if provider is available
            if (!this.currentProvider) {
                throw new Error(`ENS resolution unavailable for "${input}". Please use the Ethereum address directly.`);
            }
            
            try {
                // Add timeout to ENS resolution
                const resolvePromise = this.currentProvider.resolveName(input);
                const timeoutPromise = new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('ENS resolution timeout')), 15000)
                );
                
                const resolved = await Promise.race([resolvePromise, timeoutPromise]);
                if (!resolved) {
                    throw new Error(`ENS name "${input}" could not be resolved`);
                }
                return resolved.toLowerCase();
            } catch (error) {
                console.error('ENS resolution error:', error);
                if (error.message.includes('timeout')) {
                    throw new Error(`ENS resolution timed out for "${input}". Try using the address directly.`);
                }
                throw new Error(`Failed to resolve ENS name "${input}": ${error.message}`);
            }
        }

        throw new Error(`"${input}" is not a valid Ethereum address or ENS name`);
    }

    /**
     * Check if a string is a valid Ethereum address
     * @param {string} address - Address to validate
     * @returns {boolean} - True if valid Ethereum address
     */
    isValidEthereumAddress(address) {
        return /^0x[a-fA-F0-9]{40}$/.test(address);
    }

    /**
     * Check if a string looks like an ENS name
     * @param {string} name - Name to check
     * @returns {boolean} - True if it looks like an ENS name
     */
    isENSName(name) {
        // ENS names typically end with .eth, but can have other TLDs
        // Basic validation: contains a dot and reasonable characters
        return /^[a-zA-Z0-9-]+\.[a-zA-Z]{2,}$/.test(name) && 
               name.length >= 3 && 
               name.length <= 255;
    }

    /**
     * Get display name for an address (tries to reverse resolve to ENS)
     * @param {string} address - Ethereum address
     * @returns {Promise<string>} - ENS name if available, otherwise shortened address
     */
    async getDisplayName(address) {
        try {
            if (!this.isValidEthereumAddress(address)) {
                return address;
            }

            // Skip ENS lookup if no provider
            if (this.currentProvider) {
                const ensName = await this.currentProvider.lookupAddress(address);
                if (ensName) {
                    return ensName;
                }
            }

            // Return shortened address if no ENS or no provider
            return `${address.slice(0, 6)}...${address.slice(-4)}`;
        } catch (error) {
            console.error('Reverse ENS lookup error:', error);
            return `${address.slice(0, 6)}...${address.slice(-4)}`;
        }
    }

    /**
     * Validate and normalize an address input
     * @param {string} input - User input (ENS or address)
     * @returns {Promise<{address: string, displayName: string, wasENS: boolean}>}
     */
    async validateAndResolve(input) {
        const wasENS = this.isENSName(input);
        const address = await this.resolveAddress(input);
        const displayName = wasENS ? input : await this.getDisplayName(address);

        return {
            address,
            displayName,
            wasENS
        };
    }
}