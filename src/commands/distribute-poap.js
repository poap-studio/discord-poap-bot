import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';

export default {
    data: new SlashCommandBuilder()
        .setName('distribute-poap')
        .setDescription('Distribute POAP to a user (Admin only)')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('User to receive the POAP')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('event-id')
                .setDescription('POAP event ID')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('secret-code')
                .setDescription('Event secret code')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    async execute(interaction, { poapAPI, database }) {
        const targetUser = interaction.options.getUser('user');
        const eventId = interaction.options.getInteger('event-id');
        const secretCode = interaction.options.getString('secret-code');

        await interaction.deferReply();

        try {
            // Check if user has linked wallet
            const userWallet = await database.getUserWallet(targetUser.id);
            if (!userWallet) {
                return await interaction.editReply({
                    content: `❌ ${targetUser.displayName} hasn't linked their wallet yet. They need to use \`/link-wallet\` first.`
                });
            }

            // Get event information
            let eventInfo;
            try {
                eventInfo = await poapAPI.getEvent(eventId);
            } catch (error) {
                return await interaction.editReply({
                    content: `❌ Failed to fetch event information. Please check the event ID: ${eventId}`
                });
            }

            // Get mint links for the event
            let mintLinks;
            try {
                mintLinks = await poapAPI.getMintLinks(eventId, secretCode);
                if (!mintLinks || mintLinks.length === 0) {
                    return await interaction.editReply({
                        content: `❌ No available mint links for event ${eventId}. Check the secret code or contact the event organizer.`
                    });
                }
            } catch (error) {
                return await interaction.editReply({
                    content: `❌ Failed to get mint links. Please verify the secret code for event ${eventId}.`
                });
            }

            // Use the first available mint link
            const mintLink = mintLinks[0];
            const qrHash = mintLink.qr_hash;

            // Claim the POAP for the user
            try {
                const claimResult = await poapAPI.claimPOAP(qrHash, userWallet.ethereum_address, secretCode);
                
                // Record the distribution in database
                const distributionId = await database.recordDistribution(
                    targetUser.id,
                    interaction.guild.id,
                    eventId,
                    qrHash,
                    interaction.user.id
                );

                await database.updateDistributionStatus(distributionId, 'claimed', new Date().toISOString());

                const embed = new EmbedBuilder()
                    .setColor(0x00FF00)
                    .setTitle('🎉 POAP Distributed Successfully!')
                    .setDescription(`**${eventInfo.name}** has been sent to ${targetUser}`)
                    .addFields(
                        { name: '👤 Recipient', value: `${targetUser.displayName} (${userWallet.ethereum_address})`, inline: true },
                        { name: '🎫 Event ID', value: eventId.toString(), inline: true },
                        { name: '📅 Event Date', value: eventInfo.start_date || 'N/A', inline: true },
                        { name: '🔗 Transaction', value: claimResult.txHash ? `[View on Etherscan](https://etherscan.io/tx/${claimResult.txHash})` : 'Processing...', inline: false }
                    )
                    .setThumbnail(eventInfo.image_url)
                    .setTimestamp();

                await interaction.editReply({ embeds: [embed] });

                // Send DM to recipient
                try {
                    const dmEmbed = new EmbedBuilder()
                        .setColor(0x6C5CE7)
                        .setTitle('🎁 You received a POAP!')
                        .setDescription(`You've been awarded a POAP from **${interaction.guild.name}**`)
                        .addFields(
                            { name: '🎫 Event', value: eventInfo.name },
                            { name: '👤 Distributed by', value: interaction.user.displayName },
                            { name: '💳 Sent to', value: userWallet.ethereum_address }
                        )
                        .setThumbnail(eventInfo.image_url)
                        .setTimestamp();

                    await targetUser.send({ embeds: [dmEmbed] });
                } catch (dmError) {
                    console.log(`Could not send DM to ${targetUser.tag}`);
                }

            } catch (claimError) {
                console.error('Claim error:', claimError);
                return await interaction.editReply({
                    content: `❌ Failed to claim POAP. The mint link might already be used or there was an API error.`
                });
            }

        } catch (error) {
            console.error('Distribution error:', error);
            await interaction.editReply({
                content: '❌ An error occurred while distributing the POAP. Please try again.'
            });
        }
    }
};