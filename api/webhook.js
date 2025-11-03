import { verifyKeyMiddleware, InteractionType, InteractionResponseType } from 'discord-interactions';
import { PoapAPI } from '../src/poap-api.js';
import { Database } from '../src/database.js';
import { ENSResolver } from '../src/ens-resolver.js';

// Import command handlers
import myPoapsCommand from '../src/commands/my-poaps.js';
import poapInfoCommand from '../src/commands/poap-info.js';
import linkWalletCommand from '../src/commands/link-wallet.js';
import distributeCommand from '../src/commands/distribute-poap.js';
import poapGateCommand from '../src/commands/poap-gate.js';
import autoDistributeCommand from '../src/commands/auto-distribute.js';

// Initialize services
const poapAPI = new PoapAPI();
const database = new Database();
const ensResolver = new ENSResolver();

// Initialize database
await database.init();

// Command registry
const commands = new Map();
commands.set('my-poaps', myPoapsCommand);
commands.set('poap-info', poapInfoCommand);
commands.set('link-wallet', linkWalletCommand);
commands.set('distribute-poap', distributeCommand);
commands.set('poap-gate', poapGateCommand);
commands.set('auto-distribute', autoDistributeCommand);

export default async function handler(req, res) {
    // Only accept POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // Verify Discord signature
        const signature = req.headers['x-signature-ed25519'];
        const timestamp = req.headers['x-signature-timestamp'];
        const body = JSON.stringify(req.body);

        const isValidRequest = verifyKeyMiddleware(process.env.DISCORD_PUBLIC_KEY)(
            signature,
            timestamp,
            body
        );

        if (!isValidRequest) {
            return res.status(401).json({ error: 'Invalid signature' });
        }

        const interaction = req.body;

        // Handle ping for Discord verification
        if (interaction.type === InteractionType.PING) {
            return res.json({ type: InteractionResponseType.PONG });
        }

        // Handle slash commands
        if (interaction.type === InteractionType.APPLICATION_COMMAND) {
            const commandName = interaction.data.name;
            const command = commands.get(commandName);

            if (!command) {
                return res.json({
                    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                    data: {
                        content: '❌ Command not found!',
                        flags: 64 // Ephemeral
                    }
                });
            }

            try {
                // Create a mock interaction object that matches discord.js interface
                const mockInteraction = {
                    ...interaction,
                    reply: async (options) => {
                        return res.json({
                            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                            data: typeof options === 'string' ? { content: options } : options
                        });
                    },
                    editReply: async (options) => {
                        // For webhooks, we need to use followup messages
                        return res.json({
                            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                            data: typeof options === 'string' ? { content: options } : options
                        });
                    },
                    deferReply: async () => {
                        return res.json({
                            type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE
                        });
                    },
                    options: {
                        getString: (name) => {
                            const option = interaction.data.options?.find(opt => opt.name === name);
                            return option?.value || null;
                        }
                    }
                };

                // Execute the command
                await command.execute(mockInteraction, { poapAPI, database, ensResolver });

            } catch (error) {
                console.error('Command execution error:', error);
                return res.json({
                    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                    data: {
                        content: 'There was an error while executing this command!',
                        flags: 64 // Ephemeral
                    }
                });
            }
        }

        // If we get here, we didn't handle the interaction
        return res.status(400).json({ error: 'Unhandled interaction type' });

    } catch (error) {
        console.error('Webhook error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}