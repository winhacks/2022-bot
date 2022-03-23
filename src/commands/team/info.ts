import {CacheType, CommandInteraction} from "discord.js";
import {ChannelLink, UserLink} from "../../helpers/misc";
import {ResponseEmbed, SafeReply} from "../../helpers/responses";
import {TeamType} from "../../types";
import {NotInGuildResponse} from "./team-shared";

export const TeamInfo = async (
    intr: CommandInteraction<CacheType>,
    team: TeamType
): Promise<any> => {
    if (!intr.inGuild()) {
        return SafeReply(intr, NotInGuildResponse());
    }

    const members = team.members.map((id) => UserLink(id));
    const channels = [
        ChannelLink(team.textChannel), //
        ChannelLink(team.voiceChannel),
    ];

    const embed = ResponseEmbed()
        .setTitle(team.name)
        .addField("Team Members:", members.join("\n"))
        .addField("Team Channels", channels.join("\n"));

    return SafeReply(intr, {embeds: [embed]});
};
