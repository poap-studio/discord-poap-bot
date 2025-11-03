import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';

export default {
    data: new SlashCommandBuilder()
        .setName('poap-gate')
        .setDescription('Manage POAP-based access control (Admin only)')
        .addStringOption(option =>
            option.setName('action')
                .setDescription('Action to perform')
                .setRequired(true)
                .addChoices(
                    { name: 'create-role-gate', value: 'create_role' },
                    { name: 'create-channel-gate', value: 'create_channel' },
                    { name: 'list-gates', value: 'list' },
                    { name: 'remove-gate', value: 'remove' }
                ))
        .addStringOption(option =>
            option.setName('target')
                .setDescription('Role or channel to gate')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('poap-ids')
                .setDescription('Required POAP IDs (comma-separated)')
                .setRequired(false))
        .addIntegerOption(option =>
            option.setName('gate-id')
                .setDescription('Gate ID to remove')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    async execute(interaction, { poapAPI, database }) {
        const action = interaction.options.getString('action');
        
        await interaction.deferReply();

        try {
            switch (action) {
                case 'create_role':
                    await handleCreateRoleGate(interaction, database, poapAPI);
                    break;
                case 'create_channel':
                    await handleCreateChannelGate(interaction, database, poapAPI);
                    break;
                case 'list':
                    await handleListGates(interaction, database);
                    break;
                case 'remove':
                    await handleRemoveGate(interaction, database);
                    break;
                default:
                    await interaction.editReply({ content: '❌ Invalid action specified.' });
            }
        } catch (error) {
            console.error('POAP gate error:', error);
            await interaction.editReply({
                content: '❌ An error occurred while managing POAP gates.'
            });
        }
    }
};

async function handleCreateRoleGate(interaction, database, poapAPI) {
    const targetRole = interaction.options.getString('target');
    const poapIds = interaction.options.getString('poap-ids');

    if (!targetRole || !poapIds) {
        return await interaction.editReply({
            content: '❌ Please provide both target role and POAP IDs for role gate creation.'
        });
    }

    // Parse POAP IDs
    const poapIdArray = poapIds.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
    
    if (poapIdArray.length === 0) {
        return await interaction.editReply({
            content: '❌ Please provide valid POAP IDs (comma-separated numbers).'
        });
    }

    // Validate that the role exists or get role by mention/ID
    let role;
    if (targetRole.startsWith('<@&') && targetRole.endsWith('>')) {
        const roleId = targetRole.slice(3, -1);
        role = interaction.guild.roles.cache.get(roleId);
    } else {
        role = interaction.guild.roles.cache.find(r => r.name === targetRole);
    }

    if (!role) {
        return await interaction.editReply({
            content: `❌ Role "${targetRole}" not found. Please mention the role or use the exact role name.`
        });
    }

    // Validate POAP events exist
    const validEvents = [];
    for (const poapId of poapIdArray) {
        try {
            const eventInfo = await poapAPI.getEvent(poapId);
            validEvents.push({ id: poapId, name: eventInfo.name });
        } catch (error) {
            return await interaction.editReply({
                content: `❌ POAP event ${poapId} not found. Please check all event IDs.`
            });
        }
    }

    // Create the gate
    const gateId = await database.createPOAPGate(
        interaction.guild.id,
        null, // channel_id
        role.id,
        poapIdArray,
        'role',
        interaction.user.id
    );

    const embed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle('🚪 Role Gate Created')
        .setDescription(`Users must own specific POAPs to receive the **${role.name}** role`)
        .addFields(
            { name: '🎯 Target Role', value: `<@&${role.id}>`, inline: true },
            { name: '🆔 Gate ID', value: gateId.toString(), inline: true },
            { name: '🎫 Required POAPs', value: validEvents.map(e => `• ${e.name} (${e.id})`).join('\n'), inline: false }
        )
        .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
}

async function handleCreateChannelGate(interaction, database, poapAPI) {
    const targetChannel = interaction.options.getString('target');
    const poapIds = interaction.options.getString('poap-ids');

    if (!targetChannel || !poapIds) {
        return await interaction.editReply({
            content: '❌ Please provide both target channel and POAP IDs for channel gate creation.'
        });
    }

    // Parse POAP IDs
    const poapIdArray = poapIds.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
    
    if (poapIdArray.length === 0) {
        return await interaction.editReply({
            content: '❌ Please provide valid POAP IDs (comma-separated numbers).'
        });
    }

    // Validate that the channel exists
    let channel;
    if (targetChannel.startsWith('<#') && targetChannel.endsWith('>')) {
        const channelId = targetChannel.slice(2, -1);
        channel = interaction.guild.channels.cache.get(channelId);
    } else {
        channel = interaction.guild.channels.cache.find(c => c.name === targetChannel);
    }

    if (!channel) {
        return await interaction.editReply({
            content: `❌ Channel "${targetChannel}" not found. Please mention the channel or use the exact channel name.`
        });
    }

    // Validate POAP events exist
    const validEvents = [];
    for (const poapId of poapIdArray) {
        try {
            const eventInfo = await poapAPI.getEvent(poapId);
            validEvents.push({ id: poapId, name: eventInfo.name });
        } catch (error) {
            return await interaction.editReply({
                content: `❌ POAP event ${poapId} not found. Please check all event IDs.`
            });
        }
    }

    // Create the gate
    const gateId = await database.createPOAPGate(
        interaction.guild.id,
        channel.id,
        null, // role_id
        poapIdArray,
        'channel',
        interaction.user.id
    );

    const embed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle('🚪 Channel Gate Created')
        .setDescription(`Users must own specific POAPs to access **${channel.name}**`)
        .addFields(
            { name: '🎯 Target Channel', value: `<#${channel.id}>`, inline: true },
            { name: '🆔 Gate ID', value: gateId.toString(), inline: true },
            { name: '🎫 Required POAPs', value: validEvents.map(e => `• ${e.name} (${e.id})`).join('\n'), inline: false }
        )
        .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
}

async function handleListGates(interaction, database) {
    const gates = await database.getPOAPGates(interaction.guild.id);

    if (gates.length === 0) {
        return await interaction.editReply({
            content: '📭 No POAP gates configured for this server.'
        });
    }

    const embed = new EmbedBuilder()
        .setColor(0x6C5CE7)
        .setTitle('🚪 POAP Gates')
        .setDescription(`${gates.length} gate(s) configured for this server`)
        .setTimestamp();

    let gateList = '';
    for (const gate of gates.slice(0, 10)) { // Limit to prevent embed size issues
        const target = gate.gate_type === 'role' 
            ? `<@&${gate.role_id}>` 
            : `<#${gate.channel_id}>`;
        const poapCount = gate.required_poap_ids.length;
        gateList += `**${gate.id}** - ${target} (${poapCount} POAPs required)\n`;
    }

    embed.addFields(
        { name: '📋 Active Gates', value: gateList || 'None', inline: false }
    );

    if (gates.length > 10) {
        embed.addFields(
            { name: '📊 Note', value: `Showing 10 of ${gates.length} total gates`, inline: false }
        );
    }

    await interaction.editReply({ embeds: [embed] });
}

async function handleRemoveGate(interaction, database) {
    const gateId = interaction.options.getInteger('gate-id');

    if (!gateId) {
        return await interaction.editReply({
            content: '❌ Please provide the gate ID to remove.'
        });
    }

    try {
        await database.deletePOAPGate(gateId);
        
        const embed = new EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle('🗑️ Gate Removed')
            .setDescription(`POAP gate ${gateId} has been deleted`)
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    } catch (error) {
        await interaction.editReply({
            content: `❌ Failed to remove gate ${gateId}. Please check the gate ID.`
        });
    }
}