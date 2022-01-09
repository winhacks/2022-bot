import {
    CacheType,
    CommandInteraction,
    InteractionReplyOptions,
    MessageEmbed,
    MessagePayload,
} from "discord.js";
import {Config} from "../config";

/**
 * Responds to an interaction, safely. Will not crash in the
 * event of an already-replied interaction.
 * @param intr The interaction to reply to
 * @param reply The reply to send
 * @returns A promise to the rely, just as if `intr.reply` had been used.
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

export const SimpleTextEmbed = (
    title: string,
    description: string,
    thumbnail: string | undefined = Config.bot_info.thumbnail,
    color: string | undefined = Config.bot_info.color
) => {
    const embed = new MessageEmbed().setTitle(title).setDescription(description);
    if (thumbnail) embed.setThumbnail(thumbnail);
    if (color) embed.setColor(Number.parseInt(color.slice(1), 16));
    return embed;
};

export const SimpleTextResponse = (
    title: string,
    description: string,
    thumbnail: string | undefined = Config.bot_info.thumbnail,
    color: string | undefined = Config.bot_info.color
) => {
    return {embeds: [SimpleTextEmbed(title, description, thumbnail, color)]};
};
