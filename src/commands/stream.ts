import {SlashCommandBuilder} from "@discordjs/builders";
import {CacheType, CommandInteraction} from "discord.js";
import {Config} from "../config";
import {ErrorMessage, ResponseEmbed, SafeReply} from "../helpers/responses";
import {CommandType} from "../types";

const streamModule: CommandType = {
    data: new SlashCommandBuilder()
        .setName("stream")
        .setDescription("Links the WinHacks stream"),
    deferMode: "NO-DEFER",
    execute: async (intr: CommandInteraction<CacheType>) => {
        const twitchSocial = Config.socials.find(
            ({displayName}) =>
                displayName.toLowerCase() === "twitch" ||
                displayName.toLowerCase() === "twitchtv" ||
                displayName.toLowerCase() === "twitch.tv"
        );

        if (!twitchSocial) {
            return SafeReply(intr, ErrorMessage({ephemeral: true}));
        }

        const embed = ResponseEmbed()
            .setTitle(":red_circle: Join Us Live On Twitch!")
            .setDescription(
                `Join us live on the UWindsor CSS Twitch channel, which can be found at ${twitchSocial.link}.`
            );
        return SafeReply(intr, {embeds: [embed]});
    },
};

export {streamModule as command};
