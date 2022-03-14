import {CacheType, CommandInteraction} from "discord.js";
import {ChannelLink} from "../../helpers/misc";
import {EmbedToMessage, ResponseEmbed, SafeReply} from "../../helpers/responses";
import {TeamType} from "../../types";
import {NotInGuildResponse} from "./team-shared";

export const TeamInfo = async (
    intr: CommandInteraction<CacheType>,
    team: TeamType
): Promise<any> => {
    if (!intr.inGuild()) {
        return SafeReply(intr, NotInGuildResponse());
    }

    const memberCache = intr.guild!.members.cache;

    // FIXME: this can actually fail, if the leader leaves the server.
    // We should fix that by triggering team leave when the leader leaves
    const members = team.members.map((id) => memberCache.get(id)?.displayName);

    const channels = [
        ChannelLink(team.textChannel), //
        ChannelLink(team.voiceChannel),
    ];

    const embed = ResponseEmbed()
        .setTitle(team.name)
        .addField("Team Members:", members.join("\n"), true)
        .addField("Team Channels", channels.join("\n"));

    return SafeReply(intr, EmbedToMessage(embed));
};
