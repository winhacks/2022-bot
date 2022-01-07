import {CacheType, Client, Collection, Intents, Interaction} from "discord.js";
import {ClientType, CommandType} from "./types";
import {Config, LoadConfig} from "./config";

import {RegisterCommands} from "./helpers/commandManager";
import {getCredentials} from "./helpers/sheetsAPI";
import {logger} from "./logger";
import path from "path";
import {readdirSync} from "fs";

const start = async () => {
    LoadConfig("config.json");

    const client = new Client({
        intents: [Intents.FLAGS.GUILDS],
    }) as ClientType;

    client.commands = new Collection<string, CommandType>();
    await client.login(Config.api_token);

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
        // command dispatcher
        if (intr.isCommand()) {
            const command = client.commands.get(intr.commandName) as CommandType;

            try {
                await command.execute(intr);
            } catch (error) {
                logger.error(error);
                return intr.reply({
                    content: "There was an error while executing this command.",
                    ephemeral: true,
                });
            }
        }
    });

    logger.info(`Bot setup has finished: ${numReg} commands`);
};

// start bot
start();
