# WinHacks 2022 Discord Bot

Bot for WinHacks 2022, written in Typescript with Discord.JS. Uses a MongoDB database to store team information and the Google Sheets API to verify users using a spreadsheet.

## Configuration

To start, copy `config.json.example` to `config.json`.

```bash
# Mac/Linux:
cp config.json.example config.json

# Windows:
copy config.json.example config.json
```

**Reminder:** do not under _any_ circumstances commit the `config.json` file to version control. It more than like contains secret information that you _really_ should keep secret.

### Discord API Configuration

-   `app_id`: Your application ID. It is located on the "general information" tab of [your application's page](https://discord.com/developers/applications)
-   `api_token`: Your bot's token. You can find it [here](https://discord.com/developers/applications), under your application > Bot > Token.
-   `api_version`: usually `"9"`. The bot will probably break with any other version.
-   `bot_uid`: the "permission integer" for the bot. Typically `8` (Administrator).

### Google Sheets API Configuration

To configure the bot to work with the Google Sheets API, you will need a Google Cloud Platform project with the Google Sheets API enabled and a Service Account.

Once you have a service account, you want to add a JSON key for it. Copy the `private_key` and `client_email` fields into the respective fields in the bot config.

`scopes` is an array of scopes you wish to have for the bot. Currently, all you need is `https://www.googleapis.com/auth/spreadsheets.readonly`.

Helpful links:

-   [Creating a GCP Project](https://developers.google.com/workspace/guides/create-project)
-   [Enabling the Google Sheets API](https://developers.google.com/workspace/guides/enable-apis)
-   [Creating a Service Account & Keys](https://developers.google.com/workspace/guides/create-credentials#service-account)
-   [Google Sheets API Scopes](https://developers.google.com/identity/protocols/oauth2/scopes#sheets)

### MongoDB Configuration

To configure the bot to work with MongoDB, you will need a MongoDB database. [MongoDB Atlas](https://www.mongodb.com/atlas) is a good, free choice for small scale uses.

Once you have a database, you need to add its details to the config. Most of the following information can be obtained from the MongoDB Atlas dashboard, if you're using Atlas.

-   `database_url`: the URL to connect to your MongoDB server with. On the dashboard for the database you wish to use, click "Connect". Choose "Connect your Application", then "Node.JS", "4.0 or Later", and "X.509". The URL is in the box below.
-   `certificate`: the PEM certificate to connect with. On the dashboard, click "Database Access". Select "Add New Database User". Change the Authentication Method to "Certificate". Enter a common name and turn on "Download certificate when user is added". Select an expiration date and finish filling out the form. The certificate will need access to the database named in `teams.database_name`. Finally, copy the certificate into the config file. Replace the newlines with `\n` in the config string. Make sure you include the `BEGIN CERTIFICATE` and `END CERTIFICATE` lines.
-   `private_key`: This is the second half of the certificate you downloaded above. Once again, replace newlines with `\n` and include `BEGIN PRIVATE KEY` and `END PRIVATE KEY`.

### Development Configuration

-   `dev_mode`: either `true` or `false`. When `true`, additional logging is enabled.
-   `dev_guild`: When `dev_mode` is `true` and this value is specified, global commands will be redirected to the specified guild instead. Guild commands register immediately, whereas global commands may take up to an hour to register.
-   `prod_guild`: the guild to register commands in when `dev_mode` is `false`.

### Command Specific Configuration

#### Bot Info

-   `name`: the name to appear on the embed.
-   `color` (optional): a hex color (with the `#` included) to accent the embed with.
-   `title_url` (optional): a URL the embed title should link to. Can be anything, such as the bot's GitHub/GitLab repository, or your event's homepage.
-   `thumbnail` (optional): An external image link to place in the embed thumbnail.
-   `description`: the text content to place in the embed description. Markdown-style inline links are supported.

#### Verify

-   `target_sheet_id`: the ID of the spreadsheet to use for verification. It will need to be shared with the service worker account. You can find the ID in the sheet URL: `https://docs.google.com/spreadsheets/d/**SHEET_ID_HERE**/edit`.
-   `target_sheet`: the name of the sheet to use for verification data.
-   `email_column`: the column in the `target_sheet` that contains emails to verify users against. Must be a single letter.
-   `verified_role_name`: the display name of the role to give verified users.

#### Teams

-   `database_name`: the name of your MongoDB database
-   `collection_name`: the name of the database collection to store team information in
-   `max_name_length`: the number of characters which is considered too long fora team name. Discord limits this to 100.

# Known Issues

This section lists any known issues with the bot that I have decided not to fix for the time being. Usually, these are events that I consider "unlikely".

## Team Operations - Transaction Fighting (Medium Priority)

### Issue Description

`WithTransaction` asks the MongoDB server for a session (a transaction). If another session is requested, an error is thrown which may crash the bot.

### Example Scenario

User A invites User B and User C to their team. Both Users receive the invite in their DM and promptly respond to it. User B selects "accept" (first transaction). Moments after, while the system is still processing User B's request, User C selects "accept" (second transaction). There is now a second session being requested which is not allowed.

### Proposed Solution(s)

-   An event queue preventing two `WithTransaction` calls from requesting a session while the other is still using its session.
-   Rewriting some scenarios that currently utilize `WithTransaction` to use messier but transaction-free code.
