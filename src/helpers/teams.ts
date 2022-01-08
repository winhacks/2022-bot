import {Channel, GuildMember} from "discord.js";
import {Document, Filter} from "mongodb";
import {Config} from "../config";
import {mongoClient} from "./mongoDB";

export type CreateTeamResult = "ALREADY_OWN_TEAM" | "NAME_EXISTS" | "FAILURE" | "SUCCESS";

// a team is categorized by its name, the snowflake ID of its owner,
// an array of snowflake IDs of its members, and an array of channel
// snowflakes for channels that belong to that team
export type TeamType = {
    name: string;
    owner: string;
    members?: string[];
    channels?: string[];
};

export const createTeam = async (
    name: string,
    owner: GuildMember,
    members?: GuildMember[],
    channels?: Channel[]
): Promise<CreateTeamResult> => {
    const teamCollection = mongoClient
        .db(Config.teams.database_name)
        .collection(Config.teams.collection_name);

    // search collection for existing team
    const existingTeam = (await teamCollection.findOne({
        $or: [{name: name}, {owner: owner.id}],
    })) as unknown as TeamType;

    if (existingTeam?.name === name) return "NAME_EXISTS";
    if (existingTeam?.owner === owner.id) return "ALREADY_OWN_TEAM";

    // didn't exist, create a new one
    const putResult = await teamCollection.insertOne({
        name: name,
        owner: owner.id,
        members: members?.map((member) => member.id),
        channels: channels?.map((channel) => channel.id),
    } as TeamType);
    if (!putResult.acknowledged) {
        return "FAILURE";
    }

    return "SUCCESS";
};
