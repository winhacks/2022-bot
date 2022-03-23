import {GuildMember, RoleResolvable, User} from "discord.js";
import {TeamType, VerifiedUserType} from "../types";
import {CountEntities, FindOne, teamCollection, verifiedCollection} from "./database";

let memberCount: number | undefined = undefined;

export const GetVerifiedCount = async (): Promise<number> => {
    if (memberCount === undefined) {
        memberCount = await CountEntities(verifiedCollection);
    }

    return memberCount;
};

export const SetVerifiedCount = (newCount: number): number => {
    memberCount = newCount;
    return memberCount;
};

export const GiveUserRole = async (
    member: GuildMember,
    role: RoleResolvable
): Promise<string> => {
    try {
        await member.roles.add(role);
        return "";
    } catch (err) {
        return `${err}`;
    }
};

export const TakeUserRole = async (
    member: GuildMember,
    role: RoleResolvable
): Promise<string> => {
    try {
        await member.roles.remove(role);
        return "";
    } catch (err) {
        return `${err}`;
    }
};

export const RenameUser = async (
    member: GuildMember,
    newNickname: string | null
): Promise<string> => {
    try {
        await member.setNickname(newNickname);
        return "";
    } catch (err) {
        return `${err}`;
    }
};

/**
 * Finds the team `user` is a member of if it exists, otherwise returns `false`.
 * @param user the user to check team status for
 * @returns the team `user` is in, otherwise `false`
 */
export const GetUserTeam = async (
    user: User | GuildMember | string
): Promise<TeamType | false> => {
    let id: string;

    if (user instanceof User) {
        id = user.id;
    } else if (user instanceof GuildMember) {
        id = user.id;
    } else {
        id = user;
    }

    const existingTeam = await FindOne<TeamType>(teamCollection, {members: id});
    return existingTeam ?? false;
};

/**
 * Finds the verification data for `user` if they are verified.
 * Returns `false` if the user is not verified.
 * @param user the user to check verification status for
 * @returns the user's verification data, otherwise `false`
 */
export const GetVerifiedUser = async (
    user: User | GuildMember | string
): Promise<VerifiedUserType | false> => {
    let id: string;

    if (user instanceof User) {
        id = user.id;
    } else if (user instanceof GuildMember) {
        id = user.id;
    } else {
        id = user;
    }

    const verifiedUser = await FindOne<VerifiedUserType>(verifiedCollection, {
        userID: id,
    });
    return verifiedUser ?? false;
};
