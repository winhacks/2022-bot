import {
    SlashCommandBuilder,
    SlashCommandSubcommandsOnlyBuilder,
} from "@discordjs/builders";
import {CacheType, Client, Collection, CommandInteraction} from "discord.js";
import {Filter, Document as MongoDocument} from "mongodb";

export interface CommandType {
    data:
        | SlashCommandBuilder
        | SlashCommandSubcommandsOnlyBuilder
        | Omit<SlashCommandBuilder, "addSubcommandGroup" | "addSubcommand">;
    execute: (interaction: CommandInteraction<CacheType>) => Promise<any>;
}

export interface ClientType extends Client {
    commands: Collection<string, CommandType>;
}

export enum TeamAvailability {
    "NAME_EXISTS",
    "OWNER_EXISTS",
    "ALREADY_IN_TEAM",
    "AVAILABLE",
}

export type Query = Filter<MongoDocument>;

export type TeamType = {
    name: string;
    stdName: string;
    owner: string;
    textChannel: string;
    voiceChannel: string;
    members: string[];
    invites: string[];
};

export type CategoryType = {
    category_id: string;
    team_count: number;
};

export type VerifiedUserType = {
    userID: string;
    verifiedAt: number;
    email: string;
    cardInfo: CardInfoType;
};

export type CardInfoType = {
    firstName?: string;
    lastName?: string;
    pronouns?: string;
    github?: string;
    website?: string;
    resume?: string;
    linkedIn?: string;
    studyArea?: string;
    studyLocation?: string;
    phone?: string;
    email?: string;
};
