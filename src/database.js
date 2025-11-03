import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

export class Database {
    constructor() {
        this.db = null;
    }

    async init() {
        this.db = await open({
            filename: process.env.DATABASE_PATH,
            driver: sqlite3.Database
        });

        // Create tables
        await this.createTables();
        console.log('✅ Database initialized');
    }

    async createTables() {
        // User wallet mappings
        await this.db.exec(`
            CREATE TABLE IF NOT EXISTS user_wallets (
                discord_user_id TEXT PRIMARY KEY,
                ethereum_address TEXT NOT NULL,
                verified BOOLEAN DEFAULT FALSE,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // POAP distribution tracking
        await this.db.exec(`
            CREATE TABLE IF NOT EXISTS poap_distributions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                discord_user_id TEXT NOT NULL,
                guild_id TEXT NOT NULL,
                event_id INTEGER NOT NULL,
                qr_hash TEXT,
                status TEXT DEFAULT 'pending',
                distributed_by TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                claimed_at DATETIME
            )
        `);

        // Auto-distribution rules
        await this.db.exec(`
            CREATE TABLE IF NOT EXISTS auto_distribution_rules (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                guild_id TEXT NOT NULL,
                event_id INTEGER NOT NULL,
                trigger_type TEXT NOT NULL,
                trigger_data TEXT,
                secret_code TEXT,
                active BOOLEAN DEFAULT TRUE,
                created_by TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // POAP gate configurations
        await this.db.exec(`
            CREATE TABLE IF NOT EXISTS poap_gates (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                guild_id TEXT NOT NULL,
                channel_id TEXT,
                role_id TEXT,
                required_poap_ids TEXT NOT NULL,
                gate_type TEXT NOT NULL,
                created_by TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Event cache
        await this.db.exec(`
            CREATE TABLE IF NOT EXISTS event_cache (
                event_id INTEGER PRIMARY KEY,
                event_data TEXT NOT NULL,
                cached_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
    }

    // User wallet management
    async linkWallet(discordUserId, ethereumAddress) {
        await this.db.run(
            'INSERT OR REPLACE INTO user_wallets (discord_user_id, ethereum_address, verified) VALUES (?, ?, ?)',
            [discordUserId, ethereumAddress.toLowerCase(), false]
        );
    }

    async getUserWallet(discordUserId) {
        return await this.db.get(
            'SELECT * FROM user_wallets WHERE discord_user_id = ?',
            [discordUserId]
        );
    }

    async verifyWallet(discordUserId) {
        await this.db.run(
            'UPDATE user_wallets SET verified = TRUE WHERE discord_user_id = ?',
            [discordUserId]
        );
    }

    // POAP distribution tracking
    async recordDistribution(discordUserId, guildId, eventId, qrHash, distributedBy) {
        const result = await this.db.run(
            'INSERT INTO poap_distributions (discord_user_id, guild_id, event_id, qr_hash, distributed_by) VALUES (?, ?, ?, ?, ?)',
            [discordUserId, guildId, eventId, qrHash, distributedBy]
        );
        return result.lastID;
    }

    async updateDistributionStatus(distributionId, status, claimedAt = null) {
        await this.db.run(
            'UPDATE poap_distributions SET status = ?, claimed_at = ? WHERE id = ?',
            [status, claimedAt, distributionId]
        );
    }

    async getUserDistributions(discordUserId, guildId = null) {
        const query = guildId 
            ? 'SELECT * FROM poap_distributions WHERE discord_user_id = ? AND guild_id = ? ORDER BY created_at DESC'
            : 'SELECT * FROM poap_distributions WHERE discord_user_id = ? ORDER BY created_at DESC';
        
        const params = guildId ? [discordUserId, guildId] : [discordUserId];
        return await this.db.all(query, params);
    }

    // Auto-distribution rules
    async createAutoDistributionRule(guildId, eventId, triggerType, triggerData, secretCode, createdBy) {
        const result = await this.db.run(
            'INSERT INTO auto_distribution_rules (guild_id, event_id, trigger_type, trigger_data, secret_code, created_by) VALUES (?, ?, ?, ?, ?, ?)',
            [guildId, eventId, triggerType, triggerData, secretCode, createdBy]
        );
        return result.lastID;
    }

    async getAutoDistributionRules(guildId, active = true) {
        return await this.db.all(
            'SELECT * FROM auto_distribution_rules WHERE guild_id = ? AND active = ?',
            [guildId, active]
        );
    }

    async toggleAutoDistributionRule(ruleId, active) {
        await this.db.run(
            'UPDATE auto_distribution_rules SET active = ? WHERE id = ?',
            [active, ruleId]
        );
    }

    // POAP gates
    async createPOAPGate(guildId, channelId, roleId, requiredPoapIds, gateType, createdBy) {
        const result = await this.db.run(
            'INSERT INTO poap_gates (guild_id, channel_id, role_id, required_poap_ids, gate_type, created_by) VALUES (?, ?, ?, ?, ?, ?)',
            [guildId, channelId, roleId, JSON.stringify(requiredPoapIds), gateType, createdBy]
        );
        return result.lastID;
    }

    async getPOAPGates(guildId, gateType = null) {
        const query = gateType
            ? 'SELECT * FROM poap_gates WHERE guild_id = ? AND gate_type = ?'
            : 'SELECT * FROM poap_gates WHERE guild_id = ?';
        
        const params = gateType ? [guildId, gateType] : [guildId];
        const gates = await this.db.all(query, params);
        
        return gates.map(gate => ({
            ...gate,
            required_poap_ids: JSON.parse(gate.required_poap_ids)
        }));
    }

    async deletePOAPGate(gateId) {
        await this.db.run('DELETE FROM poap_gates WHERE id = ?', [gateId]);
    }

    // Event cache
    async cacheEvent(eventId, eventData) {
        await this.db.run(
            'INSERT OR REPLACE INTO event_cache (event_id, event_data) VALUES (?, ?)',
            [eventId, JSON.stringify(eventData)]
        );
    }

    async getCachedEvent(eventId) {
        const cached = await this.db.get(
            'SELECT * FROM event_cache WHERE event_id = ? AND datetime(cached_at, \"+1 hour\") > datetime(\"now\")',
            [eventId]
        );
        
        return cached ? JSON.parse(cached.event_data) : null;
    }
}