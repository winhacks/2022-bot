import {CacheType, CommandInteraction} from "discord.js";
import {GenericError, SafeReply, SuccessResponse} from "../../helpers/responses";
import {TeamType} from "../../types";
import {HandleLeaveTeam, NotInGuildResponse} from "./team-shared";

export const LeaveTeam = async (intr: CommandInteraction<CacheType>, team: TeamType) => {
    if (!intr.inGuild()) {
        return SafeReply(intr, NotInGuildResponse());
    }

    const leaveError = await HandleLeaveTeam(intr.guild!, intr.user, team);
    if (leaveError) {
        return SafeReply(intr, GenericError(true));
    } else {
        return await SafeReply(
            intr,
            SuccessResponse(`You left ${team.name} successfully.`, true)
        );
    }
};
