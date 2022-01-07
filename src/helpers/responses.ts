import {CacheType, CommandInteraction, InteractionReplyOptions, MessagePayload} from "discord.js";

/**
 * Responds to an interaction, safely. Will not crash in the
 * event of an already-replied interaction.
 * @param intr The interaction to reply to
 * @param reply The reply to send
 * @returns A promise to the repy, just as if `intr.reply` had been used.
 */
export const safeReply = (
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
