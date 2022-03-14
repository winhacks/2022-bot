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
    deferMode: "NORMAL" | "EPHEMERAL" | "NO-DEFER";
    execute: (interaction: CommandInteraction<CacheType>) => Promise<any>;
}

export interface EventType {
    eventName: string;
    once: boolean;
    execute: (client: ClientType, ...args: any[]) => Promise<any>;
}

export interface ClientType extends Client {
    commands: Collection<string, CommandType>;
}

export enum TeamAvailability {
    "NAME_EXISTS",
    "ALREADY_IN_TEAM",
    "AVAILABLE",
}

export type Query = Filter<MongoDocument>;

export interface TeamType {
    name: string;
    stdName: string;
    textChannel: string;
    voiceChannel: string;
    members: string[];
    invites: InviteType[];
}

export interface InviteType {
    teamName: string;
    inviteID: string;
    invitee: string;
}

export interface CategoryType {
    categoryID: string;
    teamCount: number;
}

export interface VerifiedUserType {
    userID: string;
    verifiedAt: number;
    email: string;
    cardInfo: CardInfoType;
}

export interface CardInfoType {
    authorizedCard: boolean;
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
}
