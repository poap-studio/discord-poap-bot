import { REST, Routes } from 'discord.js';
import { config } from 'dotenv';

config();

export async function registerCommands() {
    const commands = [
        {
            name: 'link-wallet',
            description: 'Link your Ethereum wallet to receive POAPs',
            options: [{
                name: 'address',
                description: 'Your Ethereum wallet address (0x...) or ENS name (vitalik.eth)',
                type: 3, // STRING
                required: true
            }]
        },
        {
            name: 'my-poaps',
            description: 'View your POAP collection',
            options: [{
                name: 'address',
                description: 'Ethereum address (0x...) or ENS name (vitalik.eth) to check (optional)',
                type: 3, // STRING
                required: false
            }]
        },
        {
            name: 'poap-info',
            description: 'Get information about a POAP event',
            options: [{
                name: 'event-id',
                description: 'POAP event ID',
                type: 4, // INTEGER
                required: true
            }]
        },
        {
            name: 'distribute-poap',
            description: 'Distribute POAP to a user (Admin only)',
            options: [
                {
                    name: 'user',
                    description: 'User to receive the POAP',
                    type: 6, // USER
                    required: true
                },
                {
                    name: 'event-id',
                    description: 'POAP event ID',
                    type: 4, // INTEGER
                    required: true
                },
                {
                    name: 'secret-code',
                    description: 'Event secret code',
                    type: 3, // STRING
                    required: true
                }
            ]
        },
        {
            name: 'poap-gate',
            description: 'Manage POAP-based access control (Admin only)',
            options: [
                {
                    name: 'action',
                    description: 'Action to perform',
                    type: 3, // STRING
                    required: true,
                    choices: [
                        { name: 'create-role-gate', value: 'create_role' },
                        { name: 'create-channel-gate', value: 'create_channel' },
                        { name: 'list-gates', value: 'list' },
                        { name: 'remove-gate', value: 'remove' }
                    ]
                },
                {
                    name: 'target',
                    description: 'Role or channel to gate',
                    type: 3, // STRING
                    required: false
                },
                {
                    name: 'poap-ids',
                    description: 'Required POAP IDs (comma-separated)',
                    type: 3, // STRING
                    required: false
                },
                {
                    name: 'gate-id',
                    description: 'Gate ID to remove',
                    type: 4, // INTEGER
                    required: false
                }
            ]
        },
        {
            name: 'auto-distribute',
            description: 'Set up automatic POAP distribution (Admin only)',
            options: [
                {
                    name: 'action',
                    description: 'Action to perform',
                    type: 3, // STRING
                    required: true,
                    choices: [
                        { name: 'create-rule', value: 'create' },
                        { name: 'list-rules', value: 'list' },
                        { name: 'toggle-rule', value: 'toggle' }
                    ]
                },
                {
                    name: 'trigger',
                    description: 'Distribution trigger',
                    type: 3, // STRING
                    required: false,
                    choices: [
                        { name: 'member-join', value: 'member_join' },
                        { name: 'reaction-add', value: 'reaction_add' },
                        { name: 'message-sent', value: 'message_sent' }
                    ]
                },
                {
                    name: 'event-id',
                    description: 'POAP event ID',
                    type: 4, // INTEGER
                    required: false
                },
                {
                    name: 'secret-code',
                    description: 'Event secret code',
                    type: 3, // STRING
                    required: false
                },
                {
                    name: 'rule-id',
                    description: 'Rule ID to toggle',
                    type: 4, // INTEGER
                    required: false
                }
            ]
        }
    ];

    const rest = new REST().setToken(process.env.DISCORD_TOKEN);

    try {
        console.log('Started refreshing application (/) commands.');

        await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID),
            { body: commands },
        );

        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error('Error registering commands:', error);
    }
}