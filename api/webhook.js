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

        console.log('Headers:', {
            signature: signature ? 'present' : 'missing',
            timestamp: timestamp ? 'present' : 'missing',
            publicKey: process.env.DISCORD_PUBLIC_KEY ? 'present' : 'missing'
        });

        // Check if we have the required headers and public key
        if (!signature || !timestamp) {
            console.error('Missing required headers');
            return res.status(400).json({ error: 'Missing signature headers' });
        }

        if (!process.env.DISCORD_PUBLIC_KEY) {
            console.error('Missing DISCORD_PUBLIC_KEY environment variable');
            return res.status(500).json({ error: 'Missing public key' });
        }

        // Verify Discord signature
        let isValidRequest;
        try {
            isValidRequest = verifyKey(
                body,
                signature,
                timestamp,
                process.env.DISCORD_PUBLIC_KEY
            );
        } catch (verifyError) {
            console.error('Signature verification error:', verifyError);
            return res.status(401).json({ error: 'Signature verification failed' });
        }

        if (!isValidRequest) {
            console.error('Invalid signature');
            return res.status(401).json({ error: 'Invalid signature' });
        }

        const interaction = req.body;
        console.log('Interaction type:', interaction.type);

        // Handle ping for Discord verification
        if (interaction.type === InteractionType.PING) {
            console.log('Received PING, responding with PONG');
            return res.json({ type: InteractionResponseType.PONG });
        }

        // Handle slash commands
        if (interaction.type === InteractionType.APPLICATION_COMMAND) {
            console.log('Received command:', interaction.data?.name);
            return res.json({
                type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                data: {
                    content: '🎫 POAP Bot is working! Webhook verification successful.',
                }
            });
        }

        // If we get here, we didn't handle the interaction
        console.log('Unhandled interaction type:', interaction.type);
        return res.status(400).json({ error: 'Unhandled interaction type' });

    } catch (error) {
        console.error('Webhook error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}