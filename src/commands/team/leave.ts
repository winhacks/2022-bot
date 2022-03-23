import {CacheType, CommandInteraction} from "discord.js";
import {ErrorMessage, SafeReply, SuccessMessage} from "../../helpers/responses";
import {logger} from "../../logger";
import {TeamType} from "../../types";
import {HandleLeaveTeam, NotInGuildResponse} from "./team-shared";

export const LeaveTeam = async (intr: CommandInteraction<CacheType>, team: TeamType) => {
    if (!intr.inGuild()) {
        return SafeReply(intr, NotInGuildResponse());
    }

    const leaveError = await HandleLeaveTeam(intr.guild!, intr.user, team);
    if (leaveError) {
        logger.error(leaveError);
        return SafeReply(intr, ErrorMessage({ephemeral: true}));
    } else {
        return await SafeReply(
            intr,
            SuccessMessage({
                message: `You left Team ${team.name} successfully.`,
                ephemeral: true,
            })
        );
    }
};
