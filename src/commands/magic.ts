import {SlashCommandBuilder} from "@discordjs/builders";
import {CacheType, CommandInteraction} from "discord.js";
import {CommandType} from "../types";
import {command} from "./ping";

const resetPermissionsModule: CommandType = {
    data: new SlashCommandBuilder()
        .setName("magic")
        .setDefaultPermission(false)
        .setDescription("Admin only. Patches team channel permissions to use new system"),
    deferMode: "EPHEMERAL",
    execute: async (intr: CommandInteraction<CacheType>) => {
        return command.execute(intr);
    },
};

export {resetPermissionsModule as command};
