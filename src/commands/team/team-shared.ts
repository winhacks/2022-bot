import {
    CategoryChannel,
    Guild,
    GuildChannel,
    GuildTextBasedChannel,
    OverwriteResolvable,
    User,
} from "discord.js";
import {ChannelTypes} from "discord.js/typings/enums";
import {ClientSession} from "mongodb";
import {Config} from "../../config";
import {
    categoryCollection,
    FindAndRemove,
    FindAndReplace,
    FindAndUpdate,
    FindOne,
    GetClient,
    teamCollection,
    verifiedCollection,
    WithTransaction,
} from "../../helpers/database";
import {ChannelLink, Remove} from "../../helpers/misc";
import {EmbedToMessage, ResponseEmbed} from "../../helpers/responses";
import {logger} from "../../logger";
import {
    CategoryType,
    Query,
    TeamAvailability,
    TeamType,
    VerifiedUserType,
} from "../../types";

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
                    )}`
                ),
        ],
    };
};

// UTILITIES ------------------------------------------------------------------

export const IsUserVerified = async (id: string) => {
    return !!(await FindOne<VerifiedUserType>(verifiedCollection, {userID: id}));
};

export const MakeTeam = (
    teamName: string,
    text: string,
    voice: string,
    members: string[]
): TeamType => {
    return {
        name: teamName,
        stdName: Discordify(teamName),
        members: members,
        textChannel: text,
        voiceChannel: voice,
        invites: [],
    } as TeamType;
};

export const BuildTeamPermissions = (
    guild: Guild,
    members: string[]
): OverwriteResolvable[] => {
    const everyoneID = guild.roles.cache.findKey((role) => role.name === "@everyone");
    if (!everyoneID) {
        throw new Error(`Somehow the @everyone role isn't cached for ${guild.id}`);
    }

    const teamPerms: OverwriteResolvable[] = [
        {
            id: everyoneID,
            deny: ["VIEW_CHANNEL", "CONNECT", "SPEAK", "SEND_MESSAGES"],
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
    members: string[],
    session?: ClientSession
): Promise<[GuildChannel, GuildChannel] | null> => {
    const category = await GetUnfilledTeamCategory(guild);
    const updateRes = await FindAndUpdate<CategoryType>(
        categoryCollection,
        category,
        {$inc: {teamCount: 1}},
        {session: session}
    );
    if (!updateRes) {
        logger.warn("Failed to update category!");
        return null;
    }

    const teamPerms = BuildTeamPermissions(guild, members);
    const text = await guild.channels.create(teamName, {
        type: ChannelTypes.GUILD_TEXT,
        parent: category.categoryID,
        permissionOverwrites: teamPerms,
    });

    const voice = await guild.channels.create(teamName + "-voice", {
        type: ChannelTypes.GUILD_VOICE,
        parent: category.categoryID,
        permissionOverwrites: teamPerms,
    });

    return [text, voice];
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
    const query: Query = {
        $or: [{name: teamName}, {members: member}],
    };
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

    if (team.members.length == 1) {
        return HandleDeleteTeam(guild, team);
    } else {
        return HandleMemberLeave(guild, user, team);
    }
};

const HandleDeleteTeam = async (guild: Guild, team: TeamType): Promise<string> => {
    return WithTransaction(async (session) => {
        const removed = await FindAndRemove(teamCollection, team, {session});
        if (!removed) {
            return "Failed to delete team";
        }

        let text = guild.channels.cache.get(team.textChannel);
        let voice = guild.channels.cache.get(team.voiceChannel);

        if (!text || !voice) {
            return "Failed to get team channels";
        }

        const categoryReduced = await FindAndUpdate(
            categoryCollection,
            {categoryID: text.parentId},
            {$inc: {teamCount: -1}},
            {session}
        );

        if (!categoryReduced) {
            return "Failed to decrement category team count";
        }

        const reason = "Team deleted";
        await Promise.allSettled([text.delete(reason), voice.delete(reason)]);
        return "";
    });
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
                {$pop: {invites: [user.id]}},
                {session}
            );
            if (!updated) {
                return "Couldn't remove member from team in database";
            }

            // resolve channels
            let text = guild!.channels.cache.get(team.textChannel) as GuildChannel;
            let voice = guild!.channels.cache.get(team.voiceChannel) as GuildChannel;
            if (!text || !voice) {
                return "Failed to get team channels";
            }

            // send leave message
            await (text as GuildTextBasedChannel).send(
                EmbedToMessage(
                    ResponseEmbed()
                        .setTitle(":confused: Member Left")
                        .setDescription(`${user} has left the team.`)
                )
            );

            const newPerms = BuildTeamPermissions(guild, team.members);
            const reason = "Member left team";
            try {
                text.permissionOverwrites.set(newPerms, reason);
                voice.permissionOverwrites.set(newPerms, reason);
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

export const UnfilledCategory = (): Query => {
    return {teamCount: {$lt: Config.teams.teams_per_category}};
};
