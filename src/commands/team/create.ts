import {CommandInteraction, CacheType} from "discord.js";
import {Config} from "../../config";
import {InsertOne, teamCollection} from "../../helpers/database";
import {GenericError, SafeReply, SuccessResponse} from "../../helpers/responses";
import {TeamAvailability, TeamType} from "../../types";
import {
    AlreadyInTeamResponse,
    AlreadyOwnTeamResponse,
    Discordify,
    GetTeamAvailability,
    InvalidNameResponse,
    MakeTeam,
    MakeTeamChannels,
    NameTakenResponse,
    NotInGuildResponse,
    ValidateTeamName,
} from "./team-shared";

export const CreateTeam = async (intr: CommandInteraction<CacheType>): Promise<any> => {
    if (!intr.guild) {
        return SafeReply(intr, NotInGuildResponse());
    }

    const teamName = intr.options
        .getString("name", true)
        .trim()
        .replaceAll(/\s\s+/g, " ");
    const discordified = Discordify(teamName);

    if (!ValidateTeamName(discordified)) {
        return SafeReply(intr, InvalidNameResponse());
    }

    // teamName is a valid name, check that a team does not already exist/user is not already in a team
    const availability = await GetTeamAvailability(teamName, intr.user.id);
    if (availability === TeamAvailability.NAME_EXISTS) {
        return SafeReply(intr, NameTakenResponse());
    } else if (availability === TeamAvailability.ALREADY_IN_TEAM) {
        return SafeReply(intr, AlreadyInTeamResponse());
    } else if (availability === TeamAvailability.OWNER_EXISTS) {
        return SafeReply(intr, AlreadyOwnTeamResponse());
    }

    const newChannels = await MakeTeamChannels(intr.guild, discordified, [intr.user.id]);
    if (!newChannels) {
        return SafeReply(intr, GenericError());
    }

    const [text, voice] = newChannels;

    const newTeam: TeamType = MakeTeam(teamName, intr.user.id, text, voice);
    const putResult = await InsertOne<TeamType>(teamCollection, newTeam);
    if (!putResult) {
        return SafeReply(intr, GenericError());
    }

    const memberCount = Config.teams.max_team_size - 1;
    let successMsg = [
        `Team ${teamName} has been created. Your channels are <#${text}>`,
        `and <#${voice}>. Invite up to ${memberCount} others with \`/team invite\`.`,
    ];

    return SafeReply(intr, SuccessResponse(successMsg.join(" ")));
};
