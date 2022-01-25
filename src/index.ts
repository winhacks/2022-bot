import {CacheType, Client, Collection, Intents, Interaction} from "discord.js";
import {ClientType, CommandType} from "./types";
import {Config, LoadConfig} from "./config";
import {RegisterCommands} from "./helpers/commandManager";
import {logger} from "./logger";
import path from "path";
import {readdirSync} from "fs";
import {AuthenticateGoogleAPI} from "./helpers/sheetsAPI";
import {GenericError, SafeDeferReply, SafeReply} from "./helpers/responses";
import {AuthenticateMongo} from "./helpers/database";

const start = async () => {
    logger.info("Loading config...");
    LoadConfig("config.json5");

    const dapiInfo = Config.dev_mode ? Config.development : Config.production;

    logger.info("Logging into Discord...");
    const client = new Client({
        intents: [
            Intents.FLAGS.GUILDS,
            Intents.FLAGS.DIRECT_MESSAGES,
            // Intents.FLAGS.GUILD_MEMBERS,
        ],
    }) as ClientType;
    client.commands = new Collection<string, CommandType>();

    logger.info("Authenticating with APIs...");
    await client.login(dapiInfo.api_token);
    logger.info("Discord: OK");
    await AuthenticateGoogleAPI();
    logger.info("Sheets: OK");
    await AuthenticateMongo();
    logger.info("Mongo: OK");

    /**
     * Load commands
     */
    const commandFiles = readdirSync("./src/commands")
        .filter((name) => name.endsWith(".ts"))
        .map((name) => name.slice(), -3);

    const commandsToRegister = [];
    for (const file of commandFiles) {
        // dynamic import
        const filePath = path.format({root: "./commands/", name: file});
        const {command} = (await import(filePath)) as {command: CommandType};

        logger.info(`Loaded ${filePath} as command`);
        client.commands.set(command.data.name, command);
        commandsToRegister.push(command);
    }

    let numReg = await RegisterCommands(
        commandsToRegister,
        dapiInfo.guild,
        dapiInfo.api_token,
        dapiInfo.app_id
    );

    /*
     * Interaction handler
     */
    client.on("interactionCreate", async (intr: Interaction<CacheType>) => {
        // command dispatcher
        if (intr.isCommand()) {
            const command = client.commands.get(intr.commandName);
            if (!command) {
                SafeReply(intr, GenericError());
                return;
            }

            try {
                await SafeDeferReply(intr, command.ephemeral);
                await command.execute(intr);
            } catch (err) {
                logger.error(err);
                SafeReply(intr, GenericError());
            }
        }
    });

    logger.info(`Bot setup has finished: ${numReg} commands registered.`);
};

// start bot
start();
