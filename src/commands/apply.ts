import {channelMention, hyperlink, SlashCommandBuilder} from "@discordjs/builders";
import {CacheType, CommandInteraction} from "discord.js";
import {Config} from "../config";
import {GenericError, ResponseEmbed, SafeReply} from "../helpers/responses";
import {logger} from "../logger";
import {CommandType} from "../types";

// FINISHED

const applyModule: CommandType = {
    data: new SlashCommandBuilder()
        .setName("apply")
        .setDescription("Instructions for how to apply."),
    deferMode: "NO-DEFER",
    execute: async (intr: CommandInteraction<CacheType>) => {
        const verifyChannel = intr.guild?.channels.cache.findKey(
            (c) => c.name === Config.verify.channel_name
        );

        if (!verifyChannel) {
            logger.error("Verify channel could not be found while running /apply.");
            return SafeReply(intr, GenericError());
        }

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

        return SafeReply(intr, {embeds: [embed], ephemeral: true});
    },
};

export {applyModule as command};
