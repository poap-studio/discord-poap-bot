import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { ENSResolver } from '../ens-resolver.js';

export default {
    data: new SlashCommandBuilder()
        .setName('link-wallet')
        .setDescription('Link your Ethereum wallet to receive POAPs')
        .addStringOption(option =>
            option.setName('address')
                .setDescription('Your Ethereum wallet address (0x...) or ENS name (vitalik.eth)')
                .setRequired(true)),

    async execute(interaction, { database }) {
        const input = interaction.options.getString('address');
        const ensResolver = new ENSResolver();
        
        await interaction.deferReply({ ephemeral: true });

        try {
            // Resolve ENS name to address if needed
            const { address, displayName, wasENS } = await ensResolver.validateAndResolve(input);
            
            await database.linkWallet(interaction.user.id, address);
            
            const embed = new EmbedBuilder()
                .setColor(0x6C5CE7)
                .setTitle('🔗 Wallet Linked Successfully!')
                .setDescription(`Your Discord account has been linked to:\n\`${address}\``)
                .addFields(
                    { name: '📝 Input', value: wasENS ? `ENS: ${displayName} → ${address}` : `Address: ${displayName}`, inline: false },
                    { name: '📝 Note', value: 'This wallet will be used for POAP distributions in this server.' },
                    { name: '🔍 View POAPs', value: 'Use `/my-poaps` to see your POAP collection!' },
                    { name: '🚪 Access Check', value: 'Checking for POAP-gated roles and channels...' }
                )
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
            
            // Trigger POAP gate checking
            interaction.client.emit('walletLinked', interaction.user.id, interaction.guild.id);
            
        } catch (error) {
            console.error('Error linking wallet:', error);
            await interaction.editReply({
                content: `❌ ${error.message}`
            });
        }
    }
};