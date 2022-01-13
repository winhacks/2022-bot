import {hyperlink, SlashCommandBuilder} from "@discordjs/builders";
import {CacheType, CommandInteraction, MessageEmbed} from "discord.js";
import {Config} from "../config";
import {SafeReply} from "../helpers/responses";
import {CommandType} from "../types";

const socialsModule: CommandType = {
    data: new SlashCommandBuilder() //
        .setName("socials")
        .setDescription("View the WinHacks socials."),

    execute: async (intr: CommandInteraction<CacheType>): Promise<any> => {
        const embed = new MessageEmbed()
            .setTitle("Socials")
            .setColor(Config.bot_info.embedColor);

        if (Config.bot_info.thumbnail) {
            embed.setThumbnail(Config.bot_info.thumbnail);
        }

        if (!Config.socials) {
            return SafeReply(intr, {
                embeds: [
                    new MessageEmbed()
                        .setColor(Config.bot_info.embedColor)
                        .setTitle(":confused: No Socials")
                        .setDescription(
                            "There are no socials configured. Its not you, its me."
                        ),
                ],
            });
        }

        const description = Object.entries(Config.socials)?.map(([key, value]) => {
            if (!value) {
                return undefined;
            }

            const name = key[0].toUpperCase() + key.slice(1);
            return hyperlink(name, value);
        });

        embed.setDescription(description.join("\n"));
        return SafeReply(intr, {embeds: [embed]});
    },
};

export {socialsModule as command};
