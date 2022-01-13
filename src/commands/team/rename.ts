import {CacheType, CommandInteraction} from "discord.js";
import {FindAndReplace, FindOne, teamCollection} from "../../helpers/database";
import {GenericError, SafeReply, SuccessResponse} from "../../helpers/responses";
import {TeamType} from "../../types";
import {
    Discordify,
    InvalidNameResponse,
    NameTakenResponse,
    NotInGuildResponse,
    NotInTeamResponse,
    TeamByName,
    TeamByOwner,
    ValidateTeamName,
} from "./team-shared";

export const RenameTeam = async (intr: CommandInteraction<CacheType>) => {
    if (!intr.guild) {
        return SafeReply(intr, NotInGuildResponse());
    }

    const oldTeam = await FindOne<TeamType>(teamCollection, TeamByOwner(intr.user.id));
    if (!oldTeam) {
        return SafeReply(intr, NotInTeamResponse());
    }

    const newName = intr.options.getString("name", true);
    const discordified = Discordify(newName);

    // validate name
    if (oldTeam.name === newName) {
        return SafeReply(intr, NameTakenResponse());
    } else if (!ValidateTeamName(discordified)) {
        return SafeReply(intr, InvalidNameResponse());
    } else if (await FindOne<TeamType>(teamCollection, TeamByName(newName))) {
        return SafeReply(intr, NameTakenResponse());
    }

    // ensure channels that will be renamed exist
    const voice = intr.guild.channels.cache.get(oldTeam.voiceChannel);
    const text = intr.guild.channels.cache.get(oldTeam.textChannel);

    if (!voice || !text) {
        return SafeReply(intr, GenericError());
    }

    // put new information
    const newTeam = {...oldTeam};
    newTeam.name = newName;

    if (!(await FindAndReplace<TeamType>(teamCollection, oldTeam, newTeam))) {
        return SafeReply(intr, GenericError());
    }

    await Promise.allSettled([
        voice.setName(`${discordified}-voice`),
        text.setName(`${discordified}`),
    ]);

    // tell user everything went OK
    let okRes = [
        `Change your team name to ${newTeam.name}. Your channels are now`,
        `<#${newTeam.textChannel}> and <#${newTeam.voiceChannel}>.`,
    ];

    return SafeReply(intr, SuccessResponse(okRes.join(" ")));
};
