import {CacheType, Client, Collection, Intents, Interaction} from "discord.js";
import {ClientType, CommandType, EventType} from "./types";
import {Config, LoadConfig} from "./config";
import {RegisterCommands} from "./helpers/commandManager";
import {logger} from "./logger";
import {readdirSync} from "fs";
import {AuthenticateGoogleAPI} from "./helpers/sheetsAPI";
import {GenericError, SafeDeferReply, SafeReply} from "./helpers/responses";
import {AuthenticateMongo} from "./helpers/database";
import {format as formatPath} from "path";

let client: ClientType;

const start = async (): Promise<void> => {
    logger.info("Loading config...");
    LoadConfig("config.json5");

    const dapiInfo = Config.dev_mode ? Config.development : Config.production;

    logger.info("Authenticating with APIs...");
    client = new Client({
        intents: [
            Intents.FLAGS.GUILDS,
            Intents.FLAGS.GUILD_MEMBERS,
            Intents.FLAGS.DIRECT_MESSAGES,
        ],
    }) as ClientType;
    client.commands = new Collection<string, CommandType>();

    await AuthenticateGoogleAPI();
    await AuthenticateMongo();

    // dynamic command loader
    const commandFiles = readdirSync("./src/commands") //
        .filter((name) => name.endsWith(".ts"));

    const commandsToRegister = [];
    for (const file of commandFiles) {
        const filePath = formatPath({root: "./commands/", name: file});
        const {command} = (await import(filePath)) as {command: CommandType};

        logger.info(`Loaded ${filePath} as command`);
        client.commands.set(command.data.name, command);
        commandsToRegister.push(command);
    }

    await RegisterCommands(
        commandsToRegister,
        dapiInfo.guild,
        dapiInfo.api_token,
        dapiInfo.app_id
    );

    // dynamic event loader
    const eventFiles = readdirSync("./src/events") //
        .filter((name) => name.endsWith(".ts"));

    for (const file of eventFiles) {
        const filePath = formatPath({root: "./events/", name: file});
        const {event} = (await import(filePath)) as {event: EventType};

        logger.info(`Loaded ${filePath} as event (${event.eventName})`);

        if (event.once) {
            client.once(event.eventName, (...args) => event.execute(client, ...args));
        } else {
            client.on(event.eventName, (...args) => event.execute(client, ...args));
        }
    }

    if (Config.dev_mode) {
        client.on("error", logger.error);
        client.on("warn", logger.warn);
    }

    await client.login(dapiInfo.api_token);
};

// graceful exit handler
require("shutdown-handler").on("exit", (event: Event) => {
    event.preventDefault(); // delay process closing

    client.emit("shutdown");

    logger.info("Graceful shutdown completed. Exiting...");
    process.exit();
});

// start bot
start();
