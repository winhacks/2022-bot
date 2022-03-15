import {CacheType, CommandInteraction} from "discord.js";
import {FindAndUpdate, FindOne, teamCollection} from "../../helpers/database";
import {AllResolve} from "../../helpers/misc";
import {
    GenericError,
    SafeDeferReply,
    SafeReply,
    SuccessResponse,
} from "../../helpers/responses";
import {logger} from "../../logger";
import {TeamType} from "../../types";
import {
    Discordify,
    InvalidNameResponse,
    NameTakenResponse,
    NotInGuildResponse,
    ValidateTeamName,
} from "./team-shared";

// FIXME: weird janky database issues with this module. Doesn't seem to happen in others.
export const RenameTeam = async (intr: CommandInteraction<CacheType>, team: TeamType) => {
    await SafeDeferReply(intr);

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

    // rename channels
    const renameSuccess = await AllResolve([
        voice.setName(`${discordified}-voice`),
        text.setName(`${discordified}`),
    ]);
    if (!renameSuccess) {
        logger.error(`Failed to rename team channels.`);
        return SafeReply(intr, GenericError());
    }

    const updated = await FindAndUpdate<TeamType>(
        teamCollection,
        {stdName: team.stdName},
        {$set: {name: newName, stdName: discordified}}
    );
    if (!updated) {
        logger.error(`Failed to updated team in database.`);
        return SafeReply(intr, GenericError());
    }

    // tell user everything went OK
    let okRes = [
        `Changed your team name to ${newName}. Your channels are now`,
        `<#${team.textChannel}> and <#${team.voiceChannel}>.`,
    ];

    return SafeReply(intr, SuccessResponse(okRes.join(" ")));
};
