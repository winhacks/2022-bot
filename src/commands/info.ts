import {SlashCommandBuilder} from "@discordjs/builders";
import {CacheType, CommandInteraction, MessageEmbed} from "discord.js";
import {Config} from "../config";
import {ResponseEmbed} from "../helpers/responses";
import {CommandType} from "../types";

// FINISHED

const infoModule: CommandType = {
    data: new SlashCommandBuilder() //
        .setName("about")
        .setDescription("See information about the bot and its developer."),

    execute: function (interaction: CommandInteraction<CacheType>) {
        const embed = ResponseEmbed()
            .setTitle(Config.bot_info.name)
            .setDescription(Config.bot_info.description);

        if (Config.bot_info.title_url) {
            embed.setURL(Config.bot_info.title_url);
        } else if (Config.bot_info.thumbnail) {
            embed.setThumbnail(Config.bot_info.thumbnail);
        }

        return interaction.reply({embeds: [embed]});
    },
};

export {infoModule as command};
