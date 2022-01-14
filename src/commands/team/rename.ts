import {CacheType, CommandInteraction} from "discord.js";
import {
    FindAndReplace,
    FindOne,
    teamCollection,
    WithTransaction,
} from "../../helpers/database";
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

// FINISHED

export const RenameTeam = async (intr: CommandInteraction<CacheType>) => {
    if (!intr.inGuild()) {
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
    const voice = intr.guild!.channels.cache.get(oldTeam.voiceChannel);
    const text = intr.guild!.channels.cache.get(oldTeam.textChannel);

    if (!voice || !text) {
        return SafeReply(intr, GenericError());
    }

    // put new information
    const newTeam = {...oldTeam};
    newTeam.name = newName;

    const result = await WithTransaction(async (): Promise<boolean> => {
        if (!(await FindAndReplace<TeamType>(teamCollection, oldTeam, newTeam))) {
            return false;
        }

        let rename = await Promise.allSettled([
            voice.setName(`${discordified}-voice`),
            text.setName(`${discordified}`),
        ]);

        if (rename.map((e) => e.status).includes("rejected")) {
            return false;
        }

        return true;
    });

    if (!result) {
        return SafeReply(intr, GenericError());
    }

    // tell user everything went OK
    let okRes = [
        `Change your team name to ${newTeam.name}. Your channels are now`,
        `<#${newTeam.textChannel}> and <#${newTeam.voiceChannel}>.`,
    ];

    return SafeReply(intr, SuccessResponse(okRes.join(" ")));
};
