import {
    Guild,
    GuildChannel,
    GuildTextBasedChannel,
    OverwriteResolvable,
    PermissionOverwriteOptions,
    PermissionOverwrites,
    Permissions,
    TextChannel,
    User,
    VoiceChannel,
} from "discord.js";
import {ChannelTypes, OverwriteTypes} from "discord.js/typings/enums";
import {Config} from "../../config";
import {
    categoryCollection,
    FindAndRemove,
    FindAndUpdate,
    FindOne,
    GetClient,
    teamCollection,
    WithTransaction,
} from "../../helpers/database";
import {ChannelLink} from "../../helpers/misc";
import {ResponseEmbed, SuccessMessage} from "../../helpers/responses";
import {logger} from "../../logger";
import {CategoryType, Query, TeamAvailability, TeamType} from "../../types";

// PERMISSIONS ----------------------------------------------------------------

export const TEAM_MEMBER_PERMS: PermissionOverwriteOptions = {
    VIEW_CHANNEL: true,
    CONNECT: true,
    SPEAK: true,
    SEND_MESSAGES: true,
};
export const NOT_TEAM_MEMBER_PERMS: PermissionOverwriteOptions = {
    VIEW_CHANNEL: false,
    CONNECT: false,
    SPEAK: false,
    SEND_MESSAGES: false,
};

const FLAG_SET = [
    Permissions.FLAGS.VIEW_CHANNEL,
    Permissions.FLAGS.SEND_MESSAGES,
    Permissions.FLAGS.CONNECT,
    Permissions.FLAGS.SPEAK,
];

// RESPONSES ------------------------------------------------------------------

export const InvalidNameResponse = (ephemeral: boolean = false) => {
    return {
        ephemeral: ephemeral,
        embeds: [
            ResponseEmbed()
                .setTitle(":x: Invalid Team Name")
                .setDescription(
                    `Team names must be shorter than ${
                        Config.teams.max_name_length
                    } characters, ${"\
                    "}consist only of spaces and English alphanumeric characters, and not already be taken.`
                ),
        ],
    };
};

export const NameTakenResponse = (ephemeral: boolean = false) => {
    return {
        ephemeral: ephemeral,
        embeds: [
            ResponseEmbed()
                .setTitle(":x: Name Taken")
                .setDescription("That name is already taken, sorry."),
        ],
    };
};

export const NotTeamLeaderResponse = (ephemeral: boolean = false) => {
    return {
        ephemeral: ephemeral,
        embeds: [
            ResponseEmbed()
                .setTitle(":x: Not a Team Leader")
                .setDescription("This command may only be used by team leaders."),
        ],
    };
};

export const AlreadyInTeamResponse = (ephemeral: boolean = false) => {
    return {
        ephemeral: ephemeral,
        embeds: [
            ResponseEmbed()
                .setTitle(":x: Already in a Team")
                .setDescription(
                    "You're already in a team. You can leave your team with `/team leave`."
                ),
        ],
    };
};

export const NotInTeamResponse = (ephemeral: boolean = false) => {
    return {
        ephemeral: ephemeral,
        embeds: [
            ResponseEmbed()
                .setTitle(":x: Not in a Team")
                .setDescription(
                    "You're not in a team yet. Ask your team leader for an invite, or create your own with `/team create`."
                ),
        ],
    };
};

export const NotInGuildResponse = (ephemeral: boolean = false) => {
    return {
        ephemeral: ephemeral,
        embeds: [
            ResponseEmbed()
                .setTitle(":x: Not in a Server")
                .setDescription("This command must be used inside a server."),
        ],
    };
};

export const TeamFullResponse = (ephemeral: boolean = false) => {
    return {
        ephemeral: ephemeral,
        embeds: [
            ResponseEmbed()
                .setTitle(":x: Team Full")
                .setDescription(
                    `Teams can only have up to ${Config.teams.max_team_size} members.`
                ),
        ],
    };
};

export const InTeamChannelResponse = (
    textChannelID: string,
    ephemeral: boolean = false
) => {
    return {
        ephemeral: ephemeral,
        embeds: [
            ResponseEmbed()
                .setTitle("Wrong Channel")
                .setDescription(
                    `You cannot use this command in your team text channel, ${ChannelLink(
                        textChannelID
                    )}.`
                ),
        ],
    };
};

export const NotInTeamChannelResponse = (
    textChannelID: string,
    ephemeral: boolean = false
) => {
    return {
        ephemeral: ephemeral,
        embeds: [
            ResponseEmbed()
                .setTitle("Wrong Channel")
                .setDescription(
                    `You can only use this command in your team text channel, ${ChannelLink(
                        textChannelID
                    )}.`
                ),
        ],
    };
};

// UTILITIES ------------------------------------------------------------------

export const MakeTeam = (
    teamName: string,
    text: string,
    voice: string,
    member: string
): TeamType => {
    return {
        name: teamName,
        stdName: Discordify(teamName),
        members: [member],
        textChannel: text,
        voiceChannel: voice,
        invites: [],
    } as TeamType;
};

// FIXME: once magic is no longer needed, this should be removed and downgraded to a single member use case
export const MakeTeamPermissions = (
    guild: Guild,
    teamName: string,
    forMembers: string[]
): OverwriteResolvable[] => {
    const overwrites: OverwriteResolvable[] = [
        {id: guild.roles.everyone, type: "role", deny: FLAG_SET},
    ];

    for (const member of forMembers) {
        overwrites.push({id: member, type: "member", allow: FLAG_SET});
    }

    for (const name of Config.teams.moderator_roles) {
        const roleId = guild.roles.cache.findKey((r) => r.name === name);
        if (!roleId) {
            const warning = [
                `Can't give role ${name} access to`,
                `${teamName}'s channels: role not found`,
            ].join(" ");

            logger.warn(warning);
            continue;
        }

        overwrites.push({
            id: roleId,
            type: "role",
            allow: FLAG_SET,
        });
    }

    return overwrites;
};

export const MakeTeamChannels = async (
    guild: Guild,
    teamName: string,
    forMember: string
): Promise<[TextChannel, VoiceChannel] | null> => {
    const category = await GetUnfilledTeamCategory(guild);
    const updateRes = await FindAndUpdate<CategoryType>(
        categoryCollection,
        category,
        {$inc: {teamCount: 1}},
        {upsert: true}
    );
    if (!updateRes) {
        logger.warn("Failed to update category!");
        return null;
    }

    const overwrites = MakeTeamPermissions(guild, teamName, [forMember]);
    return Promise.all([
        guild.channels.create(teamName, {
            type: ChannelTypes.GUILD_TEXT,
            parent: category.categoryID,
            permissionOverwrites: overwrites,
        }),

        guild.channels.create(teamName + "-voice", {
            type: ChannelTypes.GUILD_VOICE,
            parent: category.categoryID,
            permissionOverwrites: overwrites,
        }),
    ]);
};

export const ValidateTeamName = (rawName: string): boolean => {
    const discordified = Discordify(rawName);

    const length = rawName.length <= Config.teams.max_name_length;
    const characters = !!rawName.match(/^[a-z0-9\-]+$/);
    const standardized = !!discordified.match(/^(?:[a-z0-9]+(?:-[a-z0-9]+)*)$/);

    return length && characters && standardized;
};

export const GetTeamAvailability = async (
    teamName: string,
    member: string
): Promise<TeamAvailability> => {
    const query: Query<TeamType> = {$or: [{name: teamName}, {members: member}]};
    const result = await FindOne<TeamType>(teamCollection, query);

    if (result?.name === teamName) {
        return TeamAvailability.NAME_EXISTS;
    } else if (result?.members.includes(member)) {
        return TeamAvailability.ALREADY_IN_TEAM;
    } else {
        return TeamAvailability.AVAILABLE;
    }
};

export const GetUnfilledTeamCategory = async (guild: Guild): Promise<CategoryType> => {
    const db = await GetClient<CategoryType>(categoryCollection);

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

    const inserted: CategoryType = {categoryID: newCat.id, teamCount: 0};
    db.insertOne(inserted);

    return inserted;
};

export const HandleLeaveTeam = async (
    guild: Guild,
    user: User,
    team?: TeamType
): Promise<string> => {
    if (!team) {
        const found = await FindOne<TeamType>(teamCollection, {members: user});
        if (!found) {
            return "Could not find user's team";
        }

        team = found;
    }

    return HandleMemberLeave(guild, user, team);
};

const HandleMemberLeave = async (
    guild: Guild,
    user: User,
    team: TeamType
): Promise<string> => {
    return WithTransaction(
        async (session) => {
            // remove member
            const updated = await FindAndUpdate(
                teamCollection,
                {stdName: team.stdName},
                {$pull: {members: user.id}},
                {session}
            );
            if (!updated) {
                return "Couldn't remove member from team in database";
            }

            // resolve channels
            let text = (await guild!.channels.fetch(team.textChannel)) as GuildChannel;
            let voice = (await guild!.channels.fetch(team.voiceChannel)) as GuildChannel;
            if (!text || !voice) {
                return "Failed to get team channels";
            }

            const extra =
                team.members.length === 1 ? "**This team is now abandoned.**" : "";

            // send leave message
            await (text as GuildTextBasedChannel).send(
                SuccessMessage({
                    emote: ":frowning:",
                    title: "Member Left",
                    message: `${user} has left the team. ${extra}`,
                })
            );

            try {
                text.permissionOverwrites.delete(user.id, "Member left team");
                voice.permissionOverwrites.delete(user.id, "Member left team");
            } catch (err) {
                return `${err}`;
            }

            return "";
        },
        async (err) => {
            logger.error(err);
        }
    );
};

export const Discordify = (raw: string): string => {
    return raw.replaceAll(" ", "-").toLowerCase();
};

// DATABASE QUERIES -----------------------------------------------------------

export const UnfilledCategory = (): Query<CategoryType> => {
    return {teamCount: {$lt: Config.teams.teams_per_category}};
};
