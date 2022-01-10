import {Guild} from "discord.js";
import {ChannelTypes} from "discord.js/typings/enums";
import {Document, Filter} from "mongodb";
import {Config} from "../config";
import {mongoClient} from "./mongoDB";

export type AvailabilityType =
    | "NAME_EXISTS"
    | "OWNER_EXISTS"
    | "ALREADY_IN_TEAM"
    | "AVAILABLE";
export type UpdateResultType = "FAILURE" | "SUCCESS";

const GetClient = async (name: string) => {
    const db = mongoClient.db(Config.teams.database_name);
    const collections = await db.listCollections({name: name}).toArray();

    if (collections.length == 0) {
        return db.createCollection(name);
    }

    return db.collection(name);
};

export type TeamType = {
    name: string;
    stdName: string;
    owner: string;
    creationTimestamp: number;
    textChannel: string;
    voiceChannel: string;
    members: string[];
    pendingInvites: string[];
};

export type CategoryType = {
    category_id: string;
    team_count: number;
};

export const GetTeamByOwner = async (ownerId: string): Promise<TeamType | null> => {
    const db = await GetClient("teams");
    return (await db.findOne({owner: ownerId})) as TeamType | null;
};

export const GetTeamByName = async (name: string): Promise<TeamType | null> => {
    const db = await GetClient("teams");
    return (await db.findOne({name: name})) as TeamType | null;
};

export const getTeamByMember = async (
    memberId: string,
    includeOwner: boolean = false
): Promise<TeamType | null> => {
    let query;
    if (includeOwner) {
        query = {$or: [{members: memberId}, {owner: memberId}]};
    } else {
        query = {members: memberId};
    }

    const client = await GetClient("teams");
    return (await client.findOne(query)) as TeamType | null;
};

export const GetUnfilledTeamCategory = async (guild: Guild): Promise<CategoryType> => {
    const db = await GetClient("channelCategories");

    const unfilledCategory = (await db.findOne({
        team_count: {$lt: Config.teams.teams_per_category},
    })) as CategoryType | null;

    const numCategories = await db.countDocuments();

    if (unfilledCategory) return unfilledCategory;

    // category didn't already exist, make a new one
    const newCatName = `${Config.teams.category_base_name} ${numCategories + 1}`;
    const newCat = await guild.channels.create(newCatName, {
        type: ChannelTypes.GUILD_CATEGORY,
    });

    const newCategory = {
        category_id: newCat.id,
        team_count: 0,
    } as CategoryType;

    await db.insertOne(newCategory);
    return newCategory;
};

export const UpdateTeamCategory = async (
    oldCat: CategoryType,
    newCat: CategoryType
): Promise<[CategoryType | null, boolean]> => {
    const db = await GetClient("channelCategories");

    const {value, ok} = await db.findOneAndReplace(oldCat, newCat);

    return [
        value as CategoryType | null, //
        ok ? true : false,
    ];
};

export const CheckTeamAvailability = async (
    teamName: string,
    userId: string
): Promise<[TeamType | undefined, AvailabilityType]> => {
    const db = await GetClient("teams");

    const query = {
        $or: [
            {stdName: teamName.replaceAll(" ", "-")},
            {owner: userId},
            {members: userId},
        ],
    } as Filter<Document>;

    const result = (await db.findOne(query)) as TeamType | null;

    if (result?.name === teamName) return [result, "NAME_EXISTS"];
    if (result?.owner === userId) return [result, "OWNER_EXISTS"];
    if (result?.members?.includes(userId)) return [result, "ALREADY_IN_TEAM"];

    return [undefined, "AVAILABLE"];
};

export const PutTeam = async (
    teamName: string,
    ownerId: string,
    textChannel: string,
    voiceChannel: string,
    members?: string[],
    invites?: string[]
): Promise<TeamType | undefined> => {
    const db = await GetClient("teams");
    const newTeam = {
        name: teamName,
        stdName: teamName.replaceAll(" ", "-"),
        owner: ownerId,
        creationTimestamp: Math.floor(new Date().getTime() / 1000),
        textChannel: textChannel,
        voiceChannel: voiceChannel,
        members: members ? members : [],
        pendingInvites: invites ? invites : [],
    } as TeamType;

    const result = await db.insertOne(newTeam);

    if (!result.acknowledged) return undefined;
    return newTeam;
};

export const UpdateTeam = async (
    oldTeam: TeamType,
    newTeam: TeamType
): Promise<[TeamType | null, boolean]> => {
    const db = await GetClient("teams");
    const {value, ok} = await db.findOneAndReplace(oldTeam, newTeam);

    return [
        value as TeamType | null, //
        ok ? true : false,
    ];
};
