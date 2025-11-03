import { verifyKey, InteractionType, InteractionResponseType } from 'discord-interactions';

export default async function handler(req, res) {
    // Only accept POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const signature = req.headers['x-signature-ed25519'];
        const timestamp = req.headers['x-signature-timestamp'];
        const body = JSON.stringify(req.body);

        console.log('Discord interaction request received');
        console.log('Headers present:', {
            signature: !!signature,
            timestamp: !!timestamp,
            publicKey: !!process.env.DISCORD_PUBLIC_KEY
        });

        // Verify Discord signature
        const isValidRequest = verifyKey(
            body,
            signature,
            timestamp,
            process.env.DISCORD_PUBLIC_KEY
        );

        if (!isValidRequest) {
            console.error('Invalid signature verification');
            return res.status(401).json({ error: 'Invalid signature' });
        }

        const interaction = req.body;
        console.log('Interaction type:', interaction.type);

        // Handle ping for Discord verification
        if (interaction.type === InteractionType.PING) {
            console.log('✅ PING received, responding with PONG');
            return res.json({ type: InteractionResponseType.PONG });
        }

        // Handle slash commands
        if (interaction.type === InteractionType.APPLICATION_COMMAND) {
            console.log('✅ Command received:', interaction.data?.name);
            return res.json({
                type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                data: {
                    content: '🎫 POAP Bot verification successful! Webhook is working.',
                }
            });
        }

        return res.status(400).json({ error: 'Unhandled interaction type' });

    } catch (error) {
        console.error('Webhook error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}