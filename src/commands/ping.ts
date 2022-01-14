import {SlashCommandBuilder} from "@discordjs/builders";
import {CacheType, CommandInteraction} from "discord.js";
import {CommandType} from "../types";

// FINISHED

const pingModule: CommandType = {
    data: new SlashCommandBuilder() //
        .setName("ping")
        .setDescription("Ping. Pong?"),

    execute: async (intr: CommandInteraction<CacheType>) => {
        return intr.reply("Pong!");
    },
};

export {pingModule as command};
