import {SlashCommandBuilder} from "@discordjs/builders";
import {CacheType, CommandInteraction} from "discord.js";
import {Config} from "../config";
import {ResponseEmbed, SafeReply} from "../helpers/responses";
import {CommandType} from "../types";

const scheduleModule: CommandType = {
    data: new SlashCommandBuilder()
        .setName("schedule")
        .setDescription(`See the ${Config.bot_info.event_name} Schedule`),
    deferMode: "NO-DEFER",
    execute: async (intr: CommandInteraction<CacheType>) => {
        const embed = ResponseEmbed()
            .setTitle(":calendar: Check Out Our Schedule!")
            .setURL("https://winhacks.ca/#schedule")
            .setDescription(
                "Head to our website to see all of our events and workshops! https://winhacks.ca/#schedule"
            );
        return SafeReply(intr, {embeds: [embed]});
    },
};

export {scheduleModule as command};
