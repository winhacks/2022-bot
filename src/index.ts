import {CacheType, Client, Collection, Intents, Interaction} from "discord.js";
import {ClientType, CommandType} from "./types";
import {Config, LoadConfig} from "./config";
import {RegisterCommands} from "./helpers/commandManager";
import {logger} from "./logger";
import path from "path";
import {readdirSync} from "fs";
import {AuthenticateGoogleAPI} from "./helpers/sheetsAPI";
import {safeReply} from "./helpers/responses";
import {AuthenticateMongo} from "./helpers/mongoDB";

const start = async () => {
    /*
     * Config loading, client(s) setup
     */
    LoadConfig("config.json");

    const client = new Client({
        intents: [Intents.FLAGS.GUILDS],
    }) as ClientType;
    client.commands = new Collection<string, CommandType>();

    await client.login(Config.api_token);
    await AuthenticateGoogleAPI();
    await AuthenticateMongo();

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

        logger.info(`Loaded ${filePath + ".ts"} as command`);
        client.commands.set(command.data.name, command);
        commandsToRegister.push(command);
    }

    let numReg = 0;
    if (Config.dev_mode && Config.dev_guild) {
        numReg = await RegisterCommands(commandsToRegister, Config.dev_guild);
    } else {
        numReg = await RegisterCommands(commandsToRegister, Config.prod_guild);
    }

    /*
     * Interaction handler
     */
    client.on("interactionCreate", async (intr: Interaction<CacheType>) => {
        const errRes = {
            content: "There was an error while executing this command.",
            ephemeral: true,
        };

        // command dispatcher
        if (intr.isCommand()) {
            const command = client.commands.get(intr.commandName) as CommandType;
            if (!command) safeReply(intr, errRes);

            try {
                await command.execute(intr);
            } catch (error) {
                logger.error(error);
                safeReply(intr, errRes);
            }
        }
    });

    logger.info(`Bot setup has finished: ${numReg} commands registered.`);
};

const stop = async () => {
    let numReg;

    // unregister commands
    if (Config.dev_mode && Config.dev_guild) {
        numReg = await RegisterCommands([], Config.dev_guild);
    } else {
        numReg = await RegisterCommands([], Config.prod_guild);
    }

    logger.info(`${numReg}Commands unregistered.`);
};

process.on("exit", async () => {
    console.log("Exiting...");
    await stop();
    process.exit();
});

// node ignores sigint for some reason, lets add a listener that kills the bot
process.on("SIGINT", async (sig) => {
    process.exit();
});

// start bot
start();
