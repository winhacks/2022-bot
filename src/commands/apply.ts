import {hyperlink, SlashCommandBuilder} from "@discordjs/builders";
import {CacheType, CommandInteraction} from "discord.js";
import {Config} from "../config";
import {ChannelLink} from "../helpers/misc";
import {ErrorMessage, ResponseEmbed, SafeReply} from "../helpers/responses";
import {logger} from "../logger";
import {CommandType} from "../types";

let verifyChannelId: string | undefined = undefined;

const applyModule: CommandType = {
    data: new SlashCommandBuilder()
        .setName("apply")
        .setDescription("Instructions for how to apply."),
    deferMode: "NO-DEFER",
    execute: async (intr: CommandInteraction<CacheType>) => {
        if (!verifyChannelId) {
            verifyChannelId = intr.guild?.channels.cache.findKey(
                (c) => c.name === Config.verify.channel_name
            );
        }

        if (!verifyChannelId) {
            logger.error("Verify channel could not be found while running /apply.");
            return SafeReply(intr, ErrorMessage());
        }

        let onlineLink = hyperlink("online", Config.verify.registration_url);
        let applyInstructions = `To apply, first register ${onlineLink}`;

        let verifyInstructions = verifyChannelId
            ? `head over to ${ChannelLink(verifyChannelId)} and`
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
