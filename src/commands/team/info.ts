import {CacheType, CommandInteraction} from "discord.js";
import {FindOne, teamCollection} from "../../helpers/database";
import {ChannelLink} from "../../helpers/misc";
import {ResponseEmbed, SafeReply} from "../../helpers/responses";
import {TeamType} from "../../types";
import {NotInGuildResponse, NotInTeamResponse, TeamByMember} from "./team-shared";

// FINISHED

export const TeamInfo = async (intr: CommandInteraction<CacheType>): Promise<any> => {
    if (!intr.guild) {
        return SafeReply(intr, NotInGuildResponse());
    }

    const team = await FindOne<TeamType>(
        teamCollection,
        TeamByMember(intr.user.id, true)
    );

    if (!team) {
        return SafeReply(intr, NotInTeamResponse());
    }

    const memberCache = intr.guild!.members.cache;

    // FIXME: this can actually fail, if the leader leaves the server.
    // We should fix that by triggering team leave when the leader leaves
    const leader = memberCache.get(team.owner)!.displayName;
    const members = team.members.map((id) => memberCache.get(id)?.displayName);

    const channels = [
        ChannelLink(team.textChannel), //
        ChannelLink(team.voiceChannel),
    ];

    const embed = ResponseEmbed()
        .setTitle(team.name)
        .addField("Team Leader", leader, true);

    if (members.length !== 0) {
        embed.addField("Team Members:", members.join("\n"), true);
    }

    embed.addField("Team Channels", channels.join("\n"));
    return SafeReply(intr, {
        embeds: [embed],
    });
};
