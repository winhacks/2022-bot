import {TimestampStyles, TimestampStylesString} from "@discordjs/builders";
import {Collection, User} from "discord.js";

export const Remove = (collection: Array<any>, element: any): Array<any> => {
    return collection.filter((e) => e !== element);
};

export const Timestamp = (
    time: number,
    mode: TimestampStylesString = TimestampStyles.RelativeTime
) => {
    return `<t:${Math.floor(time / 1000)}:${mode}>`;
};

export const PrettyUser = (usr: User) => {
    return `${usr.username}#${usr.discriminator}`;
};

export const ChannelLink = (id: string) => `<#${id}>`;

export const UserLink = (id: string) => `<@${id}>`;

export const GetDefault = <K, V>(col: Collection<K, V>, key: K, defaultValue: V): V => {
    if (col.has(key)) {
        return col.get(key)!;
    } else {
        return defaultValue;
    }
};
