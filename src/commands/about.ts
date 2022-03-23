import {SlashCommandBuilder} from "@discordjs/builders";
import {CacheType, CommandInteraction} from "discord.js";
import {Config} from "../config";
import {ResponseEmbed, SafeReply} from "../helpers/responses";
import {CommandType} from "../types";

// FINISHED

const aboutModule: CommandType = {
    data: new SlashCommandBuilder()
        .setName("about")
        .setDescription("See information about the bot and its developer."),
    deferMode: "NO-DEFER",
    execute: async (interaction: CommandInteraction<CacheType>) => {
        const embed = ResponseEmbed()
            .setTitle(Config.bot_info.name)
            .setDescription(Config.bot_info.description);

        if (Config.bot_info.title_url) {
            embed.setURL(Config.bot_info.title_url);
        } else if (Config.bot_info.thumbnail) {
            embed.setThumbnail(Config.bot_info.thumbnail);
        }

        return SafeReply(interaction, {embeds: [embed]});
    },
};

export {aboutModule as command};
