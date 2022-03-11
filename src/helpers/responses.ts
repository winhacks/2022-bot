import {
    CacheType,
    CommandInteraction,
    InteractionReplyOptions,
    MessageComponentInteraction,
    MessageEmbed,
    MessageOptions,
    MessagePayload,
} from "discord.js";
import {Config} from "../config";
import {logger} from "../logger";

// UTILITIES ------------------------------------------------------------------

/**
 * Responds to an interaction, safely. Will not crash in the
 * event of an already-replied interaction.
 * @param intr The interaction to reply to
 * @param reply The reply to send
 * @returns A promise to the reply, just as if `intr.reply` had been used.
 */
export const SafeReply = (
    intr: CommandInteraction<CacheType> | MessageComponentInteraction,
    reply: string | MessagePayload | InteractionReplyOptions
) => {
    try {
        if (intr.replied) {
            return intr.followUp(reply);
        } else if (intr.deferred) {
            return intr.editReply(reply);
        } else {
            return intr.reply(reply);
        }
    } catch (err) {
        logger.error(`Reply failed: ${err}`);
    }
    return null;
};

/**
 *
 * @param intr The interaction to defer responding to
 * @param ephemeral Whether or not the deferral should be ephemeral (default false)
 * @returns a promise that resolves either on error (which is caught and logged) or on success
 */
export const SafeDeferReply = async (
    intr: CommandInteraction<CacheType>,
    ephemeral: boolean = false
) => {
    try {
        if (!intr.deferred && !intr.replied) {
            return intr.deferReply({ephemeral: ephemeral});
        }
    } catch (err) {
        logger.error(`Deferral failed: ${err}`);
    }
};

/**
 * Base builder for embed responses.
 * @returns A MessageEmbed builder with default styling
 */
export const ResponseEmbed = () => {
    return new MessageEmbed().setColor(Config.bot_info.color);
};

export const EmbedToMessage = (embed: MessageEmbed): MessageOptions => {
    return {embeds: [embed]};
};

// SHARED RESPONSES -----------------------------------------------------------

export const SuccessResponse = (message: string, ephemeral: boolean = false) => {
    return {
        ephemeral,
        embeds: [
            ResponseEmbed().setTitle(":partying_face: Success").setDescription(message),
        ],
    };
};

export const GenericError = (ephemeral: boolean = false) => {
    return {
        ephemeral,
        embeds: [
            ResponseEmbed()
                .setTitle(":x: Command Failed")
                .setDescription(
                    "Something unexpected happened while executing this command."
                ),
        ],
    };
};

export const NotVerifiedResponse = (ephemeral: boolean = false) => {
    return {
        ephemeral,
        embeds: [
            ResponseEmbed()
                .setTitle(":x: Not Verified")
                .setDescription(
                    "You must be a verified user to use this. You can verify with `/verify`."
                ),
        ],
    };
};
