import { verifyKey, InteractionType, InteractionResponseType } from 'discord-interactions';
import { PoapAPI, resolveENS } from './poap-utils.js';
import { createCanvas, loadImage } from 'canvas';
import fetch from 'node-fetch';

// POAP Collage creation function
async function createPOAPCollage(poapUrls) {
    try {
        const imageSize = 200;
        const gridSize = 3;
        const padding = 10;
        const urls = poapUrls.slice(0, 9);
        const canvasSize = (imageSize * gridSize) + (padding * (gridSize + 1));
        
        const canvas = createCanvas(canvasSize, canvasSize);
        const ctx = canvas.getContext('2d');
        
        // Fill background with Discord dark theme
        ctx.fillStyle = '#2C2F33';
        ctx.fillRect(0, 0, canvasSize, canvasSize);
        
        // Load and draw images
        for (let i = 0; i < urls.length; i++) {
            try {
                const row = Math.floor(i / gridSize);
                const col = i % gridSize;
                const x = padding + (col * (imageSize + padding));
                const y = padding + (row * (imageSize + padding));
                
                const image = await loadImage(urls[i]);
                
                // Draw rounded image
                ctx.save();
                ctx.beginPath();
                ctx.roundRect(x, y, imageSize, imageSize, 10);
                ctx.clip();
                ctx.drawImage(image, x, y, imageSize, imageSize);
                ctx.restore();
                
            } catch (imageError) {
                console.error(`Failed to load POAP image ${i}:`, imageError);
                // Draw placeholder
                const row = Math.floor(i / gridSize);
                const col = i % gridSize;
                const x = padding + (col * (imageSize + padding));
                const y = padding + (row * (imageSize + padding));
                
                ctx.fillStyle = '#99AAB5';
                ctx.fillRect(x, y, imageSize, imageSize);
                ctx.fillStyle = '#FFFFFF';
                ctx.font = '16px Arial';
                ctx.textAlign = 'center';
                ctx.fillText('POAP', x + imageSize/2, y + imageSize/2);
            }
        }
        
        return canvas.toBuffer('image/png');
    } catch (error) {
        console.error('Error creating POAP collage:', error);
        throw error;
    }
}


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

                    // Create the exact POAP collection grid from the image
                    const displayPoaps = poaps.slice(0, 9);
                    
                    try {
                        // Generate 3x3 grid collage
                        const poapImageUrls = displayPoaps.map(poap => poap.event.image_url);
                        const collageBuffer = await createPOAPCollage(poapImageUrls);
                        
                        // For now, use a simple approach - Discord allows data URLs for small images
                        const base64Image = collageBuffer.toString('base64');
                        const dataUrl = `data:image/png;base64,${base64Image}`;
                        
                        // Create the exact embed format from the image
                        return res.json({
                            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                            data: {
                                embeds: [{
                                    title: "🎫 POAP Collection Grid",
                                    description: `**${address}** owns **${poaps.length}** POAPs\n📍\n${resolvedAddress}`,
                                    color: 0x6534FF,
                                    image: {
                                        url: dataUrl
                                    },
                                    footer: {
                                        text: `Latest ${Math.min(9, poaps.length)} of ${poaps.length} POAPs`
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
                        
                    } catch (collageError) {
                        console.error('Failed to create collage, falling back to simple list:', collageError);
                        
                        // Fallback to simple text list if collage fails
                        const poapList = displayPoaps.map(poap => 
                            `• **${poap.event.name}** (${poap.event.start_date})`
                        ).join('\n');

                        return res.json({
                            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                            data: {
                                content: `🎫 **POAPs for ${address}:**\n\n${poapList}\n\n*Showing ${Math.min(9, poaps.length)} of ${poaps.length} POAPs*`,
                            }
                        });
                    }

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