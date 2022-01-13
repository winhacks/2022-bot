import {Guild, MessageEmbed, OverwriteResolvable} from "discord.js";
import {ChannelTypes} from "discord.js/typings/enums";
import {Config} from "../../config";
import {
    categoryCollection,
    FindAndReplace,
    FindOne,
    GetClient,
    teamCollection,
} from "../../helpers/database";
import {CategoryType, Query, TeamAvailability, TeamType} from "../../types";

// RESPONSES ------------------------------------------------------------------

export const InvalidNameResponse = () => {
    return {
        embeds: [
            new MessageEmbed()
                .setColor(Config.bot_info.embedColor)
                .setTitle(":x: Invalid Team Name")
                .setDescription(
                    `Team names must be shorter than ${Config.teams.max_name_length} characters, consist only of spaces and English alphanumeric characters, and not already be taken.`
                ),
        ],
    };
};

export const NameTakenResponse = () => {
    return {
        embeds: [
            new MessageEmbed()
                .setColor(Config.bot_info.embedColor)
                .setTitle(":x: Name Taken")
                .setDescription("That name is already taken, sorry."),
        ],
    };
};

export const AlreadyOwnTeamResponse = () => {
    return {
        embeds: [
            new MessageEmbed()
                .setColor(Config.bot_info.embedColor)
                .setTitle(":x: You're Already a Team Leader")
                .setDescription("You already have a team. In fact, you're the leader!"),
        ],
    };
};

export const NotTeamLeaderResponse = () => {
    return {
        embeds: [
            new MessageEmbed()
                .setColor(Config.bot_info.embedColor)
                .setTitle(":x: Not a Team Leader")
                .setDescription("This command may only be used by team leaders."),
        ],
    };
};

export const AlreadyInTeamResponse = () => {
    return {
        embeds: [
            new MessageEmbed()
                .setColor(Config.bot_info.embedColor)
                .setTitle(":x: Already in a Team")
                .setDescription(
                    "You're already in a team. You can leave your team with `/team leave`."
                ),
        ],
    };
};

export const NotInTeamResponse = () => {
    return {
        embeds: [
            new MessageEmbed()
                .setColor(Config.bot_info.embedColor)
                .setTitle(":x: Not in a Team")
                .setDescription(
                    "You're not in a team yet. Ask your team leader for an invite, or create your own with `/team create`."
                ),
        ],
    };
};

export const NotInGuildResponse = () => {
    return {
        embeds: [
            new MessageEmbed()
                .setColor(Config.bot_info.embedColor)
                .setTitle(":x: Not in a Server")
                .setDescription("This command must be used inside a server."),
        ],
    };
};

export const TeamFullResponse = () => {
    return {
        embeds: [
            new MessageEmbed()
                .setColor(Config.bot_info.embedColor)
                .setTitle(":x: Team Full")
                .setDescription(
                    `Teams can only have up to ${Config.teams.max_team_size} members.`
                ),
        ],
    };
};

// UTILITIES ------------------------------------------------------------------

export const MakeTeam = (
    teamName: string,
    owner: string,
    text: string,
    voice: string,
    members?: string[]
): TeamType => {
    return {
        name: teamName,
        stdName: Discordify(teamName),
        owner: owner,
        members: members ? members : [],
        textChannel: text,
        voiceChannel: voice,
    } as TeamType;
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

    if (!(await FindAndReplace<CategoryType>(categoryCollection, category, updated))) {
        return null;
    }

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
    const discordified = Discordify(rawName);

    const length: boolean = rawName.length <= Config.teams.max_name_length;
    const characters: boolean = !!rawName.match(/^[a-z0-9\-]+$/);
    const standardized: boolean = !!discordified.match(/^(?:[a-z0-9]+(?:-?[a-z0-9]*))+$/);

    return length && characters && standardized;
};

export const GetTeamAvailability = async (
    teamName: string,
    ownerID: string
): Promise<TeamAvailability> => {
    const query: Query = {
        $or: [TeamByName(teamName), TeamByMember(ownerID, true)],
    };
    const result = await FindOne<TeamType>(teamCollection, query);

    if (result?.name === teamName) {
        return TeamAvailability.NAME_EXISTS;
    } else if (result?.owner === ownerID) {
        return TeamAvailability.OWNER_EXISTS;
    } else if (result?.members.includes(ownerID)) {
        return TeamAvailability.ALREADY_IN_TEAM;
    } else {
        return TeamAvailability.AVAILABLE;
    }
};

export const GetUnfilledTeamCategory = async (guild: Guild): Promise<CategoryType> => {
    const db = await GetClient(categoryCollection);

    // query DB for an unfilled category
    const dbResult = await FindOne<CategoryType>(categoryCollection, UnfilledCategory());
    if (dbResult) {
        return dbResult;
    }

    // create a new one and insert into the database
    const catCount = await db.estimatedDocumentCount();
    const newCat = await guild.channels.create(
        `${Config.teams.category_base_name} ${catCount + 1}`,
        {type: ChannelTypes.GUILD_CATEGORY}
    );

    const inserted: CategoryType = {category_id: newCat.id, team_count: 0};
    db.insertOne(inserted);

    return inserted;
};

export const Discordify = (raw: string): string => {
    return raw.replaceAll(" ", "-").toLowerCase();
};

export const GetInviteId = (teamName: string, action: string): string => {
    return `${action}#${teamName}#${new Date().getTime()}`;
};

export const ParseInviteId = (
    inviteId: string
): {action: string; teamName: string; id: string} => {
    const split = inviteId.split("#");
    return {
        action: split[0],
        teamName: split[1],
        id: split[2],
    };
};

// DATABASE QUERIES -----------------------------------------------------------

export const TeamByName = (teamName: string): Query => {
    return {name: teamName};
};

export const TeamByOwner = (ownerID: string): Query => {
    return {owner: ownerID};
};

export const TeamByMember = (memberID: string, includeOwner?: boolean): Query => {
    if (includeOwner) {
        return {$or: [{members: memberID}, TeamByOwner(memberID)]};
    } else {
        return {members: memberID};
    }
};

export const UnfilledCategory = (): Query => {
    return {team_count: {$lt: Config.teams.teams_per_category}};
};

export const InviteByUser = (userID: string): Query => {
    return {forUser: userID};
};

export const InviteByTeam = (teamName: string): Query => {
    return {forTeam: teamName};
};

export const VerifiedUserByEmail = (email: string): Query => {
    return {email: email};
};

export const VerifiedUserByID = (id: string): Query => {
    return {userID: id};
};
