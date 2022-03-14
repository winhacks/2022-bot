import {GuildMember} from "discord.js";
import {SelectPlural} from "../helpers/misc";
import {GetVerifiedCount, SetVerifiedCount} from "../helpers/userManagement";
import {ClientType, EventType} from "../types";

const userVerifiedModule: EventType = {
    eventName: "userVerified",
    once: false,
    execute: async (client: ClientType, member: GuildMember) => {
        // update presence to reflect 1 more verified hacker
        const registeredCount = SetVerifiedCount((await GetVerifiedCount()) + 1);
        const message = SelectPlural(
            registeredCount,
            "nobody :(",
            "1 verified hacker",
            `${registeredCount} verified hackers`
        );

        client.user?.setPresence({
            status: "online",
            activities: [{type: "WATCHING", name: message}],
        });
    },
};

export {userVerifiedModule as event};
