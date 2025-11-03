import { verifyKey, InteractionType, InteractionResponseType } from 'discord-interactions';
import { PoapAPI, resolveENS } from './poap-utils.js';

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
            const commandName = interaction.data?.name;
            console.log('Received command:', commandName);
            console.log('Command data:', JSON.stringify(interaction.data, null, 2));

            if (commandName === 'poaps' || commandName === 'my-poaps') {
                const addressOption = interaction.data.options?.find(opt => opt.name === 'address');
                const address = addressOption?.value;

                console.log('Address option:', addressOption);
                console.log('Address value:', address);

                if (!address) {
                    return res.json({
                        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                        data: {
                            content: '❌ Please provide an Ethereum address or ENS name.',
                        }
                    });
                }

                try {
                    // Resolve ENS if needed
                    const resolvedAddress = await resolveENS(address);
                    console.log(`Resolved ${address} to ${resolvedAddress}`);

                    // Fetch POAPs
                    const poapAPI = new PoapAPI();
                    const poaps = await poapAPI.getUserPOAPs(resolvedAddress);

                    if (!poaps || poaps.length === 0) {
                        return res.json({
                            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                            data: {
                                content: `🎫 No POAPs found for address: ${address}`,
                            }
                        });
                    }

                    // Create a simple text-based display for now
                    const poapList = poaps.slice(0, 10).map((poap, index) => {
                        const event = poap.event || poap;
                        return `${index + 1}. **${event.name || 'Unknown Event'}** ${event.start_date ? `(${event.start_date})` : ''}`;
                    }).join('\n');

                    const totalCount = poaps.length;
                    const displayCount = Math.min(10, totalCount);

                    return res.json({
                        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                        data: {
                            content: `🎫 **POAPs for ${address}**\n\nFound ${totalCount} POAPs (showing first ${displayCount}):\n\n${poapList}`,
                        }
                    });

                } catch (error) {
                    console.error('Error fetching POAPs:', error);
                    return res.json({
                        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                        data: {
                            content: `❌ Error fetching POAPs for ${address}: ${error.message}`,
                            flags: 64 // Ephemeral response
                        }
                    });
                }
            }

            // Default response for unknown commands
            console.log('Command not handled:', commandName);
            console.log('Available commands: poaps, my-poaps');
            return res.json({
                type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                data: {
                    content: `🎫 Unknown command: "${commandName}". Try /poaps or /my-poaps with an address parameter.`,
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