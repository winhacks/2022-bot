import {SlashCommandBuilder} from "@discordjs/builders";
import {CacheType, CommandInteraction} from "discord.js";
import {SafeReply} from "../helpers/responses";
import {CommandType} from "../types";

// FINISHED

const pingModule: CommandType = {
    data: new SlashCommandBuilder() //
        .setName("ping")
        .setDescription("Ping. Pong?"),
    ephemeral: true,
    execute: async (intr: CommandInteraction<CacheType>) => {
        return SafeReply(intr, "PONG!");
    },
};

export {pingModule as command};
