import {GuildMember, RoleResolvable} from "discord.js";
import {CountEntities, verifiedCollection} from "./database";

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
