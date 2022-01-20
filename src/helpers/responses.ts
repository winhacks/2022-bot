import {
    CacheType,
    CommandInteraction,
    InteractionReplyOptions,
    MessageComponentInteraction,
    MessageEmbed,
    MessagePayload,
} from "discord.js";
import {Config} from "../config";

// UTILITIES ------------------------------------------------------------------

/**
 * Responds to an interaction, safely. Will not crash in the
 * event of an already-replied interaction.
 * @param intr The interaction to reply to
 * @param reply The reply to send
 * @returns A promise to the rely, just as if `intr.reply` had been used.
 */
export const SafeReply = (
    intr: CommandInteraction<CacheType> | MessageComponentInteraction,
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

export const ResponseEmbed = () => {
    return new MessageEmbed().setColor(Config.bot_info.embedColor);
};

// SHARED RESPONSES -----------------------------------------------------------

export const SuccessResponse = (message: string) => {
    return {
        embeds: [
            ResponseEmbed().setTitle(":partying_face: Success").setDescription(message),
        ],
    };
};

export const GenericError = () => {
    return {
        embeds: [
            ResponseEmbed()
                .setTitle(":x: Command Failed")
                .setDescription(
                    "Something unexpected happened while executing this command."
                ),
        ],
    };
};

export const NotVerifiedResponse = () => {
    return {
        embeds: [
            ResponseEmbed()
                .setTitle(":x: Not Verified")
                .setDescription(
                    "You must be a verified user to use this. You can verify with `/verify`."
                ),
        ],
    };
};
