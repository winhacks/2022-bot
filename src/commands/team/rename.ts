import {CacheType, CommandInteraction} from "discord.js";
import {GenericError, SafeReply} from "../../helpers/responses";
import {GetTeamByName, GetTeamByOwner, UpdateTeam} from "../../helpers/teams";
import {
    Discordify,
    InvalidNameResponse,
    NameTakenResponse,
    NotInGuildResponse,
    NotInTeamResponse,
    SuccessResponse,
    ValidateTeamName,
} from "./team-shared";

export const RenameTeam = async (intr: CommandInteraction<CacheType>) => {
    if (!intr.guild) return SafeReply(intr, NotInGuildResponse);

    const oldTeam = await GetTeamByOwner(intr.user.id);
    if (!oldTeam) {
        return SafeReply(intr, NotInTeamResponse);
    }

    const newName = intr.options.getString("name")!;
    const discordified = Discordify(newName);

    if (oldTeam.name === newName) return SafeReply(intr, NameTakenResponse);

    // validate name
    if (!ValidateTeamName(discordified)) return SafeReply(intr, InvalidNameResponse);
    if (await GetTeamByName(newName)) return SafeReply(intr, NameTakenResponse);

    // put new information
    const newTeam = {...oldTeam};
    newTeam.name = newName;

    const [_, ok] = await UpdateTeam(oldTeam, newTeam);
    if (!ok) return SafeReply(intr, GenericError);

    // rename channels
    const voice = intr.guild.channels.cache.get(oldTeam.voiceChannel)!;
    const text = intr.guild.channels.cache.get(oldTeam.textChannel)!;

    await voice.setName(`${discordified}-voice`);
    await text.setName(`${discordified}`);

    // tell user everything went OK
    let okRes = [
        `Change your team name to ${newTeam.name}. Your channels are now <#${newTeam.textChannel}>`,
        `and <#${newTeam.voiceChannel}>.`,
    ];
    return SafeReply(intr, SuccessResponse(okRes.join(" ")));
};
