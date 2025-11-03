# Discord POAP Bot

A comprehensive Discord bot for POAP (Proof of Attendance Protocol) distribution and management with visual grid collages. Deployed on Vercel with webhook-based interactions.

## ✨ Features

🎫 **Visual POAP Collections**
- Beautiful 3x3 grid collages for users with 9+ POAPs
- Individual thumbnail embeds for smaller collections
- Direct links to POAP collector pages with buttons

🔗 **ENS & Wallet Integration**
- Support for both Ethereum addresses and ENS names (vitalik.eth)
- Link Discord accounts to wallets
- Secure address validation and resolution

🚪 **Access Control**
- Role gating based on POAP ownership
- Channel access control via POAPs
- Flexible requirement configurations

⚡ **Automation**
- Auto-distribute POAPs on member join or reactions
- Welcome POAPs for new members
- Configurable distribution triggers

📊 **Management**
- Event information lookup with rich embeds
- Distribution tracking and history
- Admin controls and configuration

## 🚀 Deployment

### Deploy to Vercel

1. **Clone Repository**
   ```bash
   git clone https://github.com/poap-studio/discord-poap-bot.git
   cd discord-poap-bot
   npm install
   ```

2. **Deploy to Vercel**
   - Connect your GitHub repository to Vercel
   - Set environment variables in Vercel dashboard
   - Deploy the project

3. **Environment Variables (Vercel)**
   Set these in your Vercel project settings:
   ```env
   DISCORD_TOKEN=your_discord_bot_token_here
   DISCORD_CLIENT_ID=your_discord_client_id_here
   DISCORD_CLIENT_SECRET=your_discord_client_secret_here
   DISCORD_PUBLIC_KEY=your_discord_public_key_here
   POAP_CLIENT_ID=your_poap_client_id_here
   POAP_CLIENT_SECRET=your_poap_client_secret_here
   ```

4. **Configure Discord Webhook**
   - In Discord Developer Portal, set "Interactions Endpoint URL" to:
   - `https://your-vercel-app.vercel.app/api/webhook`

### Local Development

1. **Environment Setup**
   ```bash
   cp .env.example .env
   # Edit .env with your credentials
   ```

2. **Start Development Server**
   ```bash
   npm run dev
   ```

### Discord Bot Permissions

Your bot needs these permissions:
- Send Messages
- Use Slash Commands
- Manage Roles
- Manage Channels
- Read Message History
- Embed Links
- Add Reactions

## Commands

### User Commands

#### `/link-wallet <address>`
Link your Ethereum wallet to receive POAPs and access gated content.
- **address**: Your Ethereum wallet address (0x...)

#### `/my-poaps [address]`
View POAP collection for your linked wallet or a specific address.
- **address** (optional): Specific Ethereum address to check

#### `/poap-info <event-id>`
Get detailed information about a POAP event.
- **event-id**: POAP event ID to lookup

### Admin Commands

#### `/distribute-poap <user> <event-id> <secret-code>`
Manually distribute a POAP to a specific user.
- **user**: Discord user to receive the POAP
- **event-id**: POAP event ID
- **secret-code**: Event secret code for minting

#### `/poap-gate <action> [options]`
Manage POAP-based access control.

**Actions:**
- `create-role-gate`: Create role requirement based on POAP ownership
- `create-channel-gate`: Create channel access based on POAP ownership
- `list-gates`: Show all configured gates
- `remove-gate`: Remove a specific gate

**Examples:**
```
/poap-gate action:create-role-gate target:@VIP poap-ids:12345,67890
/poap-gate action:create-channel-gate target:#exclusive poap-ids:12345
/poap-gate action:list-gates
/poap-gate action:remove-gate gate-id:1
```

#### `/auto-distribute <action> [options]`
Set up automatic POAP distribution rules.

**Actions:**
- `create-rule`: Create new auto-distribution rule
- `list-rules`: Show all rules for this server
- `toggle-rule`: Enable/disable a specific rule

**Triggers:**
- `member-join`: Distribute when someone joins the server
- `reaction-add`: Distribute when someone reacts to messages
- `message-sent`: Distribute based on message activity

**Examples:**
```
/auto-distribute action:create-rule trigger:member-join event-id:12345 secret-code:abc123
/auto-distribute action:list-rules
/auto-distribute action:toggle-rule rule-id:1
```

## Usage Examples

### Setting up Welcome POAPs

1. Create auto-distribution rule:
   ```
   /auto-distribute action:create-rule trigger:member-join event-id:12345 secret-code:welcome123
   ```

2. New members with linked wallets will automatically receive the POAP

### Creating VIP Role Gates

1. Create role gate:
   ```
   /poap-gate action:create-role-gate target:@VIP poap-ids:12345,67890
   ```

2. Users who own POAPs 12345 AND 67890 will automatically get the VIP role

### Manual Distribution

1. User links wallet:
   ```
   /link-wallet 0x1234567890123456789012345678901234567890
   ```

2. Admin distributes POAP:
   ```
   /distribute-poap user:@username event-id:12345 secret-code:abc123
   ```

## Features in Detail

### POAP Gating

The bot supports two types of access control:

**Role Gating**: Automatically assign roles to users who own specific POAPs
- Users get roles when they link wallets (if they own required POAPs)
- Roles are checked when new members join
- Supports AND logic (user must own ALL required POAPs)

**Channel Gating**: Grant channel access based on POAP ownership
- Creates permission overwrites for users with required POAPs
- Automatic access checking on wallet linking
- Supports private channel access

### Auto-Distribution

Three trigger types available:

**Member Join**: Distribute POAPs to new server members
- Requires users to have linked wallets
- Sends welcome DMs with POAP information
- Perfect for community onboarding

**Reaction Add**: Reward users for reacting to messages
- Distribute POAPs when users react to any message
- Great for engagement rewards
- Can be limited by admin configuration

**Message Sent**: Future feature for activity-based rewards

### Database Structure

The bot uses SQLite to store:
- User wallet linkings
- Distribution history
- Auto-distribution rules
- POAP gate configurations
- Event cache for performance

## API Integration

### POAP API Endpoints Used

- **Authentication**: OAuth2 client credentials flow
- **User Collections**: `/actions/scan/{address}`
- **Event Information**: `/events/id/{eventId}`
- **Mint Links**: `/event/{eventId}/qr-codes`
- **POAP Claiming**: `/actions/claim-qr`

### Rate Limiting

- Access tokens refresh every 24 hours
- Maximum 4 token generations per hour
- Event information cached for 1 hour
- Error handling for API failures

## Security Considerations

- Environment variables for sensitive data
- No private keys stored
- Wallet addresses validated before storage
- Admin-only commands protected by Discord permissions
- Error logging without exposing secrets

## Troubleshooting

### Common Issues

**Bot not responding to commands**
- Check bot permissions in Discord
- Verify bot token in .env file
- Check console for error messages

**POAP distribution failing**
- Verify POAP API credentials
- Check if event has available mint links
- Ensure secret code is correct

**Role gating not working**
- Verify bot has Manage Roles permission
- Check if bot role is higher than target role
- Ensure user has linked wallet

**Auto-distribution not triggering**
- Check if rules are active (`/auto-distribute action:list-rules`)
- Verify users have linked wallets
- Check event has available mint links

### Logs

Monitor console output for:
- ✅ Successful operations
- ❌ Error conditions
- 🔄 Auto-distribution events
- 🚪 Gate access grants

## Contributing

1. Fork the repository
2. Create feature branch
3. Add tests for new functionality
4. Submit pull request

## License

MIT License - see LICENSE file for details.

## Support

For issues and questions:
- Check existing GitHub issues
- Create new issue with detailed description
- Include relevant logs (without sensitive data)