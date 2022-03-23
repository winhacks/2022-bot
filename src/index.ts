import {Client, Collection, Intents} from "discord.js";
import {ClientType, CommandType, EventType} from "./types";
import {Config, LoadConfig} from "./config";
import {RegisterCommands} from "./helpers/commandManager";
import {logger} from "./logger";
import {readdirSync} from "fs";
import {AuthenticateGoogleAPI} from "./helpers/sheetsAPI";
import {AuthenticateMongo} from "./helpers/database";
import {format as formatPath} from "path";

let client: ClientType;

const start = async (): Promise<void> => {
    /*
     * Config loading
     */
    logger.info("Loading config...");
    LoadConfig("config.json5");

    const discordApiInfo = Config.dev_mode ? Config.development : Config.production;

    /*
     * Bot API authentications
     */
    logger.info("Authenticating with APIs...");
    client = new Client({
        intents: [
            Intents.FLAGS.GUILDS, // TODO: try removing this. May in fact not be required.
            Intents.FLAGS.GUILD_MEMBERS,
            Intents.FLAGS.DIRECT_MESSAGES,
        ],
    }) as ClientType;
    client.commands = new Collection<string, CommandType>();

    await AuthenticateGoogleAPI();
    logger.debug("Google: OK");
    await AuthenticateMongo();
    logger.debug("MongoDB: OK");

    /*
     * Command loading
     */
    const commandFiles = readdirSync("./src/commands") //
        .filter((name) => name.endsWith(".ts"));

    logger.info(`Loading ${commandFiles.length} commands...`);
    const commandsToRegister = [];
    for (const file of commandFiles) {
        const filePath = formatPath({dir: "./commands/", name: file});
        const {command} = (await import(filePath)) as {command: CommandType};

        logger.debug(`Loaded ${file}`);
        client.commands.set(command.data.name, command);
        commandsToRegister.push(command);
    }

    await RegisterCommands(commandsToRegister, discordApiInfo);

    /*
     * Event loading
     */
    const eventFiles = readdirSync("./src/events") //
        .filter((name) => name.endsWith(".ts"));

    logger.info(`Loading ${commandFiles.length} commands...`);
    for (const file of eventFiles) {
        const filePath = formatPath({dir: "./events/", name: file});
        const {event} = (await import(filePath)) as {event: EventType};

        logger.debug(`Loaded ${file} (${event.eventName})`);

        const eventCallback = (...args: any[]) => event.execute(client, ...args);
        if (event.once) {
            client.once(event.eventName, eventCallback);
        } else {
            client.on(event.eventName, eventCallback);
        }
    }

    if (Config.dev_mode) {
        client.on("error", logger.error);
        client.on("warn", logger.warn);
    }

    await client.login(discordApiInfo.api_token);
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
