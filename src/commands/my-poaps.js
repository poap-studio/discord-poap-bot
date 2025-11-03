import { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { ENSResolver } from '../ens-resolver.js';
import { POAPCollage } from '../poap-collage.js';

export default {
    data: new SlashCommandBuilder()
        .setName('my-poaps')
        .setDescription('View your POAP collection')
        .addStringOption(option =>
            option.setName('address')
                .setDescription('Ethereum address (0x...) or ENS name (vitalik.eth) to check (optional)')
                .setRequired(false)),

    async execute(interaction, { poapAPI, database }) {
        const providedInput = interaction.options.getString('address');
        const ensResolver = new ENSResolver();
        let targetAddress;
        let displayName;

        await interaction.deferReply();

        // Require an address to be provided
        if (!providedInput) {
            return await interaction.editReply({
                content: '❌ Please provide an Ethereum address or ENS name to check POAPs.\n\nExample: `/my-poaps address:vitalik.eth`'
            });
        }

        try {
            // Quick check: if it's already a valid address, skip ENS resolution
            if (ensResolver.isValidEthereumAddress(providedInput)) {
                targetAddress = providedInput.toLowerCase();
                displayName = `${targetAddress.slice(0, 6)}...${targetAddress.slice(-4)}`;
            } else {
                // Resolve ENS name to address
                const resolved = await ensResolver.validateAndResolve(providedInput);
                targetAddress = resolved.address;
                displayName = resolved.displayName;
            }
        } catch (error) {
            return await interaction.editReply({
                content: `❌ ${error.message}`
            });
        }

        try {
            // Get POAPs from POAP API
            console.log(`🔍 Fetching POAPs for address: ${targetAddress}`);
            const poaps = await poapAPI.getUserPOAPs(targetAddress);
            console.log(`📊 Found ${poaps ? poaps.length : 0} POAPs`);
            
            // Handle no POAPs case
            if (!poaps || poaps.length === 0) {
                const embed = new EmbedBuilder()
                    .setColor(0xFFA500)
                    .setTitle('📭 No POAPs Found')
                    .setDescription(`No POAPs found for: **${displayName}**\n\`${targetAddress}\``)
                    .setTimestamp();

                return await interaction.editReply({ embeds: [embed] });
            }
            
            // Create beautiful visual embed with POAP images
            const recentPOAPs = poaps.slice(0, 10);
            let poapList = '';
            
            for (let i = 0; i < Math.min(recentPOAPs.length, 10); i++) {
                const poap = recentPOAPs[i];
                const date = new Date(poap.created).toLocaleDateString();
                poapList += `**${i + 1}.** ${poap.event.name} *(${date})*\n`;
            }
            console.log(`📤 Sending multi-POAP embed for ${displayName} with ${poaps.length} POAPs`);
            
            try {
                // If user has 9+ POAPs, create a collage
                if (poaps.length >= 9) {
                    console.log(`📸 Creating collage for ${displayName} with ${poaps.length} POAPs`);
                    
                    const collage = new POAPCollage();
                    const poapUrls = recentPOAPs.slice(0, 9).map(poap => poap.event.image_url).filter(url => url);
                    
                    if (poapUrls.length >= 9) {
                        try {
                            const collageBuffer = await collage.createCollage(poapUrls);
                            
                            const attachment = new AttachmentBuilder(collageBuffer, { name: 'poap-collage.png' });
                            
                            const collageEmbed = new EmbedBuilder()
                                .setColor(0x6C5CE7)
                                .setTitle(`🎫 POAP Collection Grid`)
                                .setDescription(`**${displayName}** owns **${poaps.length}** POAPs\n📍 \`${targetAddress}\``)
                                .setImage('attachment://poap-collage.png')
                                .setFooter({ 
                                    text: `Latest 9 of ${poaps.length} POAPs`, 
                                    iconURL: 'https://assets.poap.xyz/logo-512.png' 
                                });

                            // Create button to view full collection
                            const button = new ButtonBuilder()
                                .setLabel('View Full Collection')
                                .setStyle(ButtonStyle.Link)
                                .setURL(`https://collectors.poap.xyz/scan/${targetAddress}`)
                                .setEmoji('🔗');

                            const row = new ActionRowBuilder()
                                .addComponents(button);

                            await interaction.editReply({ 
                                embeds: [collageEmbed], 
                                files: [attachment],
                                components: [row]
                            });
                            
                            console.log(`✅ POAP collage sent successfully`);
                            return;
                            
                        } catch (collageError) {
                            console.error('Failed to create collage, falling back to individual embeds:', collageError);
                        }
                    }
                }

                // Fallback: Create header embed
                const headerEmbed = new EmbedBuilder()
                    .setColor(0x6C5CE7)
                    .setTitle(`🎫 POAP Collection`)
                    .setDescription(`**${displayName}** owns **${poaps.length}** POAPs`)
                    .addFields(
                        { name: '📍 Address', value: `\`${targetAddress}\``, inline: false }
                    );

                if (poaps.length > 6) {
                    headerEmbed.setFooter({ 
                        text: `Showing latest 6 of ${poaps.length} POAPs`, 
                        iconURL: 'https://assets.poap.xyz/logo-512.png' 
                    });
                } else {
                    headerEmbed.setFooter({ 
                        text: 'All POAPs shown', 
                        iconURL: 'https://assets.poap.xyz/logo-512.png' 
                    });
                }

                // Create array of embeds starting with header
                const embeds = [headerEmbed];

                // Create compact image embeds for first 6 POAPs (will display in 2x3 grid)
                for (let i = 0; i < Math.min(6, recentPOAPs.length); i++) {
                    const poap = recentPOAPs[i];
                    if (poap.event.image_url) {
                        const date = new Date(poap.created).toLocaleDateString();
                        const truncatedName = poap.event.name.length > 20 ? 
                            poap.event.name.slice(0, 20) + '...' : 
                            poap.event.name;
                        
                        const poapEmbed = new EmbedBuilder()
                            .setColor(0x6C5CE7)
                            .setTitle(`${i + 1}. ${truncatedName}`)
                            .setDescription(`📅 ${date}`)
                            .setThumbnail(poap.event.image_url); // Use thumbnail for smaller size
                        
                        embeds.push(poapEmbed);
                    }
                }

                // Create button to view full collection
                const button = new ButtonBuilder()
                    .setLabel('View Full Collection')
                    .setStyle(ButtonStyle.Link)
                    .setURL(`https://collectors.poap.xyz/scan/${targetAddress}`)
                    .setEmoji('🔗');

                const row = new ActionRowBuilder()
                    .addComponents(button);

                await interaction.editReply({ 
                    embeds: embeds,
                    components: [row]
                });
                console.log(`✅ POAP grid with thumbnails sent with ${embeds.length} embeds`);
                
            } catch (embedError) {
                console.error(`❌ Failed to send embed:`, embedError);
                // Fallback to text response
                await interaction.editReply({
                    content: `🎫 **POAP Collection**\n📍 **Address**: ${displayName}\n🎯 **Total POAPs**: ${poaps.length}\n🎨 **Latest**: ${recentPOAPs[0]?.event?.name || 'N/A'}\n\n📋 **Recent POAPs:**\n${poapList}`
                });
                console.log(`✅ Fallback text response sent`);
            }

        } catch (error) {
            console.error('Error fetching POAPs:', error);
            await interaction.editReply({
                content: '❌ Failed to fetch POAP collection. The POAP API might be temporarily unavailable.'
            });
        }
    }
};