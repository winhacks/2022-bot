import {channelMention, hyperlink, SlashCommandBuilder} from "@discordjs/builders";
import {CacheType, CommandInteraction} from "discord.js";
import {Config} from "../config";
import {ResponseEmbed, SafeReply} from "../helpers/responses";
import {CommandType} from "../types";

// FINISHED

const applyModule: CommandType = {
    data: new SlashCommandBuilder()
        .setName("apply")
        .setDescription("Instructions for how to apply."),
    ephemeral: true,
    execute: async (interaction: CommandInteraction<CacheType>) => {
        const verifyChannel = interaction.guild?.channels.cache.findKey(
            (c) => c.name === Config.verify.channel_name
        );

        let onlineLink = hyperlink("online", Config.verify.registration_url);
        let applyInstructions = `To apply, first register ${onlineLink}`;

        let verifyInstructions = verifyChannel
            ? `head over to ${channelMention(verifyChannel)} and`
            : "";
        verifyInstructions += " use `/verify` to verify your Discord account";

        const embed = ResponseEmbed()
            .setTitle(":question: How to Apply")
            .setDescription(
                `Welcome to WinHacks!\n\n${applyInstructions}. Then ${verifyInstructions}.`
            );

        return SafeReply(interaction, {embeds: [embed]});
    },
};

export {applyModule as command};
