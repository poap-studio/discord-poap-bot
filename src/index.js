import { Client, Collection, Events, GatewayIntentBits } from 'discord.js';
import { config } from 'dotenv';
import { PoapAPI } from './poap-api.js';
import { Database } from './database.js';
import { ENSResolver } from './ens-resolver.js';
import { registerCommands } from './deploy-commands.js';

config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds
    ]
});

// Initialize services
const poapAPI = new PoapAPI();
const database = new Database();
const ensResolver = new ENSResolver();

// Store commands
client.commands = new Collection();

// Load commands
const commands = await Promise.all([
    import('./commands/distribute-poap.js'),
    import('./commands/my-poaps.js'),
    import('./commands/poap-info.js'),
    import('./commands/link-wallet.js'),
    import('./commands/poap-gate.js'),
    import('./commands/auto-distribute.js')
]);

commands.forEach(commandModule => {
    const command = commandModule.default;
    if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
    }
});

client.once(Events.ClientReady, async (readyClient) => {
    console.log(`✅ Ready! Logged in as ${readyClient.user.tag}`);
    
    // Initialize database
    await database.init();
    
    // Register slash commands
    await registerCommands();
    
    console.log('🎉 POAP Bot is ready for action!');
});

client.on(Events.InteractionCreate, async interaction => {
    console.log(`📥 Received interaction: ${interaction.type} from ${interaction.user.tag}`);
    
    if (!interaction.isChatInputCommand()) {
        console.log(`❌ Not a chat input command: ${interaction.type}`);
        return;
    }

    console.log(`🎯 Processing command: /${interaction.commandName}`);
    const command = interaction.client.commands.get(interaction.commandName);

    if (!command) {
        console.error(`❌ No command matching ${interaction.commandName} was found.`);
        await interaction.reply({ content: '❌ Command not found!', ephemeral: true });
        return;
    }

    console.log(`✅ Executing command: /${interaction.commandName}`);
    try {
        await command.execute(interaction, { poapAPI, database, ensResolver });
        console.log(`✅ Command completed: /${interaction.commandName}`);
    } catch (error) {
        console.error(error);
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content: 'There was an error while executing this command!', ephemeral: true });
        } else {
            await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
        }
    }
});

// Handle member join events for auto POAP distribution
client.on(Events.GuildMemberAdd, async member => {
    // Check for auto-distribution rules
    const rules = await database.getAutoDistributionRules(member.guild.id);
    
    for (const rule of rules) {
        if (rule.trigger_type === 'member_join') {
            // Check if user has linked wallet
            const userWallet = await database.getUserWallet(member.user.id);
            if (userWallet) {
                try {
                    const mintLinks = await poapAPI.getMintLinks(rule.event_id, rule.secret_code);
                    if (mintLinks && mintLinks.length > 0) {
                        const qrHash = mintLinks[0].qr_hash;
                        await poapAPI.claimPOAP(qrHash, userWallet.ethereum_address, rule.secret_code);
                        
                        await database.recordDistribution(
                            member.user.id,
                            member.guild.id,
                            rule.event_id,
                            qrHash,
                            'auto-distribution'
                        );
                        
                        console.log(`✅ Auto-distributed POAP ${rule.event_id} to ${member.user.tag}`);
                        
                        // Send welcome DM
                        try {
                            const eventInfo = await poapAPI.getEvent(rule.event_id);
                            await member.send(`🎉 Welcome to **${member.guild.name}**! You've been awarded a POAP: **${eventInfo.name}**`);
                        } catch (dmError) {
                            console.log(`Could not send welcome DM to ${member.user.tag}`);
                        }
                    }
                } catch (error) {
                    console.error(`Failed to auto-distribute POAP to ${member.user.tag}:`, error);
                }
            }
        }
    }
    
    // Check POAP gates and assign roles
    await checkPOAPGatesForMember(member);
});

// Handle message events for reaction-based auto distribution
client.on(Events.MessageReactionAdd, async (reaction, user) => {
    if (user.bot) return;
    
    const rules = await database.getAutoDistributionRules(reaction.message.guild.id);
    
    for (const rule of rules) {
        if (rule.trigger_type === 'reaction_add') {
            const userWallet = await database.getUserWallet(user.id);
            if (userWallet) {
                try {
                    const mintLinks = await poapAPI.getMintLinks(rule.event_id, rule.secret_code);
                    if (mintLinks && mintLinks.length > 0) {
                        const qrHash = mintLinks[0].qr_hash;
                        await poapAPI.claimPOAP(qrHash, userWallet.ethereum_address, rule.secret_code);
                        
                        await database.recordDistribution(
                            user.id,
                            reaction.message.guild.id,
                            rule.event_id,
                            qrHash,
                            'auto-distribution'
                        );
                        
                        console.log(`✅ Auto-distributed POAP ${rule.event_id} to ${user.tag} for reaction`);
                    }
                } catch (error) {
                    console.error(`Failed to auto-distribute POAP to ${user.tag}:`, error);
                }
            }
        }
    }
});

// POAP gating functionality
async function checkPOAPGatesForMember(member) {
    const gates = await database.getPOAPGates(member.guild.id);
    const userWallet = await database.getUserWallet(member.user.id);
    
    if (!userWallet) return; // User hasn't linked wallet
    
    try {
        const userPOAPs = await poapAPI.getUserPOAPs(userWallet.ethereum_address);
        const userPOAPIds = userPOAPs.map(poap => poap.event.id);
        
        for (const gate of gates) {
            const hasRequiredPOAPs = gate.required_poap_ids.every(requiredId => 
                userPOAPIds.includes(requiredId)
            );
            
            if (hasRequiredPOAPs) {
                if (gate.gate_type === 'role' && gate.role_id) {
                    try {
                        const role = member.guild.roles.cache.get(gate.role_id);
                        if (role && !member.roles.cache.has(gate.role_id)) {
                            await member.roles.add(role);
                            console.log(`✅ Granted role ${role.name} to ${member.user.tag} via POAP gate`);
                        }
                    } catch (error) {
                        console.error(`Failed to grant role to ${member.user.tag}:`, error);
                    }
                }
                
                if (gate.gate_type === 'channel' && gate.channel_id) {
                    try {
                        const channel = member.guild.channels.cache.get(gate.channel_id);
                        if (channel) {
                            await channel.permissionOverwrites.create(member.user, {
                                ViewChannel: true,
                                SendMessages: true,
                                ReadMessageHistory: true
                            });
                            console.log(`✅ Granted channel access to ${member.user.tag} via POAP gate`);
                        }
                    } catch (error) {
                        console.error(`Failed to grant channel access to ${member.user.tag}:`, error);
                    }
                }
            }
        }
    } catch (error) {
        console.error(`Failed to check POAP gates for ${member.user.tag}:`, error);
    }
}

// Check POAP gates when user links wallet
client.on('walletLinked', async (userId, guildId) => {
    try {
        const guild = client.guilds.cache.get(guildId);
        if (guild) {
            const member = await guild.members.fetch(userId);
            if (member) {
                await checkPOAPGatesForMember(member);
            }
        }
    } catch (error) {
        console.error('Failed to check gates after wallet link:', error);
    }
});

client.login(process.env.DISCORD_TOKEN);