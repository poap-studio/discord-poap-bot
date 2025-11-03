import { verifyKey, InteractionType, InteractionResponseType } from 'discord-interactions';
import { PoapAPI, resolveENS } from './poap-utils.js';
import fetch from 'node-fetch';


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
        console.log('=== FULL INTERACTION DEBUG ===');
        console.log('Interaction type:', interaction.type);
        console.log('InteractionType.PING:', InteractionType.PING);
        console.log('InteractionType.APPLICATION_COMMAND:', InteractionType.APPLICATION_COMMAND);
        console.log('Full interaction body:', JSON.stringify(interaction, null, 2));
        console.log('=== END DEBUG ===');

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

            if (commandName === 'my-poaps' || commandName === 'poaps') {
                const addressOption = interaction.data.options?.find(option => option.name === 'address');
                const address = addressOption?.value;

                if (!address) {
                    return res.json({
                        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                        data: {
                            content: '❌ Please provide an Ethereum address or ENS name.',
                            flags: 64 // EPHEMERAL flag
                        }
                    });
                }

                try {
                    console.log(`Processing POAP request for address: ${address}`);
                    
                    // Resolve ENS if needed
                    let resolvedAddress = address;
                    if (address.endsWith('.eth')) {
                        console.log('Resolving ENS name:', address);
                        resolvedAddress = await resolveENS(address);
                        if (!resolvedAddress) {
                            return res.json({
                                type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                                data: {
                                    content: `❌ Could not resolve ENS name: ${address}`,
                                    flags: 64
                                }
                            });
                        }
                        console.log(`ENS resolved: ${address} → ${resolvedAddress}`);
                    }

                    // Get POAPs
                    const poapAPI = new PoapAPI();
                    const poaps = await poapAPI.getUserPOAPs(resolvedAddress);
                    
                    if (!poaps || poaps.length === 0) {
                        return res.json({
                            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                            data: {
                                content: `🎫 No POAPs found for ${address}`,
                            }
                        });
                    }

                    // Create POAP collection display with first image
                    const displayPoaps = poaps.slice(0, 9);
                    const firstPOAP = poaps[0];
                    
                    // Create the exact embed format from the image
                    return res.json({
                        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                        data: {
                            embeds: [{
                                title: "🎫 POAP Collection",
                                description: `**${address}** owns **${poaps.length}** POAPs\n📍\n${resolvedAddress}`,
                                color: 0x6534FF,
                                image: {
                                    url: firstPOAP.event.image_url
                                },
                                fields: displayPoaps.slice(0, 5).map(poap => ({
                                    name: poap.event.name,
                                    value: poap.event.start_date,
                                    inline: true
                                })),
                                footer: {
                                    text: `Showing ${Math.min(displayPoaps.length, poaps.length)} of ${poaps.length} POAPs`
                                }
                            }],
                            components: [{
                                type: 1, // Action Row
                                components: [{
                                    type: 2, // Button
                                    style: 5, // Link Button
                                    label: "🔗 View Full Collection",
                                    url: `https://app.poap.xyz/scan/${resolvedAddress}`
                                }]
                            }]
                        }
                    });

                } catch (error) {
                    console.error('Error processing POAP command:', error);
                    return res.json({
                        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                        data: {
                            content: '❌ Error fetching POAPs. Please try again later.',
                            flags: 64
                        }
                    });
                }
            }
        }

        // If we get here, we didn't handle the interaction
        console.log('Unhandled interaction type:', interaction.type);
        return res.status(400).json({ error: 'Unhandled interaction type' });

    } catch (error) {
        console.error('Webhook error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}