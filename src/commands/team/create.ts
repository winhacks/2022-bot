import {CommandInteraction, CacheType, GuildChannel} from "discord.js";
import {Config} from "../../config";
import {InsertOne, teamCollection, WithTransaction} from "../../helpers/database";
import {
    GenericError,
    NotVerifiedResponse,
    SafeDeferReply,
    SafeReply,
    SuccessResponse,
} from "../../helpers/responses";
import {logger} from "../../logger";
import {TeamAvailability, TeamType} from "../../types";
import {
    AlreadyInTeamResponse,
    Discordify,
    GetTeamAvailability,
    InvalidNameResponse,
    IsUserVerified,
    MakeTeam,
    MakeTeamChannels,
    NameTakenResponse,
    NotInGuildResponse,
    ValidateTeamName,
} from "./team-shared";

// FINISHED

export const CreateTeam = async (intr: CommandInteraction<CacheType>): Promise<any> => {
    if (!intr.guild) {
        return SafeReply(intr, NotInGuildResponse());
    } else if (!(await IsUserVerified(intr.user.id))) {
        return SafeReply(intr, NotVerifiedResponse(true));
    }

    await SafeDeferReply(intr, true);

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
    }

    let teamText: GuildChannel;
    let teamVoice: GuildChannel;
    const newChannels = await MakeTeamChannels(intr.guild!, discordified, [intr.user.id]);

    if (!newChannels) {
        logger.error("Failed to make team channels");
        return SafeReply(intr, GenericError());
    }
    [teamText, teamVoice] = newChannels;

    // attempt to make and insert team
    const newTeam: TeamType = MakeTeam(teamName, teamText.id, teamVoice.id, intr.user.id);
    const putResult = await InsertOne<TeamType>(teamCollection, newTeam);

    if (!putResult) {
        logger.error("Failed to insert new team");
        return SafeReply(intr, GenericError());
    }

    const memberCount = Config.teams.max_team_size - 1;
    const successMsg = [
        `Team ${teamName} has been created. Your channels are ${teamText}`,
        `and ${teamVoice}. Invite up to ${memberCount} others with \`/team invite\`.`,
    ];
    return SafeReply(intr, SuccessResponse(successMsg.join(" ")));
};
