import {CacheType, CommandInteraction} from "discord.js";
import {
    FindAndUpdate,
    FindOne,
    teamCollection,
    WithTransaction,
} from "../../helpers/database";
import {AllResolve} from "../../helpers/misc";
import {GenericError, SafeReply, SuccessResponse} from "../../helpers/responses";
import {logger} from "../../logger";
import {TeamType} from "../../types";
import {
    Discordify,
    InvalidNameResponse,
    NameTakenResponse,
    NotInGuildResponse,
    ValidateTeamName,
} from "./team-shared";

export const RenameTeam = async (intr: CommandInteraction<CacheType>, team: TeamType) => {
    const newName = intr.options.getString("name", true);
    const discordified = Discordify(newName);

    if (!intr.inGuild()) {
        return SafeReply(intr, NotInGuildResponse());
    } else if (!ValidateTeamName(discordified)) {
        return SafeReply(intr, InvalidNameResponse());
    } else if (await FindOne<TeamType>(teamCollection, {stdName: discordified})) {
        return SafeReply(intr, NameTakenResponse());
    }

    // ensure channels that will be renamed exist
    const voice = intr.guild!.channels.cache.get(team.voiceChannel);
    const text = intr.guild!.channels.cache.get(team.textChannel);

    if (!voice || !text) {
        return SafeReply(intr, GenericError());
    }

    const result = await WithTransaction(
        async (session) => {
            // put new information
            const updated = await FindAndUpdate<TeamType>(
                teamCollection,
                team,
                {$set: [{name: newName}, {stdName: discordified}]},
                {session}
            );
            if (!updated) {
                return "Failed to update team";
            }

            // rename channels
            const renameSuccess = await AllResolve([
                voice.setName(`${discordified}-voice`),
                text.setName(`${discordified}`),
            ]);

            return renameSuccess ? "" : "Failed to rename team channels";
        },
        async (error) => {
            logger.error(`Failed to rename team: ${error}`);
        }
    );

    if (!result) {
        return SafeReply(intr, GenericError());
    }

    // tell user everything went OK
    let okRes = [
        `Changed your team name to ${newName}. Your channels are now`,
        `<#${team.textChannel}> and <#${team.voiceChannel}>.`,
    ];

    return SafeReply(intr, SuccessResponse(okRes.join(" ")));
};
