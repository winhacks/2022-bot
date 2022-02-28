import {CacheType, Client, Collection, Intents, Interaction} from "discord.js";
import {ClientType, CommandType} from "./types";
import {Config, LoadConfig} from "./config";
import {RegisterCommands} from "./helpers/commandManager";
import {logger} from "./logger";
import path from "path";
import {readdirSync} from "fs";
import {AuthenticateGoogleAPI} from "./helpers/sheetsAPI";
import {GenericError, SafeDeferReply, SafeReply} from "./helpers/responses";
import {AuthenticateMongo, CountEntities, verifiedCollection} from "./helpers/database";

let client: ClientType;

const start = async () => {
    logger.info("Loading config...");
    LoadConfig("config.json5");

    const dapiInfo = Config.dev_mode ? Config.development : Config.production;

    logger.info("Authenticating with APIs...");
    client = new Client({
        intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.DIRECT_MESSAGES],
    }) as ClientType;

    client.commands = new Collection<string, CommandType>();
    await client.login(dapiInfo.api_token);
    logger.info("Discord: OK");
    await AuthenticateGoogleAPI();
    logger.info("Sheets: OK");
    await AuthenticateMongo();
    logger.info("Mongo: OK");

    let message;
    const registeredCount = await CountEntities(verifiedCollection);
    switch (registeredCount) {
        case 0:
            message = "nobody :frowning:";
            break;
        case 1:
            message = "1 verified hacker";
            break;
        default:
            message = `${registeredCount} verified hackers`;
            break;
    }

    client.user?.setPresence({
        status: "online",
        activities: [{type: "WATCHING", name: message}],
    });

    // dynamic command loader
    const commandFiles = readdirSync("./src/commands")
        .filter((name) => name.endsWith(".ts"))
        .map((name) => name.slice(), -3);

    const commandsToRegister = [];
    for (const file of commandFiles) {
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

    // command dispatcher
    client.on("interactionCreate", async (intr: Interaction<CacheType>) => {
        if (intr.isCommand()) {
            const command = client.commands.get(intr.commandName);
            if (!command) {
                SafeReply(intr, GenericError());
                return;
            }

            try {
                if (command.deferMode !== "NO-DEFER") {
                    await SafeDeferReply(intr, command.deferMode === "EPHEMERAL");
                }

                await command.execute(intr);
            } catch (err) {
                logger.error(err);
                SafeReply(intr, GenericError());
            }
        }
    });

    logger.info(`Bot setup has finished: ${numReg} commands registered.`);
};

// graceful exit handler
require("shutdown-handler").on("exit", (event: Event) => {
    event.preventDefault(); // delay process closing

    // update presence
    try {
        client.user?.setPresence({status: "invisible", activities: []});
    } catch (err) {
        logger.warn("Failed to update presence");
    }

    logger.info("Graceful shutdown completed. Exiting...");
    process.exit();
});

// start bot
start();
