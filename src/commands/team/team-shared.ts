import {Guild, MessageEmbed, OverwriteResolvable} from "discord.js";
import {ChannelTypes} from "discord.js/typings/enums";
import {Config} from "../../config";
import {GetUnfilledTeamCategory, UpdateTeamCategory} from "../../helpers/teams";

export const InvalidNameResponse = {
    embeds: [
        new MessageEmbed()
            .setColor(Config.bot_info.embedColor)
            .setTitle(":x: Invalid Team Name")
            .setDescription(
                `Team names must be shorter than ${Config.teams.max_name_length} characters, consist only of spaces and English alphanumeric characters, and not already be taken.`
            ),
    ],
};

export const NameTakenResponse = {
    embeds: [
        new MessageEmbed()
            .setColor(Config.bot_info.embedColor)
            .setTitle(":x: Name Taken")
            .setDescription("That name is already taken, sorry."),
    ],
};

export const AlreadyOwnTeamResponse = {
    embeds: [
        new MessageEmbed()
            .setColor(Config.bot_info.embedColor)
            .setTitle(":x: You're Already a Team Leader")
            .setDescription("You already have a team. In fact, you're the leader!"),
    ],
};

export const NotTeamLeaderResponse = {
    embeds: [
        new MessageEmbed()
            .setColor(Config.bot_info.embedColor)
            .setTitle(":x: Not a Team Leader")
            .setDescription("This command may only be used by team leaders."),
    ],
};

export const AlreadyInTeamResponse = {
    embeds: [
        new MessageEmbed()
            .setColor(Config.bot_info.embedColor)
            .setTitle(":x: Already in a Team")
            .setDescription(
                "You're already in a team. You can leave your team with `/team leave`."
            ),
    ],
};

export const NotInTeamResponse = {
    embeds: [
        new MessageEmbed()
            .setColor(Config.bot_info.embedColor)
            .setTitle(":x: Not in a Team")
            .setDescription(
                "You're not in a team yet. Ask your team leader for an invite, or create your own with `/team create`."
            ),
    ],
};

export const NotInGuildResponse = {
    embeds: [
        new MessageEmbed()
            .setColor(Config.bot_info.embedColor)
            .setTitle(":x: Not in a Server")
            .setDescription("This command must be used inside a server."),
    ],
};

export const SuccessResponse = (message: string) => {
    return {
        embeds: [
            new MessageEmbed()
                .setColor(Config.bot_info.embedColor)
                .setTitle(":partying_face: Success")
                .setDescription(message),
        ],
    };
};

export const BuildTeamPermissions = (
    guild: Guild,
    members: string[]
): OverwriteResolvable[] => {
    const everyoneID = guild.roles.cache.findKey((role) => role.name === "@everyone");
    if (!everyoneID)
        throw new Error(`Somehow the @everyone role isn't cached for ${guild.id}`);

    const teamPerms: OverwriteResolvable[] = [
        {
            id: everyoneID,
            deny: [
                "VIEW_CHANNEL",
                "CONNECT",
                "SPEAK",
                "SEND_MESSAGES",
                "CREATE_INSTANT_INVITE",
            ],
        },
    ];

    members.forEach((memberId) =>
        teamPerms.push({
            id: memberId,
            allow: ["VIEW_CHANNEL", "CONNECT", "SPEAK", "SEND_MESSAGES"],
        })
    );

    return teamPerms;
};

export const MakeTeamChannels = async (
    guild: Guild,
    teamName: string,
    members: string[]
): Promise<[string, string] | null> => {
    const category = await GetUnfilledTeamCategory(guild);
    const updated = {...category};
    updated.team_count += 1;

    const [_, ok] = await UpdateTeamCategory(category, updated);
    if (!ok) return null;

    const teamPerms = BuildTeamPermissions(guild, members);
    const textId = (
        await guild.channels.create(teamName, {
            type: ChannelTypes.GUILD_TEXT,
            parent: category.category_id,
            permissionOverwrites: teamPerms,
        })
    ).id;

    const voiceId = (
        await guild.channels.create(teamName + "-voice", {
            type: ChannelTypes.GUILD_VOICE,
            parent: category.category_id,
            permissionOverwrites: teamPerms,
        })
    ).id;

    return [textId, voiceId];
};

export const ValidateTeamName = (rawName: string): boolean => {
    const hyphenated = rawName.replaceAll(" ", "-");

    if (rawName.length > Config.teams.max_name_length) return false;
    if (!rawName.match(/^[a-z0-9\-]+$/)) return false;
    if (!hyphenated.match(/^(?:[a-z0-9]+(?:-?[a-z0-9]*))+$/)) return false;

    return true;
};

export const Discordify = (raw: string): string => {
    return raw.replaceAll(" ", "-").toLowerCase();
};
