import {Collection} from "discord.js";

export const Remove = (collection: Array<any>, element: any): Array<any> => {
    return collection.filter((e) => e !== element);
};

export const RelativeTime = (val: Date) => {
    return `<t:${Math.floor(val.getTime() / 1000)}:R>`;
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
