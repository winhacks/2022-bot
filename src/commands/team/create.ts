import {CommandInteraction, CacheType} from "discord.js";
import {GenericError, SafeReply} from "../../helpers/responses";
import {CheckTeamAvailability, PutTeam} from "../../helpers/teams";
import {
    AlreadyInTeamResponse,
    AlreadyOwnTeamResponse,
    Discordify,
    InvalidNameResponse,
    MakeTeamChannels,
    NameTakenResponse,
    NotInGuildResponse,
    SuccessResponse,
    ValidateTeamName,
} from "./team-shared";

export const CreateTeam = async (intr: CommandInteraction<CacheType>): Promise<any> => {
    if (!intr.guild) return SafeReply(intr, NotInGuildResponse);

    const teamName = intr.options.getString("name")!.trim().replaceAll(/\s\s+/g, " ");
    const discordified = Discordify(teamName);

    if (!ValidateTeamName(discordified)) return SafeReply(intr, InvalidNameResponse);

    // teamName is a valid name, check that a team does not already exist/user is not already in a team
    const [_, availability] = await CheckTeamAvailability(teamName, intr.user.id);
    if (availability === "NAME_EXISTS") return SafeReply(intr, NameTakenResponse);
    if (availability === "ALREADY_IN_TEAM") return SafeReply(intr, AlreadyInTeamResponse);
    if (availability === "OWNER_EXISTS") return SafeReply(intr, AlreadyOwnTeamResponse);

    const newChannels = await MakeTeamChannels(intr.guild, discordified, [intr.user.id]);
    if (!newChannels) return SafeReply(intr, GenericError);

    const [text, voice] = newChannels;

    // const putResult = await PutTeam(teamName, intr.user.id, text, voice);
    // if (!putResult) return SafeReply(intr, GenericError);

    let successMsg = [
        `Team ${teamName} has been created. Your channels are <#${text}>`,
        `and <#${voice}>. Invite up to 3 others with \`/team invite\`.`,
    ];

    return SafeReply(intr, SuccessResponse(successMsg.join(" ")));
};
