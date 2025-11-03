import { config } from 'dotenv';
config();

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

if (!DISCORD_TOKEN || !CLIENT_ID) {
    console.error('Missing DISCORD_TOKEN or CLIENT_ID in environment variables');
    process.exit(1);
}

const commands = [
    {
        name: 'my-poaps',
        description: 'View POAPs for an Ethereum address or ENS name',
        options: [
            {
                name: 'address',
                description: 'Ethereum address (0x...) or ENS name (vitalik.eth)',
                type: 3, // STRING type
                required: true
            }
        ]
    },
    {
        name: 'poaps',
        description: 'View POAPs for an Ethereum address or ENS name',
        options: [
            {
                name: 'address',
                description: 'Ethereum address (0x...) or ENS name (vitalik.eth)',
                type: 3, // STRING type
                required: true
            }
        ]
    }
];

async function registerCommands() {
    const url = `https://discord.com/api/v10/applications/${CLIENT_ID}/commands`;
    
    console.log('Registering Discord slash commands...');
    
    try {
        const response = await fetch(url, {
            method: 'PUT',
            headers: {
                'Authorization': `Bot ${DISCORD_TOKEN}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(commands),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        const data = await response.json();
        console.log('✅ Successfully registered commands:');
        data.forEach(command => {
            console.log(`  - /${command.name}: ${command.description}`);
        });
        
    } catch (error) {
        console.error('❌ Failed to register commands:', error.message);
        process.exit(1);
    }
}

registerCommands();