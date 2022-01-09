import {CacheType, CommandInteraction} from "discord.js";
import {safeReply, SimpleTextEmbed, SimpleTextResponse} from "../../helpers/responses";
import {getTeamByMember} from "../../helpers/teams";

export const teamInfo = async (intr: CommandInteraction<CacheType>): Promise<any> => {
    if (!intr.guild)
        return safeReply(
            intr,
            SimpleTextResponse(
                ":x: Invalid command usage",
                "This command must be used inside a guild."
            )
        );

    const team = await getTeamByMember(intr.user.id, true);
    if (!team) {
        return safeReply(
            intr,
            SimpleTextResponse(
                ":x: Not in a team",
                "It appears you're not in a team yet. Ask your leader for an invite, or create your own team with `/team create`."
            )
        );
    }

    let description = "";

    const memberCache = intr.guild!.members.cache;

    let memberString = memberCache.get(team.owner)!.displayName;
    team.members?.forEach((id) => (memberString += "\n" + memberCache.get(id)!.displayName));

    description += `**Team Members:**\n`;
    description += `${memberString}\n\n`;
    description += `**Team Channels:**\n`;
    description += `<#${team.textChannel}>\n<#${team.voiceChannel}>\n\n`;
    description += `Created <t:${team.creationTimestamp}:R>`;

    return safeReply(intr, SimpleTextResponse(team.name, description));
};
