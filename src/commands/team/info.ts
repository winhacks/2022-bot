import {CacheType, CommandInteraction, MessageEmbed} from "discord.js";
import {Config} from "../../config";
import {ChannelLink, SafeReply} from "../../helpers/responses";
import {getTeamByMember} from "../../helpers/teams";
import {NotInGuildResponse, NotInTeamResponse} from "./team-shared";

export const TeamInfo = async (intr: CommandInteraction<CacheType>): Promise<any> => {
    if (!intr.guild) return SafeReply(intr, NotInGuildResponse);

    const team = await getTeamByMember(intr.user.id, true);
    if (!team) {
        return SafeReply(intr, NotInTeamResponse);
    }

    const memberCache = intr.guild!.members.cache;

    let memberString = memberCache.get(team.owner)!.displayName;
    team.members?.forEach(
        (id) => (memberString += "\n" + memberCache.get(id)!.displayName)
    );

    const leader = memberCache.get(team.owner)!.displayName;
    const members = team.members.map((id) => memberCache.get(id)?.displayName);
    members.push("Dummy Member 1");
    members.push("Dummy Member 2");
    members.push("Dummy Member 3");

    const channels = [
        ChannelLink(team.textChannel), //
        ChannelLink(team.voiceChannel),
    ];

    const embed = new MessageEmbed() //
        .setColor(Config.bot_info.embedColor)
        .setTitle(team.name)
        .addField("Team Leader", leader, true);

    if (members) embed.addField("Team Members:", members.join("\n"), true);

    embed.addField("Team Channels", channels.join("\n"));
    return SafeReply(intr, {
        embeds: [embed],
    });
};
