import {CacheType, CommandInteraction} from "discord.js";
import {
    categoryCollection,
    FindAndRemove,
    FindAndReplace,
    FindOne,
    teamCollection,
} from "../../helpers/database";
import {Remove, UserLink} from "../../helpers/misc";
import {GenericError, SafeReply, SuccessResponse} from "../../helpers/responses";
import {CategoryType, TeamType} from "../../types";
import {NotInGuildResponse, NotInTeamResponse, TeamByMember} from "./team-shared";

// TODO: test this shit. I'm tired and don't wanna do it now

export const LeaveTeam = async (intr: CommandInteraction<CacheType>) => {
    if (!intr.inGuild()) {
        return SafeReply(intr, NotInGuildResponse());
    }

    const team = await FindOne<TeamType>(
        teamCollection,
        TeamByMember(intr.user.id, true)
    );
    if (!team) {
        return SafeReply(intr, NotInTeamResponse());
    }

    let message: string = "";
    let ownerLeaving = team.owner === intr.user.id;

    if (ownerLeaving && team.members.length === 0) {
        message = (await DeleteTeamOutcome(intr, team))
            ? `You have left Team ${team.name} successfully.`
            : "";
    } else if (ownerLeaving) {
        const newOwner = team.members[team.members.length - 1];
        let success = await PromoteUserOutcome(intr, team);
        message = success
            ? `You have left Team ${team.name} successfully. ${UserLink(newOwner)}, ` +
              `you're in charge. Try not to burn the place down.`
            : "";
    } else {
        message = (await MemberLeavingOutcome(intr, team))
            ? `You have left Team ${team.name} successfully.`
            : "";
    }

    if (!message) {
        return SafeReply(intr, GenericError());
    } else {
        return SafeReply(intr, SuccessResponse(message));
    }
};

const PromoteUserOutcome = async (
    intr: CommandInteraction<CacheType>,
    team: TeamType
) => {
    const newTeam = {...team};
    newTeam.owner = newTeam.members.pop()!;

    return FindAndReplace<TeamType>(teamCollection, team, newTeam);
};

const DeleteTeamOutcome = async (intr: CommandInteraction<CacheType>, team: TeamType) => {
    const vc = await intr.guild!.channels.fetch(team.voiceChannel);
    const tc = await intr.guild!.channels.fetch(team.textChannel);
    const catId = vc ? vc.parentId : tc ? tc.parentId : null;

    let category = await FindOne<CategoryType>(categoryCollection, {
        category_id: catId,
    });

    if (!category) {
        return false;
    }

    // FIXME: replace proof of concept with transactions
    // We should replace this with a transaction-based
    // implementation, as this current implementation may
    // fragment the database if the category update succeeds
    // but team deletion fails.

    category.team_count -= 1;
    const categoryUpdate = await FindAndReplace<CategoryType>(
        categoryCollection,
        {category_id: category.category_id},
        category
    );

    if (!categoryUpdate) {
        return false;
    }

    await Promise.allSettled([
        vc?.delete("Team disbanded"),
        tc?.delete("Team disbanded"),
    ]);

    return FindAndRemove<TeamType>(teamCollection, team);
};

const MemberLeavingOutcome = async (
    intr: CommandInteraction<CacheType>,
    team: TeamType
) => {
    const newTeam = {...team};
    newTeam.members = Remove(newTeam.members, intr.user.id);

    return FindAndReplace<TeamType>(teamCollection, team, newTeam);
};
