import {hyperlink, SlashCommandBuilder} from "@discordjs/builders";
import {CacheType, CommandInteraction} from "discord.js";
import {Config} from "../config";
import {EmbedToMessage, ResponseEmbed, SafeReply} from "../helpers/responses";
import {CommandType} from "../types";
import {NotInGuildResponse} from "./team/team-shared";

// FINISHED

const socialsModule: CommandType = {
    data: new SlashCommandBuilder() //
        .setName("socials")
        .setDescription("View the WinHacks socials."),
    deferMode: "NO-DEFER",
    execute: async (intr: CommandInteraction<CacheType>): Promise<any> => {
        if (!intr.inGuild()) {
            return SafeReply(intr, NotInGuildResponse());
        }

        const embed = ResponseEmbed().setTitle(":computer: Socials");
        if (Config.bot_info.thumbnail) {
            embed.setThumbnail(Config.bot_info.thumbnail);
        }

        if (!Config.socials || Config.socials.length === 0) {
            return SafeReply(
                intr,
                EmbedToMessage(
                    ResponseEmbed()
                        .setTitle(":confused: No Socials")
                        .setDescription("There are no socials. Its not you, its me.")
                )
            );
        }

        const lines = [];
        for (const {displayName, link} of Config.socials) {
            lines.push(hyperlink(displayName, link));
        }

        embed.setDescription(lines.join("\n"));
        return SafeReply(intr, EmbedToMessage(embed));
    },
};

export {socialsModule as command};
