import {CacheType, CommandInteraction} from "discord.js";
import {NamedCommand} from "../helpers/commands";
import {CommandType} from "../types";

const pingModule: CommandType = {
    data: NamedCommand("ping", "Ping. Pong?"),
    execute: async (intr: CommandInteraction<CacheType>) => {
        return intr.reply("Pong!");
    },
};

export {pingModule as command};
