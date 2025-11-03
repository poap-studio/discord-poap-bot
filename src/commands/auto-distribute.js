import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';

export default {
    data: new SlashCommandBuilder()
        .setName('auto-distribute')
        .setDescription('Set up automatic POAP distribution (Admin only)')
        .addStringOption(option =>
            option.setName('action')
                .setDescription('Action to perform')
                .setRequired(true)
                .addChoices(
                    { name: 'create-rule', value: 'create' },
                    { name: 'list-rules', value: 'list' },
                    { name: 'toggle-rule', value: 'toggle' }
                ))
        .addStringOption(option =>
            option.setName('trigger')
                .setDescription('Distribution trigger')
                .setRequired(false)
                .addChoices(
                    { name: 'member-join', value: 'member_join' },
                    { name: 'reaction-add', value: 'reaction_add' },
                    { name: 'message-sent', value: 'message_sent' }
                ))
        .addIntegerOption(option =>
            option.setName('event-id')
                .setDescription('POAP event ID')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('secret-code')
                .setDescription('Event secret code')
                .setRequired(false))
        .addIntegerOption(option =>
            option.setName('rule-id')
                .setDescription('Rule ID to toggle')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    async execute(interaction, { poapAPI, database }) {
        const action = interaction.options.getString('action');
        
        await interaction.deferReply();

        try {
            switch (action) {
                case 'create':
                    await handleCreateRule(interaction, database, poapAPI);
                    break;
                case 'list':
                    await handleListRules(interaction, database);
                    break;
                case 'toggle':
                    await handleToggleRule(interaction, database);
                    break;
                default:
                    await interaction.editReply({ content: '❌ Invalid action specified.' });
            }
        } catch (error) {
            console.error('Auto-distribute error:', error);
            await interaction.editReply({
                content: '❌ An error occurred while managing auto-distribution rules.'
            });
        }
    }
};

async function handleCreateRule(interaction, database, poapAPI) {
    const trigger = interaction.options.getString('trigger');
    const eventId = interaction.options.getInteger('event-id');
    const secretCode = interaction.options.getString('secret-code');

    if (!trigger || !eventId || !secretCode) {
        return await interaction.editReply({
            content: '❌ Please provide trigger type, event ID, and secret code to create a rule.'
        });
    }

    // Validate event exists
    try {
        const eventInfo = await poapAPI.getEvent(eventId);
        
        // Create the rule
        const ruleId = await database.createAutoDistributionRule(
            interaction.guild.id,
            eventId,
            trigger,
            null, // trigger_data (for future use)
            secretCode,
            interaction.user.id
        );

        const embed = new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle('⚡ Auto-Distribution Rule Created')
            .setDescription(`POAPs will be automatically distributed when the trigger occurs`)
            .addFields(
                { name: '🎯 Trigger', value: getTriggerDisplayName(trigger), inline: true },
                { name: '🆔 Rule ID', value: ruleId.toString(), inline: true },
                { name: '🎫 Event', value: `${eventInfo.name} (${eventId})`, inline: false },
                { name: '⚠️ Note', value: 'Users must have linked wallets to receive POAPs automatically', inline: false }
            )
            .setTimestamp();

        if (eventInfo.image_url) {
            embed.setThumbnail(eventInfo.image_url);
        }

        await interaction.editReply({ embeds: [embed] });

    } catch (error) {
        await interaction.editReply({
            content: `❌ Event ${eventId} not found. Please check the event ID.`
        });
    }
}

async function handleListRules(interaction, database) {
    const rules = await database.getAutoDistributionRules(interaction.guild.id);

    if (rules.length === 0) {
        return await interaction.editReply({
            content: '📭 No auto-distribution rules configured for this server.'
        });
    }

    const embed = new EmbedBuilder()
        .setColor(0x6C5CE7)
        .setTitle('⚡ Auto-Distribution Rules')
        .setDescription(`${rules.length} rule(s) configured for this server`)
        .setTimestamp();

    let ruleList = '';
    for (const rule of rules.slice(0, 10)) { // Limit to prevent embed size issues
        const status = rule.active ? '✅' : '❌';
        const trigger = getTriggerDisplayName(rule.trigger_type);
        ruleList += `${status} **${rule.id}** - ${trigger} → Event ${rule.event_id}\n`;
    }

    embed.addFields(
        { name: '📋 Rules', value: ruleList || 'None', inline: false }
    );

    if (rules.length > 10) {
        embed.addFields(
            { name: '📊 Note', value: `Showing 10 of ${rules.length} total rules`, inline: false }
        );
    }

    await interaction.editReply({ embeds: [embed] });
}

async function handleToggleRule(interaction, database) {
    const ruleId = interaction.options.getInteger('rule-id');

    if (!ruleId) {
        return await interaction.editReply({
            content: '❌ Please provide the rule ID to toggle.'
        });
    }

    try {
        // Get current rules to find the one to toggle
        const rules = await database.getAutoDistributionRules(interaction.guild.id, null); // Get all rules
        const rule = rules.find(r => r.id === ruleId);

        if (!rule) {
            return await interaction.editReply({
                content: `❌ Rule ${ruleId} not found in this server.`
            });
        }

        const newStatus = !rule.active;
        await database.toggleAutoDistributionRule(ruleId, newStatus);

        const embed = new EmbedBuilder()
            .setColor(newStatus ? 0x00FF00 : 0xFF0000)
            .setTitle('🔄 Rule Status Updated')
            .setDescription(`Auto-distribution rule ${ruleId} has been ${newStatus ? 'enabled' : 'disabled'}`)
            .addFields(
                { name: '🎯 Trigger', value: getTriggerDisplayName(rule.trigger_type), inline: true },
                { name: '🎫 Event ID', value: rule.event_id.toString(), inline: true },
                { name: '📊 Status', value: newStatus ? '✅ Active' : '❌ Inactive', inline: true }
            )
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });

    } catch (error) {
        await interaction.editReply({
            content: `❌ Failed to toggle rule ${ruleId}. Please check the rule ID.`
        });
    }
}

function getTriggerDisplayName(trigger) {
    const triggers = {
        'member_join': '👋 Member Join',
        'reaction_add': '⭐ Reaction Added',
        'message_sent': '💬 Message Sent'
    };
    return triggers[trigger] || trigger;
}