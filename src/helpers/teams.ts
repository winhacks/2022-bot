import {Collection} from "discord.js";
import {Document, Filter} from "mongodb";
import {Config} from "../config";
import {mongoClient} from "./mongoDB";

export type AvailabilityType = "NAME_EXISTS" | "OWNER_EXISTS" | "ALREADY_IN_TEAM" | "AVAILABLE";
export type UpdateResultType = "FAILURE" | "SUCCESS";

const getClient = () =>
    mongoClient.db(Config.teams.database_name).collection(Config.teams.collection_name);

export type TeamType = {
    name: string;
    owner: string;
    creationTimestamp: number;
    members?: string[];
    textChannel?: string;
    voiceChannel?: string;
    pendingInvites?: string[];
};

export const getTeamByOwner = async (ownerId: string): Promise<TeamType | null> =>
    (await getClient().findOne({owner: ownerId})) as TeamType | null;

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
    return (await getClient().findOne(query)) as TeamType | null;
};

export const checkTeamAvailability = async (
    teamName: string,
    userId: string
): Promise<[TeamType | undefined, AvailabilityType]> => {
    const db = getClient();

    const query = {
        $or: [{name: teamName}, {owner: userId}, {members: userId}],
    } as Filter<Document>;

    const result = (await db.findOne(query)) as TeamType | null;

    if (result?.name === teamName) return [result, "NAME_EXISTS"];
    if (result?.owner === userId) return [result, "OWNER_EXISTS"];
    if (result?.members?.includes(userId)) return [result, "ALREADY_IN_TEAM"];

    return [undefined, "AVAILABLE"];
};

export const putTeam = async (
    teamName: string,
    ownerId: string,
    textChannel: string,
    voiceChannel: string,
    members?: string[]
): Promise<TeamType | undefined> => {
    const db = getClient();
    const newTeam = {
        name: teamName,
        owner: ownerId,
        creationTimestamp: Math.floor(new Date().getTime() / 1000),
        members: members ? members : [],
        textChannel: textChannel,
        voiceChannel: voiceChannel,
    } as TeamType;

    const result = await db.insertOne(newTeam);

    if (!result.acknowledged) return undefined;
    return newTeam;
};

export const updateTeam = async (
    oldTeam: TeamType,
    newTeam: TeamType
): Promise<[TeamType | null, UpdateResultType]> => {
    const result = await getClient().findOneAndReplace(oldTeam, newTeam);

    console.dir(result);
    console.dir((await getClient().findOne(oldTeam)) as TeamType | null);

    return [
        result.value as TeamType | null, //
        result.ok ? "SUCCESS" : "FAILURE",
    ];
};
