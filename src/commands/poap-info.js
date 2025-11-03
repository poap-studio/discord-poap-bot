import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

export default {
    data: new SlashCommandBuilder()
        .setName('poap-info')
        .setDescription('Get information about a POAP event')
        .addIntegerOption(option =>
            option.setName('event-id')
                .setDescription('POAP event ID')
                .setRequired(true)),

    async execute(interaction, { poapAPI, database }) {
        const eventId = interaction.options.getInteger('event-id');

        await interaction.deferReply();

        try {
            // Check cache first
            let eventInfo = await database.getCachedEvent(eventId);
            
            if (!eventInfo) {
                // Fetch from API if not cached
                eventInfo = await poapAPI.getEvent(eventId);
                
                // Cache the result
                await database.cacheEvent(eventId, eventInfo);
            }

            // Get event statistics
            let stats;
            try {
                stats = await poapAPI.getEventStats(eventId);
            } catch (statsError) {
                console.log('Could not fetch event stats:', statsError);
                stats = null;
            }

            const embed = new EmbedBuilder()
                .setColor(0x6C5CE7)
                .setTitle(`🎫 ${eventInfo.name}`)
                .setDescription(eventInfo.description || 'No description available')
                .addFields(
                    { name: '🆔 Event ID', value: eventId.toString(), inline: true },
                    { name: '📅 Start Date', value: eventInfo.start_date || 'N/A', inline: true },
                    { name: '📅 End Date', value: eventInfo.end_date || 'N/A', inline: true },
                    { name: '🏢 Organizer', value: eventInfo.organizer || 'N/A', inline: true },
                    { name: '🌍 Country', value: eventInfo.country || 'N/A', inline: true },
                    { name: '🏙️ City', value: eventInfo.city || 'N/A', inline: true }
                )
                .setTimestamp();

            // Add image if available
            if (eventInfo.image_url) {
                embed.setThumbnail(eventInfo.image_url);
            }

            // Add statistics if available
            if (stats && stats.length > 0) {
                embed.addFields(
                    { name: '📊 Total Minted', value: stats.length.toString(), inline: true }
                );
            }

            // Add event URL if available
            if (eventInfo.event_url) {
                embed.addFields(
                    { name: '🔗 Event URL', value: `[View Event](${eventInfo.event_url})`, inline: false }
                );
            }

            // Add supply information
            if (eventInfo.supply) {
                embed.addFields(
                    { name: '🎯 Supply', value: eventInfo.supply.toString(), inline: true }
                );
            }

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Error fetching event info:', error);
            
            if (error.message.includes('404')) {
                await interaction.editReply({
                    content: `❌ Event with ID ${eventId} not found. Please check the event ID.`
                });
            } else {
                await interaction.editReply({
                    content: `❌ Failed to fetch information for event ${eventId}. Please try again later.`
                });
            }
        }
    }
};