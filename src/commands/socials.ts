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

        const embed = ResponseEmbed().setTitle("Socials");
        if (Config.bot_info.thumbnail) {
            embed.setThumbnail(Config.bot_info.thumbnail);
        }

        if (!Config.socials || Object.entries(Config.socials).length === 0) {
            return SafeReply(
                intr,
                EmbedToMessage(
                    ResponseEmbed()
                        .setTitle(":confused: No Socials")
                        .setDescription(
                            "There are no socials configured. Its not you, its me."
                        )
                )
            );
        }

        const description = Object.entries(Config.socials)?.map(([key, value]) => {
            const capitalized = key[0].toUpperCase() + key.slice(1);
            if (!value) {
                return capitalized;
            }

            return hyperlink(capitalized, value);
        });

        embed.setDescription(description.join("\n"));
        return SafeReply(intr, EmbedToMessage(embed));
    },
};

export {socialsModule as command};
