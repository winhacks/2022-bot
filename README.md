# WinHacks 2022 Discord Bot

Bot for WinHacks 2022, written in Typescript with Discord.JS.

## Configuration

To start, copy `config.json.example` to `config.json`.

```bash
# Mac/Linux: 
cp config.json.example config.json

# Windows: 
copy config.json.example config.json
```

**Reminder:** do not under *any* circumstances commit the `config.json` file to version control. It more than like contains secret information that you *really* should keep secret.

### Discord API Configuration
 - `app_id`: Your application ID. It is located on the "general information" tab of [your application's page](https://discord.com/developers/applications)
 - `api_token`: Your bot's token. You can find it [here](https://discord.com/developers/applications), under your application > Bot > Token.
 - `api_verrsion`: usually `"9"`. The bot will probably break with any other version.
 - `bot_uid`: the "permission integer" for the bot. Typically `8` (Administrator).

### Google Sheets API Configuration
To configure the bot to work with the Google Sheets API, you will need a Google Cloud Platform project with the Google Sheets API enabled and a Service Account.

Once you have a service account, you want to add a JSON key for it. Copy the `private_key` and `client_email` fields into the respective fields in the bot config.

`scopes` is an array of scopes you wish to have for the bot. Currently, all you need is `https://www.googleapis.com/auth/spreadsheets.readonly`.

Helpful links: 
 - [Creating a GCP Project](https://developers.google.com/workspace/guides/create-project)
 - [Enabling the Google Sheets API](https://developers.google.com/workspace/guides/enable-apis)
 - [Creating a Service Account & Keys](https://developers.google.com/workspace/guides/create-credentials#service-account)
 - [Google Sheets API Scopes](https://developers.google.com/identity/protocols/oauth2/scopes#sheets)

### Development Configuration
- `dev_mode`: either `true` or `false`. When `true`, additional logging is enabled.
- `dev_guild`: When `dev_mode` is `true` and this value is specified, global commands will be redirected to the specified guild instead. Guild commands register immediately, whereas global commands may take up to an hour to register.
- `prod_guild`: the guild to register commands in when `dev_mdoe` is `false`.

### Command Specific Configuration

#### Bot Info
 - `name`: the name to appear on the embed.
 - `color` (optional): a hex color (with the `#` included) to accent the embed with.
 - `title_url` (optional): a URL the embed title should link to. Can be anything, such as the bot's GitHub/GitLab repository.
 - `thumbnail` (optional): An external image link to place in the embed thumbnail.
 - `description`: the text content to place in the embed description. Markdown-style inline links are supported.

#### Verify
 - `target_sheet`: the ID of the spreadsheet to use for verification. It will need to be shared with the service worker account. You can find the ID in the sheet URL: `https://docs.google.com/spreadsheets/d/**SHEET_ID_HERE**/edit`.
 - `email_column`: the column in the `target_sheet` that contains emails to verify users against. Must be a single letter.
 - `verified_role_name`: the display name of the role to give verified users.
