import {SlashCommandBuilder} from "@discordjs/builders";
import {CacheType, CommandInteraction, MessageEmbed} from "discord.js";
import {Config} from "../config";
import {NamedCommand} from "../helpers/commands";
import {CommandType} from "../types";

const infoModule: CommandType = {
    data: NamedCommand("aboutme", "See information about the bot and its developer."),
    execute: function (interaction: CommandInteraction<CacheType>) {
        const embed = new MessageEmbed()
            .setTitle(Config.bot_info.name)
            .setDescription(Config.bot_info.description);

        if (Config.bot_info.title_url) embed.setURL(Config.bot_info.title_url);
        if (Config.bot_info.thumbnail) embed.setThumbnail(Config.bot_info.thumbnail);
        if (Config.bot_info.color)
            embed.setColor(Number.parseInt(Config.bot_info.color.slice(1), 16));

        return interaction.reply({embeds: [embed]});
    },
};

export {infoModule as command};
