import {
    CacheType,
    CommandInteraction,
    InteractionReplyOptions,
    MessageEmbed,
    MessagePayload,
} from "discord.js";
import {Config} from "../config";

export const ChannelLink = (id: string) => `<#${id}>`;

export const GenericError = {
    embeds: [
        new MessageEmbed()
            .setTitle(":x: Command Failed")
            // .setColor(Config.bot_info.color)
            .setDescription(
                "Something unexpected happened while executing this command."
            ),
    ],
};

/**
 * Responds to an interaction, safely. Will not crash in the
 * event of an already-replied interaction.
 * @param intr The interaction to reply to
 * @param reply The reply to send
 * @returns A promise to the rely, just as if `intr.reply` had been used.
 */
export const SafeReply = (
    intr: CommandInteraction<CacheType>,
    reply: string | MessagePayload | InteractionReplyOptions
) => {
    if (intr.replied) {
        return intr.followUp(reply);
    } else if (intr.deferred) {
        return intr.editReply(reply);
    } else {
        return intr.reply(reply);
    }
};
