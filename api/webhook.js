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

        // Verify Discord signature
        const isValidRequest = verifyKey(
            body,
            signature,
            timestamp,
            process.env.DISCORD_PUBLIC_KEY
        );

        if (!isValidRequest) {
            console.error('Signature verification failed');
            return res.status(401).json({ error: 'Invalid signature' });
        }

        const interaction = req.body;

        // Handle ping for Discord verification
        if (interaction.type === InteractionType.PING) {
            console.log('Received PING, responding with PONG');
            return res.json({ type: InteractionResponseType.PONG });
        }

        // Handle slash commands
        if (interaction.type === InteractionType.APPLICATION_COMMAND) {
            return res.json({
                type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                data: {
                    content: '🎫 POAP Bot is working! Full functionality will be restored shortly.',
                }
            });
        }

        // If we get here, we didn't handle the interaction
        return res.status(400).json({ error: 'Unhandled interaction type' });

    } catch (error) {
        console.error('Webhook error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}